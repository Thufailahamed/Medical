// @ts-nocheck
// Phase 2.1: auto-classification. Given an attachment's R2 key, infer the
// `recordType` (one of 17 values, see schema.ts), pull out metadata, and
// return a confidence score. Wraps `aiComplete` with a structured prompt
// + JSON parse + the canonical `ai_cache` (`kind: 'classify'`).
//
// Output is stored on the record's `extractedData` JSON column as
//   { classification: { recordType, confidence, extracted, modelVersion, classifiedAt } }
//
// Vision model (Llama 3.2 11B Vision) is deferred to Phase 2.2. PR-1 only
// fires for text-extractable PDFs. Binary images with no extractable
// text get `confidence: 0` and stay as `recordType='other'`.

import { aiComplete, cacheGet, cacheStore } from "./ai";
import { extractR2Key } from "../routes/ai";
import { fetchR2Text } from "./ai";
import { writeAudit } from "./audit";
import { medicalRecords } from "@healthcare/db";
import { eq } from "drizzle-orm";

const CLASSIFY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// All 17 recordType values. The classifier prompt lists them explicitly so
// the model only emits one of these strings (and not "lab", "imaging", etc.).
const RECORD_TYPES = [
  "lab_report",
  "imaging",
  "prescription",
  "hospital_visit",
  "vaccination",
  "surgery",
  "allergy",
  "insurance",
  "fitness",
  "discharge_summary",
  "medical_certificate",
  "operation_note",
  "invoice",
  "clinical_note",
  "lab_order",
  "follow_up",
  "other",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export interface ClassifyResult {
  recordType: RecordType;
  confidence: number; // 0.0 - 1.0
  extracted: {
    date?: string;          // YYYY-MM-DD
    provider?: string;      // doctor or hospital name
    patient_name?: string;
    key_findings?: string;  // 1-line summary
  };
  modelVersion: string;
  classifiedAt: string; // ISO
}

const SYSTEM_PROMPT = `You are a medical-record classifier for a Sri Lankan healthcare app.
You receive the raw text content of an uploaded document (lab PDF, prescription, discharge summary, etc.).
You MUST respond with a single JSON object matching this shape exactly:

{
  "recordType": "<one of the 17 enum values below>",
  "confidence": <number between 0 and 1>,
  "extracted": {
    "date": "<YYYY-MM-DD or empty>",
    "provider": "<doctor or hospital name or empty>",
    "patient_name": "<name or empty>",
    "key_findings": "<one-line plain-text summary or empty>"
  }
}

Rules:
- "recordType" MUST be exactly one of: ${RECORD_TYPES.join(", ")}.
- "confidence" reflects how certain you are. Use 0.7+ for clear documents, 0.4-0.7 for ambiguous, below 0.4 if you cannot tell.
- If the text is empty, garbled, or clearly not a medical document, return recordType="other" with confidence=0.0.
- "key_findings" must be a single short sentence. No markdown, no bullet points.
- Output ONLY the JSON. No prose, no code fences.

Examples:
- "CBC, Hb 12.4, WBC 7400, Platelets 250k. Dr. Silva." → recordType=lab_report, confidence=0.95
- "Rx: Metformin 500mg BID x 30 days. Dr. Perera." → recordType=prescription, confidence=0.93
- "Discharge summary, ward 4B, 2024-11-12, diagnosis: Dengue." → recordType=discharge_summary, confidence=0.9
- Empty or random bytes → recordType=other, confidence=0.0`;

export interface ClassifyEnv {
  AI: any;
  R2: R2Bucket;
  DB: any;
}

export interface ClassifyInput {
  /** R2 key OR a same-origin /files/download URL OR a raw public R2 URL. */
  fileUrl: string;
  /** Optional recordId — used to write the audit row. */
  recordId?: string;
  /** Where the call is coming from — recorded in audit details. */
  source: "upload" | "email-import" | "cron" | "manual";
  /** Optional user context for audit. */
  userId?: string;
  /** Threshold below which we don't override the record's recordType. */
  threshold?: number;
}

const DEFAULT_THRESHOLD = 0.6;

function clampConfidence(n: any): number {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return Math.round(v * 100) / 100;
}

function normaliseRecordType(s: any): RecordType {
  if (typeof s !== "string") return "other";
  const lower = s.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((RECORD_TYPES as readonly string[]).includes(lower)) return lower as RecordType;
  // Tolerate common LLM aliases.
  if (lower === "lab") return "lab_report";
  if (lower === "scan" || lower === "x_ray" || lower === "xray") return "imaging";
  if (lower === "rx" || lower === "medication") return "prescription";
  if (lower === "discharge") return "discharge_summary";
  if (lower === "cert") return "medical_certificate";
  if (lower === "op_note") return "operation_note";
  if (lower === "visit") return "hospital_visit";
  return "other";
}

function emptyResult(): ClassifyResult {
  return {
    recordType: "other",
    confidence: 0,
    extracted: {},
    modelVersion: CLASSIFY_MODEL,
    classifiedAt: new Date().toISOString(),
  };
}

/**
 * Public entry. Returns a `ClassifyResult`. Always returns something —
 * `other` + `confidence: 0` on any failure. Never throws.
 */
export async function classify(
  env: ClassifyEnv,
  input: ClassifyInput
): Promise<ClassifyResult> {
  const key = extractR2Key(input.fileUrl);
  if (!key) return emptyResult();

  // Cache key = hash(fileUrl + first 4KB of text). Two different R2 keys
  // pointing at the same content hit the same cache row.
  const text = await fetchR2Text(env.R2, key);
  if (!text || text.trim().length < 16) {
    // Empty / garbage input → 'other' immediately, no AI call.
    await writeAudit(env.DB, {
      userId: input.userId,
      action: "classify",
      resource: "medical_record",
      resourceId: input.recordId,
      details: {
        source: input.source,
        recordType: "other",
        confidence: 0,
        modelVersion: CLASSIFY_MODEL,
        reason: "no-extractable-text",
      },
    });
    return emptyResult();
  }

  // Cache lookup.
  const cacheInput = { key, preview: text.slice(0, 4096) };
  const cached = await cacheGet(env.DB, "classify", cacheInput);
  if (cached) {
    return { ...cached, classifiedAt: cached.classifiedAt ?? new Date().toISOString() };
  }

  // First 4000 chars is plenty for classification. The LLM only needs
  // enough to recognise document shape + a few key terms.
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Document text (first 4000 chars):\n\n${text.slice(0, 4000)}`,
    },
  ];

  const res = await aiComplete(env.AI, messages, {
    maxTokens: 350,
    temperature: 0.1,
    timeoutMs: 15_000,
  });

  // Parse + validate.
  let parsed: any = null;
  try {
    parsed = JSON.parse(res);
  } catch {
    // aiComplete already strips fences; if it still failed, fall back.
  }
  if (!parsed || typeof parsed !== "object") {
    await writeAudit(env.DB, {
      userId: input.userId,
      action: "classify",
      resource: "medical_record",
      resourceId: input.recordId,
      details: {
        source: input.source,
        recordType: "other",
        confidence: 0,
        modelVersion: CLASSIFY_MODEL,
        reason: "model-returned-non-json",
        raw: res?.slice?.(0, 200),
      },
    });
    return emptyResult();
  }

  const result: ClassifyResult = {
    recordType: normaliseRecordType(parsed.recordType),
    confidence: clampConfidence(parsed.confidence),
    extracted: {
      date: typeof parsed.extracted?.date === "string" ? parsed.extracted.date : undefined,
      provider: typeof parsed.extracted?.provider === "string" ? parsed.extracted.provider : undefined,
      patient_name:
        typeof parsed.extracted?.patient_name === "string"
          ? parsed.extracted.patient_name
          : undefined,
      key_findings:
        typeof parsed.extracted?.key_findings === "string"
          ? parsed.extracted.key_findings
          : undefined,
    },
    modelVersion: CLASSIFY_MODEL,
    classifiedAt: new Date().toISOString(),
  };

  await cacheStore(env.DB, "classify", cacheInput, result);
  await writeAudit(env.DB, {
    userId: input.userId,
    action: "classify",
    resource: "medical_record",
    resourceId: input.recordId,
    details: {
      source: input.source,
      recordType: result.recordType,
      confidence: result.confidence,
      modelVersion: CLASSIFY_MODEL,
    },
  });

  return result;
}

/**
 * Persist a classification result onto a medical_record. Reads the
 * existing `extractedData` (may contain an `ocr` block from earlier
 * processing), merges the new `classification` block, and writes back.
 * Only updates `recordType` if the new confidence clears the threshold
 * AND the new type isn't `other` AND the existing type is `other`.
 *
 * Returns the persisted result (which may differ from the input if the
 * threshold gate refused the upgrade).
 */
export async function persistClassification(
  db: any,
  recordId: string,
  result: ClassifyResult,
  threshold: number = DEFAULT_THRESHOLD
): Promise<{ recordType: string; extractedData: string } | null> {
  // Read existing extractedData so we don't clobber the OCR result.
  const [existing] = await db
    .select({
      id: medicalRecords.id,
      recordType: medicalRecords.recordType,
      extractedData: medicalRecords.extractedData,
    })
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);

  if (!existing) return null;

  let blob: any = {};
  if (existing.extractedData) {
    try {
      blob = JSON.parse(existing.extractedData);
    } catch {
      blob = {};
    }
  }
  blob.classification = {
    recordType: result.recordType,
    confidence: result.confidence,
    extracted: result.extracted,
    modelVersion: result.modelVersion,
    classifiedAt: result.classifiedAt,
  };

  const serialized = JSON.stringify(blob);

  // Threshold gate: only override if existing is `other` AND new is
  // non-`other` AND confidence clears the bar.
  const shouldUpgrade =
    existing.recordType === "other" &&
    result.recordType !== "other" &&
    result.confidence >= threshold;

  const next: { recordType?: string; extractedData: string } = {
    extractedData: serialized,
  };
  if (shouldUpgrade) {
    next.recordType = result.recordType;
  }

  await db
    .update(medicalRecords)
    .set(next)
    .where(eq(medicalRecords.id, recordId));

  return {
    recordType: next.recordType ?? existing.recordType,
    extractedData: serialized,
  };
}