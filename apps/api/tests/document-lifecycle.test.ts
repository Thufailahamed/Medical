// tests/document-lifecycle.test.ts
// Guards perfect-lifecycle hardening: rate limits, tenant guard, quotas.

import { describe, it, expect } from "vitest";
import { checkRateLimit, LIMITS, PATIENT_QUOTA_BYTES } from "../src/lib/rate-limit";
import { assertTenantAccess } from "../src/lib/tenant-guard";

describe("rate limits", () => {
  it("allows up to max then blocks", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("has sane production limits", () => {
    expect(LIMITS.uploadPerHour).toBeLessThanOrEqual(30);
    expect(LIMITS.sharePerHour).toBeLessThanOrEqual(20);
    expect(PATIENT_QUOTA_BYTES).toBe(1024 * 1024 * 1024);
  });
});

describe("tenant guard", () => {
  it("allows when no active hospital", () => {
    const c = { get: () => null };
    expect(assertTenantAccess({ hospitalId: "h1" }, c).allowed).toBe(true);
  });
  it("denies cross-hospital records", () => {
    const c = { get: (k: string) => (k === "activeHospitalId" ? "hA" : null) };
    expect(assertTenantAccess({ hospitalId: "hB" }, c)).toEqual({
      allowed: false,
      reason: "tenant_mismatch",
    });
  });
  it("allows same-hospital and legacy null-hospital records", () => {
    const c = { get: (k: string) => (k === "activeHospitalId" ? "hA" : null) };
    expect(assertTenantAccess({ hospitalId: "hA" }, c).allowed).toBe(true);
    expect(assertTenantAccess({ hospitalId: null }, c).allowed).toBe(true);
  });
});
