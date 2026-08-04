// @ts-nocheck
//
// Unit test for the lab-report extractor. Mocks `aiComplete` to return
// the exact JSON the LLM would emit for the user's "Blood Report.pdf"
// example, then asserts the normalised payload matches what the
// pipeline writes into `lab_test_results`.

import { describe, it, expect, mock } from "bun:test";

// Mock the LLM layer BEFORE the extractor imports it.
const llmMock = mock(async () =>
  JSON.stringify({
    reportType: "Complete Blood Count + Lipid Panel",
    provider: "ABC Laboratory",
    collectedAt: "2026-07-14",
    reportedAt: "2026-07-14",
    tests: [
      { name: "Hemoglobin", value: 13.8, unit: "g/dL", flag: "unknown" },
      { name: "HbA1c", value: 5.6, unit: "%", flag: "unknown" },
      { name: "LDL", value: 122, unit: "mg/dL", flag: "unknown" },
      { name: "HDL", value: 48, unit: "mg/dL", flag: "unknown" },
      { name: "Triglycerides", value: 134, unit: "mg/dL", flag: "unknown" },
    ],
  })
);

// Comprehensive mock — covers every export the rest of the codebase
// transitively pulls in via `../lib/ai` or `../../routes/ai`.
const aiStub = {
  aiComplete: llmMock,
  aiVisionComplete: async () => "",
  streamAiComplete: async function* () {},
  fetchR2Text: async () =>
    "Document: Laboratory Report\nDate: 14 July 2026\nProvider: ABC Laboratory\nTest      Result\nHemoglobin 13.8\nHbA1c 5.6\nLDL 122\nHDL 48\nTriglycerides 134",
  fetchR2Base64: async () => "",
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

const { extractLabReport } = await import("../src/lib/extractors/lab-report");

describe("extractLabReport", () => {
  it("extracts 5 typed rows from the user's blood report example", async () => {
    const result = await extractLabReport(
      { AI: {} as any, R2: {} as any },
      {
        recordId: "rec-1",
        patientId: "pat-1",
        fileUrl: "lab-pdf",
        mimeType: "application/pdf",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.modelVersion).toContain("gemini");

    const payload = result.payload as any;
    expect(payload.provider).toBe("ABC Laboratory");
    expect(payload.reportedAt).toBe("2026-07-14");
    expect(payload.tests.length).toBe(5);

    const names = payload.tests.map((t: any) => t.name);
    expect(names).toContain("Hemoglobin");
    expect(names).toContain("HbA1c");
    expect(names).toContain("LDL");
    expect(names).toContain("HDL");
    expect(names).toContain("Triglycerides");

    const hba1c = payload.tests.find((t: any) => t.name === "HbA1c");
    expect(hba1c._valueNumber).toBe(5.6);
    expect(hba1c.unit).toBe("%");

    const ldl = payload.tests.find((t: any) => t.name === "LDL");
    expect(ldl._valueNumber).toBe(122);
  });

  it("drops tests with no value", async () => {
    llmMock.mockImplementationOnce(async () =>
      JSON.stringify({
        reportType: "",
        provider: "",
        collectedAt: "",
        reportedAt: "",
        tests: [
          { name: "Hemoglobin", value: 13.8 },
          { name: "NoValue", value: "" },
          { name: "Blank", value: "   " },
        ],
      }),
    );
    const result = await extractLabReport(
      { AI: {} as any, R2: {} as any },
      { recordId: "rec-2", patientId: "pat-2", fileUrl: "x", mimeType: "application/pdf" },
    );
    expect(result.ok).toBe(true);
    const tests = (result.payload as any).tests;
    expect(tests.length).toBe(1);
    expect(tests[0].name).toBe("Hemoglobin");
  });

  it("keeps non-numeric values as valueText", async () => {
    llmMock.mockImplementationOnce(async () =>
      JSON.stringify({
        reportType: "",
        provider: "",
        collectedAt: "",
        reportedAt: "",
        tests: [
          { name: "Pregnancy Test", value: "Positive", unit: "" },
        ],
      }),
    );
    const result = await extractLabReport(
      { AI: {} as any, R2: {} as any },
      { recordId: "rec-3", patientId: "pat-3", fileUrl: "x", mimeType: "application/pdf" },
    );
    const t = (result.payload as any).tests[0];
    expect(t._valueText).toBe("Positive");
    expect(t._valueNumber).toBeUndefined();
  });
});
