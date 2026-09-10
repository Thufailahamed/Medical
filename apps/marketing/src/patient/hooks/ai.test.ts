import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLEAR_MESSAGE,
  normalizeInteractions,
  normalizeSummary,
  type DrugInteractionItem,
} from "./ai";

describe("normalizeSummary", () => {
  it("wraps plain-string responses", () => {
    expect(normalizeSummary({ summary: "Stable" })).toEqual({
      patientSummary: "Stable",
    });
  });

  it("keeps structured fields and defaults missing arrays", () => {
    const out = normalizeSummary({
      summary: { patientSummary: "Hi", diagnoses: ["T2DM"] },
    });
    expect(out.diagnoses).toEqual(["T2DM"]);
    expect(out.risks).toEqual([]);
    expect(out.history).toEqual([]);
  });

  it("falls back when patientSummary is missing", () => {
    expect(
      normalizeSummary({ summary: {} as never }).patientSummary,
    ).toBe("Health record summary generated successfully.");
  });
});

describe("normalizeInteractions", () => {
  const items: DrugInteractionItem[] = [
    { medicines: ["Warfarin", "Aspirin"], severity: "severe", note: "Bleeding risk" },
  ];

  it("keeps an array payload", () => {
    expect(normalizeInteractions({ interactions: items })).toEqual({
      items,
      message: null,
    });
  });

  it("parses a JSON-string interactions payload", () => {
    expect(normalizeInteractions({ interactions: JSON.stringify(items) }).items).toEqual(items);
  });

  it("parses a JSON result object with nested interactions", () => {
    expect(
      normalizeInteractions({ result: JSON.stringify({ interactions: items }) }).items,
    ).toEqual(items);
  });

  it("returns plain-text results as a clean message", () => {
    expect(normalizeInteractions({ result: "No interactions found." }).message).toBe(
      "No interactions found.",
    );
  });

  it("returns the default clear message for malformed JSON results", () => {
    expect(normalizeInteractions({ result: "[{bad json" }).message).toBe(
      DEFAULT_CLEAR_MESSAGE,
    );
  });

  it("returns the default clear message when nothing parses", () => {
    expect(normalizeInteractions({}).message).toBe(DEFAULT_CLEAR_MESSAGE);
  });
});
