// @ts-nocheck
// Cloudflare Workers AI helpers — text generation with JSON parsing, cache,
// and graceful fallback. Used by /ai and /chat routes.

import { aiCache } from "@healthcare/db";
import { and, eq, gt, sql } from "drizzle-orm";

export type AiKind =
  | "summary"
  | "lab_explain"
  | "drug_interaction"
  | "chat"
  | "ocr";

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Hard caps to prevent abuse / runaway costs.
const MAX_INPUT_CHARS = 8000;        // prompt payload cap
const MAX_R2_FETCH_BYTES = 2_000_000; // 2 MB read from R2 per AI call
const AI_TIMEOUT_MS = 25_000;        // per-call deadline

// ─── Cache helpers ───────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cacheStore(
  db: any,
  kind: AiKind,
  input: unknown,
  output: unknown,
  ttlSeconds = 60 * 60 * 24
): Promise<void> {
  try {
    const hash = await sha256Hex(JSON.stringify(input));
    const ttlAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await db
      .insert(aiCache)
      .values({
        kind,
        inputHash: hash,
        output: JSON.stringify(output),
        ttlAt,
      } as any);
  } catch (err) {
    console.error("[ai] cacheStore failed", err);
  }
}

export async function cacheGet(
  db: any,
  kind: AiKind,
  input: unknown
): Promise<any | null> {
  try {
    const hash = await sha256Hex(JSON.stringify(input));
    const now = new Date().toISOString();
    const [row] = await db
      .select()
      .from(aiCache)
      .where(
        and(eq(aiCache.kind, kind), eq(aiCache.inputHash, hash), gt(aiCache.ttlAt, now))
      )
      .limit(1);
    if (!row) return null;
    try {
      return JSON.parse(row.output);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ─── R2 fetch helper (safe, bounded) ─────────────────────
// Fetches an R2 object as text with a hard size cap. Strips non-printable
// characters. Returns "" on any failure. Only used for *our* R2 bucket
// (key provided, not URL), so no SSRF surface.
export async function fetchR2Text(
  r2: any,
  key: string,
  maxBytes = MAX_R2_FETCH_BYTES
): Promise<string> {
  if (!r2 || !key) return "";
  try {
    const obj = await r2.get(key);
    if (!obj) return "";
    const size = obj.size ?? 0;
    if (size > maxBytes) {
      // Read a bounded slice instead of failing outright
      const stream = obj.body as ReadableStream | null;
      if (!stream) return "";
      const limited = stream.pipeThrough(
        new TransformStream({
          transform(chunk, ctrl) {
            ctrl.enqueue(chunk);
          },
        })
      );
      const buf = await new Response(limited as any).arrayBuffer();
      const slice = new Uint8Array(buf).slice(0, maxBytes);
      return new TextDecoder("utf-8", { fatal: false })
        .decode(slice)
        .replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }
    const text = await obj.text();
    return (text || "").slice(0, maxBytes).replace(/[^\x20-\x7E\n\r\t]/g, " ");
  } catch (err) {
    console.error("[ai] fetchR2Text failed", err);
    return "";
  }
}

// ─── Model call ──────────────────────────────────────────
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function aiComplete(
  ai: any,
  messages: ChatMsg[],
  opts: { maxTokens?: number; temperature?: number; model?: string; timeoutMs?: number } = {}
): Promise<string> {
  if (!ai) {
    console.error("[aiComplete] no AI binding");
    return "";
  }
  const model = opts.model || TEXT_MODEL;

  // Cap the prompt size to prevent abuse / token overflow.
  const safeMessages: ChatMsg[] = messages.map((m) => ({
    role: m.role,
    content: (m.content || "").slice(0, MAX_INPUT_CHARS),
  }));

  const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS;
  const work = (async () => {
    try {
      const res = await ai.run(model, {
        messages: safeMessages,
        max_tokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.3,
      });
      console.log("[aiComplete] raw response:", JSON.stringify(res));
      const val =
        res?.response ??
        res?.output_text ??
        res?.result?.response ??
        (typeof res === "string" ? res : "");

      if (typeof val === "string") return val;
      if (val && typeof val === "object") {
        return (
          (val as any).text ??
          (val as any).message ??
          (val as any).response ??
          (val as any).content ??
          JSON.stringify(val)
        );
      }
      return "";
    } catch (err) {
      console.error("[aiComplete] ai.run threw:", (err as Error)?.message || err);
      return "";
    }
  })();

  const timer = new Promise<string>((resolve) => setTimeout(() => resolve(""), timeoutMs));
  return Promise.race([work, timer]);
}

// ─── JSON parser ─────────────────────────────────────────
export function tryParseJson<T = any>(text: string): T | null {
  if (!text) return null;
  // Strip code fences
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  try {
    return JSON.parse(s);
  } catch {
    // Try to find the first JSON object in the text
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Loose shape guard: confirms the parsed object has the expected top-level
// keys and (recursively, one level) that arrays/strings are arrays/strings.
// Returns the input unchanged on success; returns null on mismatch.
export function hasShape<T = any>(input: any, shape: Record<string, "string" | "string[]" | "object">): T | null {
  if (!input || typeof input !== "object") return null;
  for (const [k, t] of Object.entries(shape)) {
    const v = input[k];
    if (t === "string") {
      if (typeof v !== "string") return null;
    } else if (t === "string[]") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return null;
    } else if (t === "object") {
      if (!v || typeof v !== "object") return null;
    }
  }
  return input as T;
}

// ─── Prompt helpers ──────────────────────────────────────
export function systemPrompt(role: string): string {
  return `You are a careful medical AI assistant for a personal health record app. ${role} Always respond with valid JSON when asked. Be concise. Do not invent facts; if data is missing, return nulls or empty arrays. Never give definitive diagnoses — frame outputs as observations or summaries for the patient and their care team.`;
}

// ─── Curated drug interaction set ────────────────────────
// Used as a fast-path check before calling the LLM. Format: "A|B" → severity + note.
export const DRUG_INTERACTIONS: Array<{
  pair: [string, string];
  severity: "minor" | "moderate" | "severe";
  note: string;
}> = [
  {
    pair: ["warfarin", "aspirin"],
    severity: "severe",
    note: "Significantly increased bleeding risk. Avoid combination unless explicitly prescribed.",
  },
  {
    pair: ["warfarin", "ibuprofen"],
    severity: "severe",
    note: "NSAID + anticoagulant raises GI and bleeding risk. Use acetaminophen instead.",
  },
  {
    pair: ["metformin", "alcohol"],
    severity: "moderate",
    note: "Risk of lactic acidosis and hypoglycemia with heavy alcohol use.",
  },
  {
    pair: ["simvastatin", "amlodipine"],
    severity: "moderate",
    note: "Amlodipine can raise simvastatin levels. Limit simvastatin to 20 mg/day.",
  },
  {
    pair: ["atorvastatin", "clarithromycin"],
    severity: "severe",
    note: "Clarithromycin inhibits statin metabolism → rhabdomyolysis risk.",
  },
  {
    pair: ["tramadol", "sertraline"],
    severity: "severe",
    note: "Serotonin syndrome risk. Avoid combining.",
  },
  {
    pair: ["lisinopril", "potassium"],
    severity: "moderate",
    note: "ACE inhibitor + potassium supplements can cause hyperkalemia.",
  },
  {
    pair: ["clopidogrel", "omeprazole"],
    severity: "moderate",
    note: "Omeprazole reduces clopidogrel effectiveness. Use pantoprazole instead.",
  },
  {
    pair: ["amiodarone", "simvastatin"],
    severity: "severe",
    note: "Risk of severe myopathy. Simvastatin dose must be capped or switched.",
  },
  {
    pair: ["methotrexate", "trimethoprim"],
    severity: "severe",
    note: "Additive anti-folate effect → pancytopenia risk.",
  },
  {
    pair: ["digoxin", "amiodarone"],
    severity: "moderate",
    note: "Amiodarone raises digoxin levels; reduce digoxin dose by half.",
  },
  {
    pair: ["metformin", "furosemide"],
    severity: "minor",
    note: "Furosemide may reduce glycemic control; monitor glucose.",
  },
];

export function findStaticInteractions(medicines: string[]): Array<{
  medicines: string[];
  severity: "minor" | "moderate" | "severe";
  note: string;
  source: "curated";
}> {
  const norm = medicines.map((m) => m.trim().toLowerCase());
  const found: Array<{
    medicines: string[];
    severity: "minor" | "moderate" | "severe";
    note: string;
    source: "curated";
  }> = [];
  for (const it of DRUG_INTERACTIONS) {
    const a = it.pair[0].toLowerCase();
    const b = it.pair[1].toLowerCase();
    const hasA = norm.some((m) => m.includes(a));
    const hasB = norm.some((m) => m.includes(b));
    if (hasA && hasB) {
      found.push({
        medicines: it.pair,
        severity: it.severity,
        note: it.note,
        source: "curated",
      });
    }
  }
  return found;
}

// ─── Fallback responses ─────────────────────────────────
export function fallbackSummary() {
  return {
    patientSummary:
      "Summary unavailable right now. Please try again later or consult your doctor.",
    diagnoses: [],
    medicines: [],
    history: [],
    risks: [],
    recentTests: [],
  };
}

export function fallbackLabExplain() {
  return {
    explanation:
      "We couldn't read the report right now. Please try again or consult your doctor.",
    recommendations: [],
    abnormalValues: [],
  };
}

export function fallbackDrugCheck() {
  return {
    interactions: [],
    warnings: [
      "Interaction check is unavailable. Consult your doctor or pharmacist before combining medicines.",
    ],
  };
}

export function fallbackChat(_message: string) {
  // Do NOT echo the user's message back — avoid leaking input verbatim.
  return "I'm having trouble reaching the assistant right now. If this is urgent, please contact your doctor or local emergency services.";
}

export function fallbackOcr() {
  return {
    medicines: [],
    doctor: "",
    date: "",
    diagnosis: "",
    note: "OCR unavailable. Please enter medicines manually.",
  };
}

// Re-export sql to satisfy older import paths if any.
export { sql };
