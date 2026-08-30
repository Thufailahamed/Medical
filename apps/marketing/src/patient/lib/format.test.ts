import { describe, it, expect } from "vitest";
import {
  formatMetric,
  formatRecordType,
  formatRelative,
  formatTime,
} from "./format";

describe("formatMetric", () => {
  it("rounds to the registry's decimal count", () => {
    expect(formatMetric(72.4, 0)).toBe("72");
    expect(formatMetric(36.66, 1)).toBe("36.7");
  });

  it("returns an em dash for null so callers never print 0 for missing data", () => {
    expect(formatMetric(null, 0)).toBe("—");
    expect(formatMetric(undefined, 1)).toBe("—");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  it("describes minutes, hours and days", () => {
    expect(formatRelative("2026-08-29T11:45:00.000Z", now)).toBe("15m ago");
    expect(formatRelative("2026-08-29T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatRelative("2026-08-27T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("says just now for anything under a minute", () => {
    expect(formatRelative("2026-08-29T11:59:40.000Z", now)).toBe("Just now");
  });

  it("returns an em dash for a null timestamp", () => {
    expect(formatRelative(null, now)).toBe("—");
  });
});

describe("formatTime", () => {
  it("renders 24h clock strings as 12h with a meridiem", () => {
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("14:30")).toBe("2:30 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
  });

  it("returns an em dash for a missing time", () => {
    expect(formatTime(null)).toBe("—");
  });
});

describe("formatRecordType", () => {
  it("maps known API enums to readable labels", () => {
    expect(formatRecordType("CLINICAL_NOTE")).toBe("Clinical note");
    expect(formatRecordType("lab_report")).toBe("Lab report");
    expect(formatRecordType("prescription")).toBe("Prescription");
  });

  it("humanizes unknown kinds", () => {
    expect(formatRecordType("custom_kind")).toBe("Custom kind");
  });
});
