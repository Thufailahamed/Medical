// @ts-nocheck
// Cloudflare Workers AI helpers — text generation with JSON parsing, cache,
// and graceful fallback. Used by /ai and /chat routes.

import { aiCache, aiCalls } from "@healthcare/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { redactPii, redactMessages } from "./redact";

export type AiKind =
  | "summary"
  | "lab_explain"
  | "drug_trend"
  | "lab_trend"
  | "drug_interaction"
  | "chat"
  | "ocr"
  | "classify"
  | "clinical_note_summary"
  | "soap_draft"
  | "suggest_record_type";

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

// ─── Telemetry ──────────────────────────────────────────
//
// Best-effort write of an `ai_calls` row. Failures here must NEVER
// bubble up — telemetry is downstream of the actual model call.
export interface RecordAiCallInput {
  db: any;
  kind: AiKind;
  model: string;
  userId?: string | null;
  patientId?: string | null;
  cachedHit?: boolean;
  latencyMs?: number;
  status?: "ok" | "error" | "timeout" | "fallback";
  errorMessage?: string | null;
}

export async function recordAiCall(input: RecordAiCallInput): Promise<void> {
  try {
    await input.db.insert(aiCalls).values({
      kind: input.kind,
      userId: input.userId ?? null,
      patientId: input.patientId ?? null,
      model: input.model,
      cachedHit: !!input.cachedHit,
      latencyMs: Math.max(0, Math.round(input.latencyMs ?? 0)),
      status: input.status ?? "ok",
      errorMessage: input.errorMessage ?? null,
    } as any);
  } catch (err) {
    console.error("[ai] recordAiCall failed", (err as Error)?.message || err);
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
  opts: { maxTokens?: number; temperature?: number; model?: string; timeoutMs?: number; telemetry?: RecordAiCallInput } = {}
): Promise<string> {
  if (!ai) {
    console.error("[aiComplete] no AI binding");
    return "";
  }
  const model = opts.model || TEXT_MODEL;

  // Cap the prompt size to prevent abuse / token overflow, and strip
  // PII (NIC, phone, email) before the message hits the LLM endpoint.
  // The order matters: redact first, then cap, so the redaction tag
  // never gets truncated mid-token.
  const safeMessages: ChatMsg[] = redactMessages(messages).map((m) => ({
    role: m.role,
    content: (m.content || "").slice(0, MAX_INPUT_CHARS),
  }));

  const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS;
  const start = Date.now();
  let finalStatus: "ok" | "error" | "timeout" | "fallback" = "ok";
  let finalErr: string | null = null;
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
      finalStatus = "fallback";
      return "";
    } catch (err) {
      console.error("[aiComplete] ai.run threw:", (err as Error)?.message || err);
      finalStatus = "error";
      finalErr = (err as Error)?.message || "ai.run threw";
      return "";
    }
  })();

  const timer = new Promise<string>((resolve) => {
    setTimeout(() => {
      finalStatus = "timeout";
      finalErr = `timed out after ${timeoutMs}ms`;
      resolve("");
    }, timeoutMs);
  });
  const out = await Promise.race([work, timer]);

  if (opts.telemetry) {
    await recordAiCall({
      ...opts.telemetry,
      model,
      latencyMs: Date.now() - start,
      status: finalStatus,
      errorMessage: finalErr,
    });
  }

  return out;
}

