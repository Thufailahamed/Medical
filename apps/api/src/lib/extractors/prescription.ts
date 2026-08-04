// @ts-nocheck
//
// Prescription (PDF/scan) extractor.
//
// Prescriptions are usually printed or handwritten PDFs/photos. Vision-first
// since handwritten Rx are common. Output: { medicines[], doctor, date,
// diagnosis }. Each medicine becomes one row in `prescription_items`.

import {
  prescriptionExtractionSchema,
  type PrescriptionExtraction,
} from "@healthcare/shared/extractors";
import { runExtractor, type ExtractorInput, type ExtractionResult } from "./runner";

const SYSTEM_PROMPT = `You are a careful medical data extraction assistant.
You receive a prescription document (image or text). Extract EVERY medication listed.
Return ONLY JSON matching this exact shape:

{
  "medicines": [
    {
      "name": "Metformin",
      "dosage": "500 mg" or empty string,
      "frequency": "Twice daily" or "BID" or empty string,
      "timing": "After meals" or "Morning" or empty string,
      "durationDays": 30 or null,
      "refills": 0 or null
    }
  ],
  "doctor": "Dr. ABC" or empty string,
  "date": "YYYY-MM-DD" or empty string,
  "diagnosis": "Type 2 Diabetes" or empty string
}

Rules:
- Capture EVERY drug on the prescription. Multi-drug Rx are common.
- dosage: extract the per-dose amount (e.g. "500 mg", "1 tablet", "10 units").
- frequency: e.g. "Once daily" / "BID" / "TID" / "QID" / "PRN" / "Every 8 hours".
- durationDays: integer if printed (e.g. "for 30 days" → 30). null otherwise.
- refills: integer if printed. null otherwise.
- timing: e.g. "Before meals", "At bedtime".
- doctor: the prescribing doctor's name. If only initials, capture them.
- Empty fields → empty string or null.
- Do NOT include commentary, prose, or markdown. Output ONLY the JSON.`;

function buildUserText(text: string): string {
  return `Prescription text (first 6000 chars):\n\n${text.slice(0, 6000)}`;
}

function buildUserVision(b64: string, text: string): any[] {
  // Vision-first: include both the image and any text hint. Handwritten Rx
  // benefit from the image; the OCR text helps when present.
  return [
    { type: "text" as const, text: `OCR text (may be partial):\n${text.slice(0, 1500)}` },
    { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } },
  ];
}

export async function extractPrescription(
  env: { AI: any; R2: any },
  input: ExtractorInput,
): Promise<ExtractionResult> {
  const result = await runExtractor(env, input, {
    kind: "prescription",
    schema: prescriptionExtractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    buildUserText,
    buildUserVision,
    preferVision: true,
  });
  if (!result.ok) return result;
  const payload = result.payload as PrescriptionExtraction;
  return {
    ...result,
    payload: {
      ...payload,
      medicines: (payload.medicines || []).filter((m) => m?.name).slice(0, 40),
    },
  };
}