import { describe, expect, it } from "vitest";

import { PATIENT_QUERY_DEFAULTS, patientKeys, rangeToFrom } from "./keys";

describe("patientKeys", () => {
  it("roots every key under 'patient' so the surface invalidates as one prefix", () => {
    const factories = Object.entries(patientKeys).filter(
      ([, v]) => typeof v === "function"
    ) as [string, (...a: never[]) => readonly string[]][];

    expect(factories.length).toBeGreaterThan(0);
    for (const [name, factory] of factories) {
      const key = (factory as (...a: unknown[]) => readonly unknown[])(
        "x",
        "week"
      );
      expect(key[0], `${name} must be rooted at "patient"`).toBe("patient");
    }
    expect(patientKeys.all).toEqual(["patient"]);
  });

  it("gives doses their own factory so dose mutations invalidate precisely", () => {
    expect(patientKeys.doses()).toEqual(["patient", "doses"]);
    expect(patientKeys.dosesToday()).toEqual(["patient", "doses", "today"]);
  });

  it("gives vitals a root factory covering series, derived and alerts", () => {
    expect(patientKeys.vitals()).toEqual(["patient", "vitals"]);
    expect(patientKeys.vitalsDerived().slice(0, 2)).toEqual([
      "patient",
      "vitals",
    ]);
    expect(patientKeys.vitalsSeries("heart_rate", "week").slice(0, 2)).toEqual([
      "patient",
      "vitals",
    ]);
  });

  it("defaults queries to a 60s staleTime with one retry", () => {
    expect(PATIENT_QUERY_DEFAULTS).toEqual({ staleTime: 60_000, retry: 1 });
  });

  it("exposes recordAttachments factory under the record prefix (SP2a)", () => {
    expect(patientKeys.recordAttachments("r1")).toEqual([
      "patient",
      "records",
      "r1",
      "attachments",
    ]);
  });

  it("recordChildren keeps its id+kind shape (SP2a first consumer)", () => {
    expect(patientKeys.recordChildren("r1", "lab_report")).toEqual([
      "patient",
      "records",
      "r1",
      "lab_report",
    ]);
  });
});

describe("rangeToFrom", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  it("subtracts 7 days for a week", () => {
    expect(rangeToFrom("week", now)).toBe("2026-08-22T12:00:00.000Z");
  });

  it("subtracts a month for a month", () => {
    expect(rangeToFrom("month", now)).toBe("2026-07-29T12:00:00.000Z");
  });

  it("subtracts three months for a quarter", () => {
    expect(rangeToFrom("quarter", now)).toBe("2026-05-29T12:00:00.000Z");
  });
});