// ─── Streaming variant ───────────────────────────────────
//
// Yields incremental text deltas from the same Workers AI model. The
// underlying binding returns an SSE-shaped ReadableStream when called
// with `stream: true`; we decode and forward only the text fragments.
//
// `signal` is an AbortSignal so the route can cancel on client
// disconnect (Hono streamSSE passes stream.abort). The deadline caps
// total wall-clock so a stuck stream cannot hang forever.
export async function* streamAiComplete(
  ai: any,
  messages: ChatMsg[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    telemetry?: Omit<RecordAiCallInput, "latencyMs" | "status" | "errorMessage" | "model">;
  } = {}
): AsyncGenerator<string, void, void> {
  if (!ai) {
    console.error("[streamAiComplete] no AI binding");
    return;
  }
  const model = opts.model || TEXT_MODEL;
  // Redact PII before the SSE stream starts so we never emit NIC /
  // phone / email to the inference endpoint. Order: redact, then cap.
  const safeMessages: ChatMsg[] = redactMessages(messages).map((m) => ({
    role: m.role,
    content: (m.content || "").slice(0, MAX_INPUT_CHARS),
  }));

  const deadlineMs = opts.timeoutMs ?? AI_TIMEOUT_MS;
  const start = Date.now();
  let finalStatus: "ok" | "error" | "timeout" | "fallback" = "ok";
  let finalErr: string | null = null;
  let yieldedAny = false;

  let res: Response;
  try {
    res = await ai.run(model, {
      messages: safeMessages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.3,
      stream: true,
    });
  } catch (err) {
    console.error("[streamAiComplete] ai.run threw:", (err as Error)?.message || err);
    finalStatus = "error";
    finalErr = (err as Error)?.message || "ai.run threw";
    if (opts.telemetry) {
      await recordAiCall({
        ...opts.telemetry,
        model,
        latencyMs: Date.now() - start,
        status: finalStatus,
        errorMessage: finalErr,
      });
    }
    return;
  }

  if (!res?.body) {
    console.error("[streamAiComplete] no response body");
    finalStatus = "fallback";
    if (opts.telemetry) {
      await recordAiCall({
        ...opts.telemetry,
        model,
        latencyMs: Date.now() - start,
        status: finalStatus,
      });
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      if (opts.signal?.aborted) {
        finalStatus = "error";
        finalErr = "client disconnected";
        return;
      }
      if (Date.now() - start > deadlineMs) {
        finalStatus = "timeout";
        finalErr = `timed out after ${deadlineMs}ms`;
        return;
      }

      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // Workers AI streams SSE: lines separated by \n\n, each event may
      // contain a `data: ` JSON line with a `response` chunk.
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const evt = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = evt
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          const chunk =
            obj?.response ??
            obj?.output_text ??
            (typeof obj === "string" ? obj : "");
          if (typeof chunk === "string" && chunk.length > 0) {
            yieldedAny = true;
            yield chunk;
          }
        } catch {
          // non-JSON line — skip
        }
      }
    }
  } catch (err) {
    console.error("[streamAiComplete] read error:", (err as Error)?.message || err);
    finalStatus = "error";
    finalErr = (err as Error)?.message || "read error";
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
    if (opts.telemetry) {
      await recordAiCall({
        ...opts.telemetry,
        model,
        latencyMs: Date.now() - start,
        status: !yieldedAny ? "fallback" : finalStatus,
        errorMessage: finalErr,
      });
    }
  }
}

