import { describe, expect, it } from "vitest";

import { EVENT_TO_QUERY_KEYS, TYPE_TO_QUERY_KEYS } from "./useRealtime";

/**
 * The patient surface invalidates on `["patient", ...]` keys. These maps
 * were written for the clinician portal, so every patient-relevant event
 * needs an explicit patient entry — otherwise a change made on mobile
 * never refreshes an open web tab, which is the whole point of mounting
 * this hook on /patient.
 */
function patientKeysIn(entries: readonly (readonly string[])[]): string[][] {
  return entries.filter((k) => k[0] === "patient").map((k) => [...k]);
}

describe("TYPE_TO_QUERY_KEYS", () => {
  it.each([
    ["appointment", ["patient", "appointments"]],
    ["medicine", ["patient", "medicines"]],
    ["medicine", ["patient", "doses"]],
    ["lab_ready", ["patient", "records"]],
    ["prescription", ["patient", "prescriptions"]],
    ["insurance", ["patient", "insurance"]],
    ["vaccination", ["patient", "vaccinations"]],
    ["emergency", ["patient", "emergency"]],
  ])("maps notification type %s to %j", (type, key) => {
    expect(patientKeysIn(TYPE_TO_QUERY_KEYS[type] ?? [])).toContainEqual(key);
  });
});

describe("EVENT_TO_QUERY_KEYS", () => {
  it.each([
    ["record", ["patient", "records"]],
    ["record", ["patient", "timeline"]],
    ["message", ["patient", "messages"]],
    ["appointment", ["patient", "appointments"]],
  ])("maps SSE event %s to %j", (event, key) => {
    expect(patientKeysIn(EVENT_TO_QUERY_KEYS[event] ?? [])).toContainEqual(key);
  });
});
