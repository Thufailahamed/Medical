// @ts-nocheck
//
// Imaging report extractor.
//
// Vision-first: X-rays/CT/MRI are usually DICOM images or scanned PDFs.
// The LLM returns modality, body part, study date, and the radiologist's
// findings / impression / recommendations. We pass `preferVision: true`
// so the runner routes to the vision model even when the PDF has a
// text layer (the text layer on imaging PDFs is usually image captions,
// not the report body).
//
// `critical` is NOT trusted at face value — the pipeline guard requires
// a keyword whitelist hit in findings/impression before persisting it.

import { imagingExtractionSchema, type ImagingExtraction } from "@healthcare/shared/extractors";
import { runExtractor, type ExtractorInput, type ExtractionResult } from "./runner";

const SYSTEM_PROMPT = `You are a careful medical data extraction assistant.
You receive a radiology / imaging report (text or image).
Extract EVERY relevant finding. Return ONLY JSON matching this exact shape:

{
  "modality": "X-Ray" | "CT" | "MRI" | "Ultrasound" | "Mammogram" | "PET" | "DEXA" | "Other",
  "bodyPart": "Chest" | "Abdomen" | "Brain" | "Knee" | ... (free text ok),
  "studyDate": "YYYY-MM-DD" or empty string,
  "radiologistName": "Dr. ABC" or empty string,
  "findings": "Free-text paragraph of everything observed",
  "impression": "Short summary / conclusion paragraph",
  "recommendations": "Follow-up actions" or empty string,
  "critical": true | false
}

Rules:
- Capture the radiologist's full impression, not a paraphrase.
- "critical": true ONLY if the report explicitly states an urgent/life-threatening finding
  (e.g. intracranial hemorrhage, pneumothorax, pulmonary embolism, aortic dissection,
   ectopic pregnancy, testicular torsion, bowel perforation, retinal detachment,
   acute stroke, displaced fracture, or a new malignancy mass). Default to false.
- For non-radiology scans (e.g. DEXA bone density), still capture modality + impression.
- Empty fields → empty string.
- Do NOT include commentary, prose, or markdown. Output ONLY the JSON.`;

function buildUserText(text: string): string {
  return `Imaging report text (first 6000 chars):\n\n${text.slice(0, 6000)}`;
}

function buildUserVision(b64: string, _text: string): any[] {
  return [
    { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } },
  ];
}

export async function extractImagingReport(
  env: { AI: any; R2: any },
  input: ExtractorInput,
): Promise<ExtractionResult> {
  return runExtractor(env, input, {
    kind: "imaging",
    schema: imagingExtractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    buildUserText,
    buildUserVision,
    preferVision: true,
  });
}