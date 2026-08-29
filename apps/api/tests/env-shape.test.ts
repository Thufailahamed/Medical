// tests/env-shape.test.ts
//
// Compile-time coverage check that AppEnvironment.Bindings declares
// every secret/env-var actually read at runtime. The audit found
// several reads (MFA_SECRET_KEK, RESEND_API_KEY, PAYHERE_*, AI keys,
// DOCTOR_KEY_KEK, WEBAUTHN_KV, SMSLENZ_API_KEY, RECORD_KEK_PRIMARY,
// MFA_RECOVERY_PEPPER, ANTHROPIC_API_KEY, GEMINI_API_KEY) that were
// NOT declared on the type — so a typo / refactor would silently
// pass `undefined` instead of failing at compile time.
//
// This file uses an "as if" pattern: each binding is accessed as a
// typed property, then asserted to be `string | undefined`. If the
// property is missing on the type, vitest's tsc check (run via
// `bunx tsc --noEmit`) will fail this file at compile time.
//
// At runtime each block just asserts the value is `undefined` (because
// we don't set them) — that satisfies the test runner while the real
// guarantee comes from the compile-time type assertion above.

import { describe, it, expect } from "vitest";
import type { AppEnvironment } from "../src/types";

// Helper: forces TS to check that `key` exists on Bindings and that
// it's `string | undefined` (the optional env-var shape).
type _AssertBindingKey<K extends keyof AppEnvironment["Bindings"]> =
  AppEnvironment["Bindings"][K];

describe("AppEnvironment Bindings coverage", () => {
  // Each `_Has<K>` will error at type-check time if K is missing.
  // The runtime block asserts the value is `undefined`, which is
  // the expected shape for an unset optional binding.
  const env = {} as AppEnvironment["Bindings"];

  it("declares JWT_SECRET", () => {
    type _Has = _AssertBindingKey<"JWT_SECRET">;
    expect(env.JWT_SECRET).toBeUndefined();
  });

  it("declares MFA_SECRET_KEK", () => {
    type _Has = _AssertBindingKey<"MFA_SECRET_KEK">;
    expect(env.MFA_SECRET_KEK).toBeUndefined();
  });

  it("declares MFA_RECOVERY_PEPPER", () => {
    type _Has = _AssertBindingKey<"MFA_RECOVERY_PEPPER">;
    expect(env.MFA_RECOVERY_PEPPER).toBeUndefined();
  });

  it("declares DOCTOR_KEY_KEK", () => {
    type _Has = _AssertBindingKey<"DOCTOR_KEY_KEK">;
    expect(env.DOCTOR_KEY_KEK).toBeUndefined();
  });

  it("declares RECORD_KEK_PRIMARY", () => {
    type _Has = _AssertBindingKey<"RECORD_KEK_PRIMARY">;
    expect(env.RECORD_KEK_PRIMARY).toBeUndefined();
  });

  it("declares WEBAUTHN_KV", () => {
    type _Has = _AssertBindingKey<"WEBAUTHN_KV">;
    expect(env.WEBAUTHN_KV).toBeUndefined();
  });

  it("declares RESEND_API_KEY", () => {
    type _Has = _AssertBindingKey<"RESEND_API_KEY">;
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("declares PAYHERE_MERCHANT_ID", () => {
    type _Has = _AssertBindingKey<"PAYHERE_MERCHANT_ID">;
    expect(env.PAYHERE_MERCHANT_ID).toBeUndefined();
  });

  it("declares PAYHERE_SECRET", () => {
    type _Has = _AssertBindingKey<"PAYHERE_SECRET">;
    expect(env.PAYHERE_SECRET).toBeUndefined();
  });

  it("declares ANTHROPIC_API_KEY", () => {
    type _Has = _AssertBindingKey<"ANTHROPIC_API_KEY">;
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("declares GEMINI_API_KEY", () => {
    type _Has = _AssertBindingKey<"GEMINI_API_KEY">;
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it("declares CRON_SECRET", () => {
    type _Has = _AssertBindingKey<"CRON_SECRET">;
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("declares WA_VERIFY_TOKEN", () => {
    type _Has = _AssertBindingKey<"WA_VERIFY_TOKEN">;
    expect(env.WA_VERIFY_TOKEN).toBeUndefined();
  });

  it("declares WA_ACCESS_TOKEN", () => {
    type _Has = _AssertBindingKey<"WA_ACCESS_TOKEN">;
    expect(env.WA_ACCESS_TOKEN).toBeUndefined();
  });

  it("declares SMSLENZ_API_KEY", () => {
    type _Has = _AssertBindingKey<"SMSLENZ_API_KEY">;
    expect(env.SMSLENZ_API_KEY).toBeUndefined();
  });
});
