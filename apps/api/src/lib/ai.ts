// @ts-nocheck
// Cloudflare Workers AI helpers — text generation with JSON parsing, cache,
// and graceful fallback. Used by /ai and /chat routes.

export type AiKind =
  | "summary"
  | "lab_explain"
  | "drug_interaction"
  | "chat"
  | "ocr";

const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
    const { aiCache } = await import("@healthcare/db");
    const { sql } = await import("drizzle-orm");
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
    const { aiCache } = await import("@healthcare/db");
    const { and, eq, gt } = await import("drizzle-orm");
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

// ─── Model call ──────────────────────────────────────────
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function aiComplete(
  ai: any,
  messages: ChatMsg[],
  opts: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<string> {
  const model = opts.model || TEXT_MODEL;
  let res: any;
  try {
    res = await ai.run(model, {
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.3,
    });
  } catch (err) {
    console.error("[aiComplete] ai.run threw:", (err as Error)?.message || err);
    return "";
  }
  // Workers AI returns { response: "..." } for chat models
  return (
    res?.response ??
    res?.output_text ??
    res?.result?.response ??
    (typeof res === "string" ? res : "") ??
    ""
  );
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

export function fallbackChat(message: string) {
  return `I'm having trouble reaching the assistant right now. If this is urgent, please contact your doctor. (You said: "${message.slice(0, 120)}")`;
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