// Helper that wraps streamAiComplete in a Promise<string> so non-streaming
// callers (and tests) can still consume the full text.
export async function collectStream(
  ai: any,
  messages: ChatMsg[],
  opts: Parameters<typeof streamAiComplete>[2] = {}
): Promise<string> {
  let out = "";
  for await (const chunk of streamAiComplete(ai, messages, opts)) {
    out += chunk;
  }
  return out;
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
  // ─── Anticoagulants / antiplatelets ───────────────────
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
    pair: ["warfarin", "naproxen"],
    severity: "severe",
    note: "NSAID + anticoagulant raises bleeding risk. Avoid.",
  },
  {
    pair: ["warfarin", "diclofenac"],
    severity: "severe",
    note: "NSAID + anticoagulant raises bleeding risk. Avoid.",
  },
  {
    pair: ["warfarin", "fluconazole"],
    severity: "severe",
    note: "Fluconazole inhibits warfarin metabolism → supratherapeutic INR.",
  },
  {
    pair: ["warfarin", "metronidazole"],
    severity: "severe",
    note: "Metronidazole inhibits warfarin metabolism. Reduce warfarin dose and monitor INR.",
  },
  {
    pair: ["warfarin", "amiodarone"],
    severity: "severe",
    note: "Amiodarone inhibits warfarin metabolism. Reduce warfarin dose by 30-50%.",
  },
  {
    pair: ["warfarin", "ciprofloxacin"],
    severity: "moderate",
    note: "Ciprofloxacin may raise INR. Monitor.",
  },
  {
    pair: ["warfarin", "acetaminophen"],
    severity: "moderate",
    note: "High-dose or chronic acetaminophen may raise INR. Monitor if used >2 g/day.",
  },
  {
    pair: ["warfarin", "cranberry"],
    severity: "moderate",
    note: "Cranberry juice may potentiate warfarin. Avoid large amounts.",
  },
  {
    pair: ["clopidogrel", "omeprazole"],
    severity: "moderate",
    note: "Omeprazole reduces clopidogrel effectiveness. Use pantoprazole instead.",
  },
  {
    pair: ["clopidogrel", "esomeprazole"],
    severity: "moderate",
    note: "Esomeprazole reduces clopidogrel effectiveness. Use pantoprazole.",
  },
  {
    pair: ["aspirin", "ibuprofen"],
    severity: "moderate",
    note: "Ibuprofen interferes with aspirin's antiplatelet effect. Take aspirin 2h before ibuprofen.",
  },
  {
    pair: ["apixaban", "rifampin"],
    severity: "severe",
    note: "Rifampin induces apixaban metabolism → loss of anticoagulation.",
  },
  {
    pair: ["rivaroxaban", "ketoconazole"],
    severity: "severe",
    note: "Ketoconazole raises rivaroxaban levels → bleeding risk.",
  },
  // ─── Statins ─────────────────────────────────────────
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
    pair: ["simvastatin", "clarithromycin"],
    severity: "severe",
    note: "Clarithromycin inhibits simvastatin metabolism → rhabdomyolysis risk. Hold statin.",
  },
  {
    pair: ["atorvastatin", "erythromycin"],
    severity: "severe",
    note: "Erythromycin inhibits statin metabolism → myopathy risk.",
  },
  {
    pair: ["simvastatin", "itraconazole"],
    severity: "severe",
    note: "Itraconazole raises simvastatin levels >10x. Contraindicated.",
  },
  {
    pair: ["lovastatin", "itraconazole"],
    severity: "severe",
    note: "Itraconazole raises lovastatin levels. Contraindicated.",
  },
  {
    pair: ["atorvastatin", "grapefruit"],
    severity: "moderate",
    note: "Grapefruit juice raises atorvastatin levels. Avoid large quantities.",
  },
  {
    pair: ["simvastatin", "grapefruit"],
    severity: "severe",
    note: "Grapefruit juice raises simvastatin levels markedly. Avoid.",
  },
  // ─── QT prolongation ─────────────────────────────────
  {
    pair: ["amiodarone", "sotalol"],
    severity: "severe",
    note: "Additive QT prolongation → torsades risk. Avoid combination.",
  },
  {
    pair: ["azithromycin", "amiodarone"],
    severity: "severe",
    note: "Additive QT prolongation. Monitor ECG.",
  },
  {
    pair: ["ciprofloxacin", "sotalol"],
    severity: "severe",
    note: "Additive QT prolongation. Avoid.",
  },
  {
    pair: ["haloperidol", "amiodarone"],
    severity: "severe",
    note: "Additive QT prolongation. Monitor ECG or avoid.",
  },
  {
    pair: ["ondansetron", "amiodarone"],
    severity: "moderate",
    note: "Additive QT prolongation. Use lowest effective ondansetron dose.",
  },
  // ─── Serotonin syndrome ──────────────────────────────
  {
    pair: ["tramadol", "sertraline"],
    severity: "severe",
    note: "Serotonin syndrome risk. Avoid combining.",
  },
  {
    pair: ["tramadol", "fluoxetine"],
    severity: "severe",
    note: "Serotonin syndrome risk. Avoid combining.",
  },
  {
    pair: ["tramadol", "paroxetine"],
    severity: "severe",
    note: "Serotonin syndrome risk. Avoid combining.",
  },
  {
    pair: ["triptan", "sertraline"],
    severity: "moderate",
    note: "Serotonin syndrome risk. Watch for symptoms; usually tolerated.",
  },
  {
    pair: ["linezolid", "sertraline"],
    severity: "severe",
    note: "Linezolid is an MAO inhibitor; serotonin syndrome risk with SSRIs. Avoid.",
  },
  {
    pair: ["mao inhibitor", "sertraline"],
    severity: "severe",
    note: "Risk of fatal serotonin syndrome. Washout required.",
  },
  {
    pair: ["mao inhibitor", "fluoxetine"],
    severity: "severe",
    note: "Risk of fatal serotonin syndrome. 14-day washout for MAOI; 5 weeks after fluoxetine.",
  },
  // ─── ACEi / ARBs / diuretics ─────────────────────────
  {
    pair: ["lisinopril", "potassium"],
    severity: "moderate",
    note: "ACE inhibitor + potassium supplements can cause hyperkalemia.",
  },
  {
    pair: ["losartan", "potassium"],
    severity: "moderate",
    note: "ARB + potassium supplements can cause hyperkalemia.",
  },
  {
    pair: ["spironolactone", "potassium"],
    severity: "moderate",
    note: "Potassium-sparing diuretic + potassium → hyperkalemia risk.",
  },
  {
    pair: ["spironolactone", "lisinopril"],
    severity: "moderate",
    note: "Dual RAAS blockade + K-sparing → hyperkalemia risk. Monitor.",
  },
  {
    pair: ["enalapril", "spironolactone"],
    severity: "moderate",
    note: "Dual RAAS blockade → hyperkalemia risk. Monitor K+.",
  },
  {
    pair: ["lisinopril", "lithium"],
    severity: "moderate",
    note: "ACE inhibitors raise lithium levels. Monitor.",
  },
  // ─── Diabetes ────────────────────────────────────────
  {
    pair: ["metformin", "alcohol"],
    severity: "moderate",
    note: "Risk of lactic acidosis and hypoglycemia with heavy alcohol use.",
  },
  {
    pair: ["metformin", "furosemide"],
    severity: "minor",
    note: "Furosemide may reduce glycemic control; monitor glucose.",
  },
  {
    pair: ["metformin", "contrast"],
    severity: "moderate",
    note: "Iodinated contrast + metformin → lactic acidosis risk in renal impairment. Hold metformin around contrast imaging.",
  },
  {
    pair: ["glipizide", "fluconazole"],
    severity: "moderate",
    note: "Fluconazole raises sulfonylurea levels → hypoglycemia.",
  },
  // ─── Cardiac ─────────────────────────────────────────
  {
    pair: ["digoxin", "amiodarone"],
    severity: "moderate",
    note: "Amiodarone raises digoxin levels; reduce digoxin dose by half.",
  },
  {
    pair: ["digoxin", "verapamil"],
    severity: "moderate",
    note: "Verapamil raises digoxin levels. Reduce digoxin dose.",
  },
  {
    pair: ["digoxin", "furosemide"],
    severity: "moderate",
    note: "Diuretic-induced hypokalemia potentiates digoxin toxicity. Monitor K+.",
  },
  {
    pair: ["digoxin", "spironolactone"],
    severity: "minor",
    note: "Spironolactone may raise digoxin levels slightly. Monitor.",
  },
  // ─── Immunosuppressants / chemo ──────────────────────
  {
    pair: ["methotrexate", "trimethoprim"],
    severity: "severe",
    note: "Additive anti-folate effect → pancytopenia risk.",
  },
  {
    pair: ["methotrexate", "nsaid"],
    severity: "severe",
    note: "NSAIDs reduce methotrexate clearance → toxicity. Avoid high-dose NSAIDs.",
  },
  {
    pair: ["methotrexate", "ibuprofen"],
    severity: "severe",
    note: "Ibuprofen reduces methotrexate clearance → toxicity.",
  },
  {
    pair: ["azathioprine", "allopurinol"],
    severity: "severe",
    note: "Allopurinol raises azathioprine metabolite → pancytopenia. Reduce azathioprine to 25%.",
  },
  {
    pair: ["cyclophosphamide", "allopurinol"],
    severity: "moderate",
    note: "Increased bone marrow suppression.",
  },
  // ─── Antibiotics ─────────────────────────────────────
  {
    pair: ["ciprofloxacin", "tizanidine"],
    severity: "severe",
    note: "Ciprofloxacin raises tizanidine levels markedly → severe hypotension. Contraindicated.",
  },
  {
    pair: ["ciprofloxacin", "methadone"],
    severity: "severe",
    note: "Ciprofloxacin raises methadone levels → respiratory depression risk.",
  },
  {
    pair: ["metronidazole", "alcohol"],
    severity: "severe",
    note: "Disulfiram-like reaction (flushing, nausea, tachycardia). Avoid alcohol.",
  },
  {
    pair: ["linezolid", "tyramine"],
    severity: "severe",
    note: "Linezolid + tyramine-rich foods (aged cheese, cured meats) → hypertensive crisis.",
  },
  // ─── CNS ─────────────────────────────────────────────
  {
    pair: ["benzodiazepine", "opioid"],
    severity: "severe",
    note: "Severe respiratory depression risk. Avoid combination; if unavoidable, use lowest doses and monitor.",
  },
  {
    pair: ["alprazolam", "oxycodone"],
    severity: "severe",
    note: "Severe sedation / respiratory depression. Black-box warning combination.",
  },
  {
    pair: ["gabapentin", "oxycodone"],
    severity: "severe",
    note: "Additive CNS depression. Monitor.",
  },
  {
    pair: ["lithium", "ibuprofen"],
    severity: "moderate",
    note: "NSAIDs raise lithium levels. Monitor.",
  },
  {
    pair: ["lithium", "hydrochlorothiazide"],
    severity: "moderate",
    note: "Thiazides raise lithium levels. Reduce lithium dose; monitor.",
  },
  {
    pair: ["lithium", "acetazolamide"],
    severity: "moderate",
    note: "Acetazolamide lowers lithium levels. Monitor.",
  },
  {
    pair: ["phenytoin", "warfarin"],
    severity: "moderate",
    note: "Complex interaction — initial rise then fall in INR. Monitor closely.",
  },
  {
    pair: ["valproate", "lamotrigine"],
    severity: "severe",
    note: "Valproate raises lamotrigine levels → Stevens-Johnson risk. Halve lamotrigine dose.",
  },
  // ─── PPI / H2 blockers ───────────────────────────────
  {
    pair: ["omeprazole", "methotrexate"],
    severity: "moderate",
    note: "PPIs may raise methotrexate levels. With high-dose methotrexate, hold PPI.",
  },
  {
    pair: ["omeprazole", "clopidogrel"],
    severity: "moderate",
    note: "Already covered above; duplicated for `omeprazole` alias coverage.",
  },
  // ─── Thyroid / endocrine ─────────────────────────────
  {
    pair: ["levothyroxine", "calcium"],
    severity: "moderate",
    note: "Calcium reduces levothyroxine absorption. Separate doses by 4 hours.",
  },
  {
    pair: ["levothyroxine", "iron"],
    severity: "moderate",
    note: "Iron reduces levothyroxine absorption. Separate doses by 4 hours.",
  },
  {
    pair: ["levothyroxine", "omeprazole"],
    severity: "moderate",
    note: "PPIs may impair levothyroxine absorption. Monitor TSH.",
  },
  // ─── Common foods (caffeine, dairy, etc.) ────────────
  {
    pair: ["ciprofloxacin", "dairy"],
    severity: "moderate",
    note: "Calcium in dairy reduces ciprofloxacin absorption. Separate by 2 hours.",
  },
  {
    pair: ["tetracycline", "dairy"],
    severity: "moderate",
    note: "Calcium/magnesium/iron reduce tetracycline absorption. Separate by 2 hours.",
  },
  {
    pair: ["ciprofloxacin", "caffeine"],
    severity: "minor",
    note: "Ciprofloxacin slows caffeine clearance → jitteriness. Limit caffeine intake.",
  },
  {
    pair: ["methotrexate", "alcohol"],
    severity: "severe",
    note: "Additive hepatotoxicity. Avoid alcohol.",
  },
  {
    pair: ["acetaminophen", "alcohol"],
    severity: "severe",
    note: "Chronic alcohol use depletes glutathione → hepatotoxicity at therapeutic doses.",
  },
  {
    pair: ["isoniazid", "alcohol"],
    severity: "moderate",
    note: "Increased hepatotoxicity. Avoid.",
  },
  // ─── Antifungals ─────────────────────────────────────
  {
    pair: ["ketoconazole", "simvastatin"],
    severity: "severe",
    note: "Already covered; duplicated for ketoconazole.",
  },
  {
    pair: ["fluconazole", "rifampin"],
    severity: "moderate",
    note: "Rifampin induces fluconazole metabolism → reduced levels.",
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

// Day 3 #6: lab-test trend narrative fallback. lab_reports has no
// numeric test values — only the reportType + status + createdAt — so
// the trend is the cadence of testing. The LLM narrative is layered on
// top; this fallback is the structural skeleton the LLM would have
// populated.
export function fallbackLabTrend(
  type: string,
  series: Array<{ date: string; status: string }>
) {
  return {
    type,
    count: series.length,
    lastDate: series[0]?.date ?? null,
    pendingCount: series.filter((s) => s.status === "pending").length,
    completedCount: series.filter((s) => s.status === "completed").length,
    series: series.slice(0, 30),
    narrative:
      series.length === 0
        ? `No ${type} reports found in the selected window.`
        : `Found ${series.length} ${type} report(s). Last on file: ${series[0]?.date ?? "unknown"}.`,
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

// Day 2 #1: clinical-note summary fallback. Always safe to surface.
export function fallbackClinicalNoteSummary() {
  return {
    summary: "Summary unavailable. Please review the note manually.",
    soap: {
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    },
    keyTerms: [] as string[],
  };
}

// Day 4 #9: SOAP-draft fallback. We pass through the user's bullets
// verbatim — the caller still sees something useful even when the LLM
// is down. Empty sections get a friendly placeholder string so the
// doctor knows the AI didn't author that part.
export function fallbackSoapDraft(bullets: {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}) {
  const placeholder = "(AI drafting unavailable — fill manually)";
  return {
    subjective: bullets.subjective?.trim() || placeholder,
    objective: bullets.objective?.trim() || placeholder,
    assessment: bullets.assessment?.trim() || placeholder,
    plan: bullets.plan?.trim() || placeholder,
    draftedByAI: false,
  };
}

// Day 5 #2: symptom → record-type suggestion fallback.
//
// Heuristic keyword scan — cheap, no LLM, and good enough for the
// common cases. The endpoint tries the LLM first; this is the
// "model returned garbage" branch.
//
// The full recordType enum lives in @healthcare/db (medical_records
// table). We mirror the most common subset here.
const KEYWORD_TO_TYPE: Array<{ keywords: string[]; type: string }> = [
  { keywords: ["x-ray", "xray", "ct scan", "mri", "ultrasound", "scan", "imaging", "radiolog"], type: "imaging" },
  { keywords: ["blood test", "lab", "laboratory", "cbc", "hba1c", "lipid", "panel", "result"], type: "lab_report" },
  { keywords: ["prescription", "rx", "medication", "refill", "drug", "tablet"], type: "prescription" },
  { keywords: ["vaccin", "immuniz", "booster", "jab"], type: "vaccination" },
  { keywords: ["allerg", "reaction", "rash", "hives", "sneezing"], type: "allergy" },
  { keywords: ["surgery", "operation", "surgical", "post-op", "post op"], type: "surgery" },
  { keywords: ["discharge", "leaving hospital", "going home"], type: "discharge_summary" },
  { keywords: ["fit note", "medical certificate", "sick note", "mc"], type: "medical_certificate" },
  { keywords: ["follow up", "follow-up", "review appointment", "check-up", "checkup"], type: "follow_up" },
  { keywords: ["invoice", "bill", "receipt", "payment"], type: "invoice" },
  { keywords: ["insurance", "claim", "coverage"], type: "insurance" },
  { keywords: ["fitness", "gym", "exercise", "workout", "training plan"], type: "fitness" },
  { keywords: ["admission", "hospital visit", "er visit", "a&e", "emergency room", "consultation"], type: "hospital_visit" },
  { keywords: ["operation note", "operative note", "op note"], type: "operation_note" },
  { keywords: ["lab order", "test ordered", "ordered a test"], type: "lab_order" },
];

export function fallbackSuggestRecordType(text: string): {
  recordType: string;
  confidence: number;
  reasoning: string;
} {
  const haystack = (text || "").toLowerCase();
  for (const { keywords, type } of KEYWORD_TO_TYPE) {
    for (const kw of keywords) {
      if (haystack.includes(kw)) {
        return {
          recordType: type,
          confidence: 0.55,
          reasoning: `Matched keyword "${kw}" — no LLM available; please verify.`,
        };
      }
    }
  }
  return {
    recordType: "other",
    confidence: 0.2,
    reasoning: "No strong keyword match and AI is unavailable — defaulted to 'other'.",
  };
}

// Re-export sql to satisfy older import paths if any.
export { sql };
