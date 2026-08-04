// @ts-nocheck
//
// Unit tests for the imaging-report, discharge-summary, vaccination-card,
// and prescription extractors. Same mock-module strategy as the lab test.

import { describe, it, expect, mock } from "bun:test";

let nextLlmResponse = "";
function setLlm(payload: string | object) {
  nextLlmResponse = typeof payload === "string" ? payload : JSON.stringify(payload);
}

const aiStub = {
  aiComplete: mock(async () => nextLlmResponse),
  aiVisionComplete: mock(async () => nextLlmResponse),
  streamAiComplete: async function* () {},
  fetchR2Text: async () => "scanned report text",
  fetchR2Base64: async () => "iVBORw0KGgo=",
  cacheGet: async () => null,
  cacheStore: async () => {},
  recordAiCall: async () => {},
  tryParseJson: (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  },
  hasShape: (parsed: any) => parsed,
  systemPrompt: (r: string) => r,
  fallbackOcr: () => ({ medicines: [], doctor: "", date: "", diagnosis: "" }),
  fallbackSoapDraft: () => ({}),
  fallbackSummary: () => ({}),
  fallbackLabExplain: () => ({}),
  fallbackDrugCheck: () => ({}),
  fallbackChat: () => "",
  fallbackVaccinationCardOcr: () => ({ vaccinations: [], raw: [] }),
  fallbackClinicalNoteSummary: () => ({ summary: "", soap: {}, keyTerms: [] }),
  fallbackSuggestRecordType: () => ({ recordType: "other", confidence: 0, reasoning: "" }),
  fallbackLabTrend: () => ({}),
  findStaticInteractions: () => [],
  redactMessages: (m: any) => m,
  redactPii: (s: string) => s,
  collectStream: async () => "",
};

mock.module("../src/lib/ai", () => aiStub);
mock.module("../src/lib/ai.ts", () => aiStub);
mock.module("../src/routes/ai", () => ({
  extractR2Key: (s: string) => s,
}));
mock.module("../src/routes/ai.ts", () => ({
  extractR2Key: (s: string) => s,
}));

const { extractImagingReport } = await import("../src/lib/extractors/imaging-report");
const { extractDischargeSummary } = await import("../src/lib/extractors/discharge-summary");
const { extractVaccinationCard } = await import("../src/lib/extractors/vaccination-card");
const { extractPrescription } = await import("../src/lib/extractors/prescription");

describe("extractImagingReport", () => {
  it("parses chest X-ray report", async () => {
    setLlm({
      modality: "X-Ray",
      bodyPart: "Chest",
      studyDate: "2026-06-01",
      radiologistName: "Dr. Perera",
      findings: "Hyperlucent right lung field with visible visceral pleural line. No mediastinal shift.",
      impression: "Right-sided pneumothorax, approximately 20%.",
      recommendations: "Urgent chest tube insertion. Repeat CXR after.",
      critical: true,
    });
    const result = await extractImagingReport(
      { AI: {} as any, R2: {} as any },
      { recordId: "img-1", patientId: "pat-1", fileUrl: "img.jpg", mimeType: "image/jpeg" },
    );
    expect(result.ok).toBe(true);
    const p = result.payload as any;
    expect(p.modality).toBe("X-Ray");
    expect(p.bodyPart).toBe("Chest");
    expect(p.impression).toContain("pneumothorax");
    // Pipeline enforces the keyword guard; the extractor just surfaces LLM's critical flag.
    expect(p.critical).toBe(true);
  });
});

