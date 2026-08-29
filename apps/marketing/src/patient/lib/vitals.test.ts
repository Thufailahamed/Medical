/**
 * Vital registry + series mapping.
 *
 * The blood-pressure case is the one that bites: the API returns
 * systolic in `value` and diastolic in `secondary`, so a naive mapper
 * silently drops half the reading.
 */
import { describe, it, expect } from "vitest";
import { VITAL_REGISTRY, toSeries, peakIndex } from "./vitals";

describe("VITAL_REGISTRY", () => {
  it("covers the four dashboard vitals with display units", () => {
    expect(VITAL_REGISTRY.heart_rate.unit).toBe("bpm");
    expect(VITAL_REGISTRY.spo2.unit).toBe("%");
    expect(VITAL_REGISTRY.temperature.unit).toBe("°C");
    expect(VITAL_REGISTRY.blood_pressure.unit).toBe("mmHg");
  });
});

describe("toSeries", () => {
  it("maps API points to chart points", () => {
    const out = toSeries([
      {
        t: "2026-08-29T06:00:00.000Z",
        value: 96,
        secondary: null,
        id: "a",
        unit: "bpm",
        context: null,
      },
      {
        t: "2026-08-29T07:00:00.000Z",
        value: 132,
        secondary: null,
        id: "b",
        unit: "bpm",
        context: null,
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      t: "2026-08-29T06:00:00.000Z",
      value: 96,
      secondary: null,
    });
    expect(out[1].value).toBe(132);
  });

  it("preserves the diastolic value for blood pressure", () => {
    const out = toSeries([
      {
        t: "2026-08-29T06:00:00.000Z",
        value: 128,
        secondary: 82,
        id: "a",
        unit: "mmHg",
        context: null,
      },
    ]);
    expect(out[0].secondary).toBe(82);
  });

  it("returns an empty array for an empty response", () => {
    expect(toSeries([])).toEqual([]);
  });
});

describe("peakIndex", () => {
  it("returns the index of the highest value", () => {
    expect(
      peakIndex([
        { t: "1", value: 96, secondary: null },
        { t: "2", value: 132, secondary: null },
        { t: "3", value: 110, secondary: null },
      ])
    ).toBe(1);
  });

  it("returns -1 for an empty series so no bar is highlighted", () => {
    expect(peakIndex([])).toBe(-1);
  });
});