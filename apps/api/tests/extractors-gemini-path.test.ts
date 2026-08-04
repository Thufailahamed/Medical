// @ts-nocheck
//
// Verifies the extraction runner routes to Gemini when GEMINI_API_KEY is
// present in env, and that the JSON responseSchema gets sent as part of
// the request body. We stub `fetch` to capture the request and return
// a canned Gemini response.

import { describe, it, expect, mock, beforeEach } from "bun:test";

const aiStub = {
  aiComplete: mock(async () => ""),
  aiVisionComplete: mock(async () => ""),
  streamAiComplete: async function* () {},
  fetchR2Text: async () =>
    "Hemoglobin 13.8\nHbA1c 5.6\nLDL 122\nHDL 48\nTriglycerides 134",
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

const { extractLabReport } = await import("../src/lib/extractors/lab-report");

let capturedUrl: string | null = null;
let capturedBody: any = null;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  capturedUrl = null;
  capturedBody = null;
  globalThis.fetch = mock(async (url: any, init?: any) => {
    capturedUrl = String(url);
    capturedBody = init?.body ? JSON.parse(init.body) : null;
    return new Response(
      JSON.stringify({
        modelVersion: "gemini-2.5-flash",
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reportType: "Lipid + CBC",
                    provider: "ABC Lab",
                    collectedAt: "2026-07-14",
                    reportedAt: "2026-07-14",
                    tests: [
                      { name: "HbA1c", value: 5.6, unit: "%", flag: "unknown" },
                    ],
                  }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as any;
});

describe("extractor routes to Gemini when GEMINI_API_KEY is set", () => {
  it("hits generativelanguage.googleapis.com with responseSchema + JSON mime", async () => {
    const result = await extractLabReport(
      { AI: {} as any, R2: {} as any, GEMINI_API_KEY: "test-key" } as any,
      {
        recordId: "rec-1",
        patientId: "pat-1",
        fileUrl: "lab.pdf",
        mimeType: "application/pdf",
      },
    );
    expect(result.ok).toBe(true);
    expect(result.modelVersion).toContain("gemini");
    expect(capturedUrl).toContain("generativelanguage.googleapis.com");
    expect(capturedUrl).toContain("key=test-key");
    expect(capturedBody.generationConfig.responseMimeType).toBe("application/json");
    expect(capturedBody.generationConfig.responseSchema.type).toBe("object");
    expect(capturedBody.generationConfig.responseSchema.properties).toHaveProperty("tests");
    // System instruction is preserved.
    expect(capturedBody.systemInstruction.parts[0].text).toContain("extract");
  });
});

// Restore fetch after the suite.
(globalThis as any).__restoreFetch = () => {
  globalThis.fetch = originalFetch;
};