describe("extractDischargeSummary", () => {
  it("parses a typical MI admission", async () => {
    setLlm({
      admissionDate: "2026-07-01",
      dischargeDate: "2026-07-05",
      primaryDiagnosis: "Acute ST-elevation myocardial infarction (STEMI)",
      secondaryDiagnoses: ["Hypertension", "Type 2 Diabetes"],
      procedures: [{ name: "Primary PCI with drug-eluting stent to LAD", date: "2026-07-01" }],
      medicationsGiven: [
        { name: "Aspirin", dosage: "300 mg", duration: "loading dose" },
        { name: "Clopidogrel", dosage: "600 mg", duration: "loading dose" },
      ],
      followUpInstructions: "Cardiology OPD in 2 weeks. Continue dual antiplatelet therapy.",
      followUpDate: "2026-07-19",
      hospitalName: "National Hospital",
      attendingDoctor: "Dr. Fernando",
    });
    const result = await extractDischargeSummary(
      { AI: {} as any, R2: {} as any },
      { recordId: "dis-1", patientId: "pat-2", fileUrl: "discharge.pdf", mimeType: "application/pdf" },
    );
    expect(result.ok).toBe(true);
    const p = result.payload as any;
    expect(p.primaryDiagnosis).toContain("STEMI");
    expect(p.procedures.length).toBe(1);
    expect(p.procedures[0].name).toContain("PCI");
    expect(p.medicationsGiven.length).toBe(2);
    expect(p.attendingDoctor).toBe("Dr. Fernando");
  });
});

describe("extractVaccinationCard", () => {
  it("parses a childhood schedule", async () => {
    setLlm({
      vaccinations: [
        { vaccineName: "BCG", date: "2020-01-15", doseNumber: 1, provider: "PHI Colombo" },
        { vaccineName: "Pentavalent", date: "2020-03-15", doseNumber: 1 },
        { vaccineName: "Pentavalent", date: "2020-05-15", doseNumber: 2 },
        { vaccineName: "MMR", date: "2021-03-10", doseNumber: 1 },
      ],
    });
    const result = await extractVaccinationCard(
      { AI: {} as any, R2: {} as any },
      { recordId: "vac-1", patientId: "pat-3", fileUrl: "card.jpg", mimeType: "image/jpeg" },
    );
    expect(result.ok).toBe(true);
    const p = result.payload as any;
    expect(p.vaccinations.length).toBe(4);
    expect(p.vaccinations.map((v: any) => v.vaccineName)).toEqual([
      "BCG",
      "Pentavalent",
      "Pentavalent",
      "MMR",
    ]);
  });

  it("caps vaccinations at the schema's max array size", async () => {
    // Build 90 entries — schema enforces .max(80), so the runner will surface
    // a validation error. We verify the extractor surfaces the schema error
    // rather than silently dropping rows.
    const tooMany = Array.from({ length: 90 }, (_, i) => ({
      vaccineName: `Vaccine-${i}`,
      date: "2024-01-01",
    }));
    setLlm({ vaccinations: tooMany });
    const result = await extractVaccinationCard(
      { AI: {} as any, R2: {} as any },
      { recordId: "vac-2", patientId: "pat-4", fileUrl: "card2.jpg", mimeType: "image/jpeg" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("schema_validation_failed");
  });
});

describe("extractPrescription", () => {
  it("parses a multi-drug prescription", async () => {
    setLlm({
      medicines: [
        { name: "Metformin", dosage: "500 mg", frequency: "BID", timing: "After meals", durationDays: 30, refills: 3 },
        { name: "Atorvastatin", dosage: "20 mg", frequency: "Once daily", timing: "Bedtime", durationDays: 30, refills: 3 },
        { name: "Aspirin", dosage: "75 mg", frequency: "Once daily", timing: "After breakfast", durationDays: null, refills: null },
      ],
      doctor: "Dr. Jayawardena",
      date: "2026-07-14",
      diagnosis: "Type 2 Diabetes Mellitus with dyslipidemia",
    });
    const result = await extractPrescription(
      { AI: {} as any, R2: {} as any },
      { recordId: "rx-1", patientId: "pat-5", fileUrl: "rx1.jpg", mimeType: "image/jpeg" },
    );
    expect(result.ok).toBe(true);
    const p = result.payload as any;
    expect(p.medicines.length).toBe(3);
    expect(p.doctor).toBe("Dr. Jayawardena");
    expect(p.date).toBe("2026-07-14");
    const metformin = p.medicines.find((m: any) => m.name === "Metformin");
    expect(metformin.frequency).toBe("BID");
    expect(metformin.durationDays).toBe(30);
  });
});