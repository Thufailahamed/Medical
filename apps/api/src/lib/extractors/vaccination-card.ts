// @ts-nocheck
//
// Vaccination card extractor.
//
// Vaccination cards are usually images (a phone snap of a paper card).
// Vision-first. Each entry becomes one row in `vaccination_doses`.

import {
  vaccinationExtractionSchema,
  type VaccinationExtraction,
} from "@healthcare/shared/extractors";
import { runExtractor, type ExtractorInput, type ExtractionResult } from "./runner";

const SYSTEM_PROMPT = `You are a careful medical data extraction assistant.
You receive a vaccination card (image or text). Extract EVERY dose on the card.
Return ONLY JSON matching this exact shape:

{
  "vaccinations": [
    {
      "vaccineName": "BCG" or "MMR" or "Hepatitis B" or "Influenza" or "Tetanus" or ...,
      "date": "YYYY-MM-DD" or empty string,
      "doseNumber": 1 or 2 or 3 or null,
      "provider": "Hospital/clinic name" or empty string,
      "batchNumber": "Batch/lot number" or empty string,
      "loincCode": "CVX code if visible" or empty string
    }
  ]
}

Rules:
- Read the card top-to-bottom, left-to-right. Capture every dose, not just the latest.
- Common vaccines include BCG, OPV, IPV, Pentavalent, MMR, Hepatitis B, DPT,
  HPV, Influenza, COVID-19, Pneumococcal, Rotavirus, Typhoid, Rabies, Tetanus.
- If doseNumber is not printed (e.g. childhood schedule), leave it null.
- Empty fields → empty string or null.
- Do NOT include commentary, prose, or markdown. Output ONLY the JSON.`;

function buildUserText(text: string): string {
  return `Vaccination card text (first 4000 chars):\n\n${text.slice(0, 4000)}`;
}

function buildUserVision(b64: string, _text: string): any[] {
  return [
    { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${b64}` } },
  ];
}

export async function extractVaccinationCard(
  env: { AI: any; R2: any },
  input: ExtractorInput,
): Promise<ExtractionResult> {
  const result = await runExtractor(env, input, {
    kind: "vaccination",
    schema: vaccinationExtractionSchema,
    systemPrompt: SYSTEM_PROMPT,
    buildUserText,
    buildUserVision,
    preferVision: true,
  });
  if (!result.ok) return result;
  const payload = result.payload as VaccinationExtraction;
  return {
    ...result,
    payload: {
      vaccinations: (payload.vaccinations || [])
        .filter((v) => v?.vaccineName)
        .slice(0, 80),
    },
  };
}