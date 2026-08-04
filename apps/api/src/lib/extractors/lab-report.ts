// @ts-nocheck
//
// Lab report extractor.
// Reads a lab PDF/image from R2, asks the LLM for a structured JSON
// listing every test result, then writes one row per item into
// `lab_test_results`.
//
// Example input (the user's pitch PDF):
//   Document: Laboratory Report
//   Date: 14 July 2026
//   Provider: ABC Laboratory
//   Test                 Result
//   Hemoglobin           13.8
//   HbA1c                 5.6
//   LDL                  122
//   HDL                   48
//   Triglycerides        134
//
// → 5 rows in `lab_test_results`, no reference range → `flag='unknown'`.

import { labReportExtractionSchema, type LabReportExtraction, type LabTestItem } from "@healthcare/shared/extractors";
import { runExtractor, type ExtractorInput, type ExtractionResult } from "./runner";

const SYSTEM_PROMPT = `You are a careful medical data extraction assistant.
You receive the full text (or a clear image) of a laboratory report PDF.
Extract EVERY test result listed. Return ONLY JSON matching this exact shape:

{
  "reportType": "Complete Blood Count" or similar, or empty string,
  "provider": "ABC Laboratory" or empty string,
  "collectedAt": "YYYY-MM-DD" or empty string,
  "reportedAt": "YYYY-MM-DD" or empty string,
  "tests": [
    {
      "name": "Hemoglobin",
      "value": 13.8,                 // number when possible, otherwise string ("Positive", "Reactive")
      "unit": "g/dL" or empty string,
      "refLow": 13.0 or null,        // numeric lower bound if a range is given
      "refHigh": 17.0 or null,       // numeric upper bound if a range is given
      "refText": "13.0 - 17.0 g/dL" or empty string,
      "flag": "normal" | "low" | "high" | "critical" | "abnormal" | "unknown",
      "loincCode": "" or LOINC code if visible
    }
  ]
}

Rules:
- Extract EVERY test in the report. Do not skip rows.
- If a value is numeric, return it as a JSON number (not a string).
- For non-numeric values ("Positive", "Negative", "Reactive", "Seen"), set value to the string and leave unit empty.
- Flag rules:
  - "low" if value < refLow
  - "high" if value > refHigh
  - "normal" if value is within refLow..refHigh
  - "critical" if the report explicitly marks the test as critical/panic
  - "abnormal" if the report prints H/L/+/++ markers but value still in range
  - "unknown" when no reference range was provided
- If you cannot determine a field, use empty string or null.
- Do NOT include commentary, prose, or markdown. Output ONLY the JSON.`;

function buildUserText(text: string): string {
  return `Lab report text (first 6000 chars):\n\n${text.slice(0, 6000)}`;
}

function buildUserVision(b64: string, _text: string): any[] {
  // Vision model: just the image. No text needed (the image is the source).
  // We keep the empty text hint param so the runner signature is happy.
  return [{ type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } }];
}

export async function extractLabReport(
  env: { AI: any; R2: any },
  input: ExtractorInput,
): Promise<ExtractionResult> {
  const result = await runExtractor(env, input, {
    kind: "lab_report",
    schema: labReportExtractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    buildUserText,
    buildUserVision,
  });
  if (!result.ok) return result;
  const payload = result.payload as LabReportExtraction;
  const normalised = (payload.tests || []).map((t: LabTestItem) => normaliseTest(t));
  // Drop empties — value may be set as _valueNumber / _valueText after normalise.
  const tests = normalised.filter((t) => t.name && (t._valueNumber != null || t._valueText));
  return {
    ...result,
    payload: {
      ...payload,
      tests,
    },
  };
}

function clampFlag(f: any): LabTestItem["flag"] {
  if (!f) return "unknown";
  const s = String(f).toLowerCase();
  if (["normal", "low", "high", "critical", "abnormal", "unknown"].includes(s)) {
    return s as LabTestItem["flag"];
  }
  return "unknown";
}

function normaliseTest(t: LabTestItem): LabTestItem & { _valueNumber?: number; _valueText?: string } {
  const out: any = {
    name: String(t.name || "").trim(),
    unit: t.unit ? String(t.unit).trim() : undefined,
    refLow: typeof t.refLow === "number" && isFinite(t.refLow) ? t.refLow : undefined,
    refHigh: typeof t.refHigh === "number" && isFinite(t.refHigh) ? t.refHigh : undefined,
    refText: t.refText ? String(t.refText).trim() : undefined,
    loincCode: t.loincCode ? String(t.loincCode).trim() : undefined,
    flag: clampFlag(t.flag),
  };
  if (typeof t.value === "number" && isFinite(t.value)) {
    out._valueNumber = t.value;
  } else if (typeof t.value === "string" && t.value.trim().length > 0) {
    out._valueText = t.value.trim();
  }
  return out;
}
