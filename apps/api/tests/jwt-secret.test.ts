// tests/jwt-secret.test.ts
//
// P0 fail-closed guard for JWT_SECRET. The previous behaviour silently
// fell back to a public, hard-coded default ("super-secret-key-…")
// when JWT_SECRET was missing — a misconfigured production deploy
// would accept tokens signed with that key. This helper makes the
// production environment fail closed with a 503 instead.

import { describe, it, expect } from "vitest";
import { resolveJwtSecret } from "../src/lib/jwt-secret";

describe("resolveJwtSecret", () => {
  it("returns the secret when JWT_SECRET is set regardless of environment", () => {
    expect(
      resolveJwtSecret({
        JWT_SECRET: "real-secret",
        ENVIRONMENT: "production",
      }),
    ).toEqual({ ok: true, secret: "real-secret" });

    expect(
      resolveJwtSecret({
        JWT_SECRET: "dev-secret",
        ENVIRONMENT: "development",
      }),
    ).toEqual({ ok: true, secret: "dev-secret" });
  });

  it("fails closed in production when JWT_SECRET is missing", () => {
    const result = resolveJwtSecret({
      ENVIRONMENT: "production",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_in_production");
    }
  });

  it("fails closed in prod alias when JWT_SECRET is missing", () => {
    const result = resolveJwtSecret({
      ENVIRONMENT: "prod",
    });
    expect(result.ok).toBe(false);
  });

  it("falls back to the legacy dev default in development", () => {
    const result = resolveJwtSecret({
      ENVIRONMENT: "development",
    });
    expect(result).toEqual({
      ok: true,
      secret: "super-secret-key-change-me-in-prod",
    });
  });

  it("falls back to the legacy dev default in preview when unset", () => {
    const result = resolveJwtSecret({
      ENVIRONMENT: "preview",
    });
    expect(result.ok).toBe(true);
  });

  it("treats empty-string JWT_SECRET the same as missing", () => {
    const result = resolveJwtSecret({
      JWT_SECRET: "",
      ENVIRONMENT: "production",
    });
    expect(result.ok).toBe(false);
  });

  it("treats unset ENVIRONMENT as not-production (safe-by-default for ad-hoc wrangler dev)", () => {
    const result = resolveJwtSecret({});
    expect(result.ok).toBe(true);
  });
});
