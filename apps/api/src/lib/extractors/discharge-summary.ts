// @ts-nocheck
//
// Discharge summary extractor.
//
// Discharge summaries are usually printed PDFs with a reliable text layer.
// Text-first. Vision only as a fallback when the PDF text layer is too thin.

import {
  dischargeExtractionSchema,
  type DischargeExtraction,
} from "@healthcare/shared/extractors";
import { runExtractor, type ExtractorInput, type ExtractionResult } from "./runner";

const SYSTEM_PROMPT = `You are a careful medical data extraction assistant.
You receive the full text of a hospital discharge summary.
Extract the structured clinical event. Return ONLY JSON matching this exact shape:

{
  "admissionDate": "YYYY-MM-DD" or empty string,
  "dischargeDate": "YYYY-MM-DD" or empty string,
  "primaryDiagnosis": "Main diagnosis at discharge" or empty string,
  "secondaryDiagnoses": ["List of other diagnoses mentioned"],
  "procedures": [{ "name": "Procedure name", "date": "YYYY-MM-DD or empty" }],
  "medicationsGiven": [
    { "name": "Drug name", "dosage": "500 mg" or empty, "duration": "5 days" or empty }
  ],
  "followUpInstructions": "Free text instructions given at discharge",
  "followUpDate": "YYYY-MM-DD" or empty string,
  "hospitalName": "Hospital name" or empty string,
  "attendingDoctor": "Dr. ABC" or empty string
}

Rules:
- Capture the PRIMARY diagnosis only in primaryDiagnosis; put the rest in secondaryDiagnoses.
- procedures: include any surgical / interventional procedure done during the stay.
- medicationsGiven: medications administered during the stay (NOT new prescriptions).
- Empty fields → empty string or [].
- Do NOT include commentary, prose, or markdown. Output ONLY the JSON.`;

function buildUserText(text: string): string {
  return `Discharge summary text (first 8000 chars):\n\n${text.slice(0, 8000)}`;
}

function buildUserVision(b64: string, text: string): any[] {
  // Vision fallback when text is too thin — show the image + a hint.
  return [
    { type: "text" as const, text: `OCR text (may be partial):\n${text.slice(0, 1500)}` },
    { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } },
  ];
}

export async function extractDischargeSummary(
  env: { AI: any; R2: any },
  input: ExtractorInput,
): Promise<ExtractionResult> {
  const result = await runExtractor(env, input, {
    kind: "discharge_summary",
    schema: dischargeExtractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    buildUserText,
    buildUserVision,
  });
  if (!result.ok) return result;
  const payload = result.payload as DischargeExtraction;
  return {
    ...result,
    payload: {
      ...payload,
      secondaryDiagnoses: (payload.secondaryDiagnoses || []).filter(Boolean).slice(0, 40),
      procedures: (payload.procedures || []).filter((p) => p?.name).slice(0, 50),
      medicationsGiven: (payload.medicationsGiven || []).filter((m) => m?.name).slice(0, 80),
    },
  };
}