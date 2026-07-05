// tests/records-registry.test.ts
//
// Phase v3: registry shape + consent helpers. Pure functions; no DB.

import { describe, it, expect } from "vitest";
import {
  RECORD_REGISTRY,
  RECORD_KINDS,
  CONSENT_PURPOSES,
  PURPOSE_REGISTRY,
  purposeAllowsKind,
  classifyConsent,
  redactEnvelopeForPurpose,
  recordUploadEnvelopeSchema,
  issueConsentSchema,
  dsarRequestSchema,
  RECORD_SCHEMA_VERSION,
  ENVELOPE_VERSION,
} from "@healthcare/shared/records";

describe("records registry", () => {
  it("every kind has a registry entry", () => {
    for (const k of RECORD_KINDS) {
      expect(RECORD_REGISTRY[k]).toBeTruthy();
      expect(RECORD_REGISTRY[k].key).toBe(k);
      expect(RECORD_REGISTRY[k].labelKey).toBe(`records.kind.${k}.label`);
    }
  });

  it("every purpose has a def", () => {
    for (const p of CONSENT_PURPOSES) {
      expect(PURPOSE_REGISTRY[p]).toBeTruthy();
      expect(PURPOSE_REGISTRY[p].defaultScope.length).toBeGreaterThan(0);
    }
  });

  it("emergency allows records_all implicitly", () => {
    expect(purposeAllowsKind("emergency", "lab_report")).toBe(true);
    expect(purposeAllowsKind("emergency", "imaging")).toBe(true);
  });

  it("lab_share is restrictive", () => {
    expect(purposeAllowsKind("lab_share", "lab_report")).toBe(true);
    expect(purposeAllowsKind("lab_share", "lab_subtest")).toBe(true);
    expect(purposeAllowsKind("lab_share", "imaging")).toBe(false);
    expect(purposeAllowsKind("lab_share", "prescription")).toBe(false);
  });

  it("classifyConsent handles states", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(classifyConsent(future, null)).toBe("active");
    expect(classifyConsent(past, null)).toBe("expired");
    expect(classifyConsent(future, new Date().toISOString())).toBe("revoked");
  });

  it("redact strips free-text for insurance/research", () => {
    const env = {
      kind: "lab_report" as const,
      title: "Chest X-ray",
      summary: "No acute findings",
      notes: "free text clinical note",
      diagnosis: "mild pneumonia",
      tags: ["chest"],
    };
    const r1 = redactEnvelopeForPurpose("insurance", env);
    expect(r1.notes).toBeUndefined();
    expect(r1.title).toBe("Chest X-ray");

    const r2 = redactEnvelopeForPurpose("research", env);
    expect(r2.notes).toBeUndefined();
    expect(r2.diagnosis).toBeUndefined();
    expect(r2.title).toBe("[redacted]");
  });

  it("schemas validate basic payloads", () => {
    expect(
      recordUploadEnvelopeSchema.safeParse({
        kind: "lab_report",
        title: "CBC",
      }).success,
    ).toBe(true);

    expect(
      recordUploadEnvelopeSchema.safeParse({
        kind: "wrong_kind",
        title: "X",
      }).success,
    ).toBe(false);

    expect(
      issueConsentSchema.safeParse({
        purpose: "family_view",
        scope: ["records_recent"],
        durationDays: 30,
      }).success,
    ).toBe(true);

    expect(
      dsarRequestSchema.safeParse({
        purpose: "rectification",
        fields: [{ recordId: "r1", field: "title", proposedValue: "Corrected" }],
      }).success,
    ).toBe(true);
  });

  it("version constants are stable", () => {
    expect(ENVELOPE_VERSION).toBe("v1");
    expect(RECORD_SCHEMA_VERSION).toBe("healthhub.record.v3");
  });
});