// tests/middleware-fail-closed.test.ts
//
// Verifies the three middlewares that read JWT_SECRET now refuse to
// fall back to the public hard-coded default when running in a
// production-like environment. Misconfigured prod deploys must NOT
// silently accept tokens signed with the dev fallback key.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware } from "../src/middleware/auth";
import { requirePasskeyFresh } from "../src/middleware/stepup";
import { tenantContextMiddleware } from "../src/middleware/tenant-context";
import { MockD1 } from "./_mockDb";
import type { AppEnvironment } from "../src/types";

const DEV_FALLBACK_KEY = "super-secret-key-change-me-in-prod";

async function tokenSignedWith(secret: string, userId = "u1"): Promise<string> {
  return sign(
    {
      sub: userId,
      aud: "mobile",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    secret,
  );
}

describe("authMiddleware fail-closed when JWT_SECRET missing in prod", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [
      { id: "u1", role: "patient", email: "u1@test.local", name: "U1" },
    ]);
  });

  it("returns 503 server_misconfigured when prod env has no JWT_SECRET", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "production", DEV_MODE: "false" } as any;
      c.set("db", db as any);
      c.set("locale", "en" as any);
      await next();
    });
    app.use("*", authMiddleware);
    app.get("/probe", (c) => c.json({ ok: true }));

    // Even a token signed with the legacy dev fallback must be rejected.
    const tok = await tokenSignedWith(DEV_FALLBACK_KEY);
    const res = await app.request("/probe", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.reason).toBe("missing_in_production");
    expect(body.error).toMatch(/misconfigured/i);
  });

  it("rejects when ENVIRONMENT=prod (alias) and no JWT_SECRET", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "prod", DEV_MODE: "false" } as any;
      c.set("db", db as any);
      c.set("locale", "en" as any);
      await next();
    });
    app.use("*", authMiddleware);
    app.get("/probe", (c) => c.json({ ok: true }));

    const tok = await tokenSignedWith(DEV_FALLBACK_KEY);
    const res = await app.request("/probe", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(503);
  });

  it("accepts a real secret in production", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "production", JWT_SECRET: "real-secret" } as any;
      c.set("db", db as any);
      c.set("locale", "en" as any);
      await next();
    });
    app.use("*", authMiddleware);
    app.get("/probe", (c) => c.json({ ok: true }));

    const tok = await tokenSignedWith("real-secret");
    const res = await app.request("/probe", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });

  it("still accepts the legacy fallback in development (back-compat)", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "development" } as any; // no JWT_SECRET
      c.set("db", db as any);
      c.set("locale", "en" as any);
      await next();
    });
    app.use("*", authMiddleware);
    app.get("/probe", (c) => c.json({ ok: true }));

    const tok = await tokenSignedWith(DEV_FALLBACK_KEY);
    const res = await app.request("/probe", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    expect(res.status).toBe(200);
  });
});

describe("requirePasskeyFresh fail-closed when JWT_SECRET missing in prod", () => {
  it("returns 503 server_misconfigured when prod env has no JWT_SECRET", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "production" } as any;
      c.set("db", new MockD1() as any);
      c.set("locale", "en" as any);
      // Simulate that authMiddleware already ran and set dbUser.
      c.set("dbUser", { id: "u1" } as any);
      await next();
    });
    app.use("*", requirePasskeyFresh);
    app.get("/probe", (c) => c.json({ ok: true }));

    // Send a token signed with the legacy fallback to simulate
    // previous behaviour — must now be rejected in prod.
    const { issueStepUpToken } = await import("../src/middleware/stepup");
    const tok = issueStepUpToken({ env: { JWT_SECRET: DEV_FALLBACK_KEY } as any, req: { header: () => undefined } } as any, "u1");
    const res = await app.request("/probe", {
      headers: { "X-Stepup-Token": tok },
    });
    expect(res.status).toBe(503);
  });
});

describe("tenantContextMiddleware fail-closed when JWT_SECRET missing in prod", () => {
  it("returns 503 when fallback JWT path triggers in prod with no JWT_SECRET", async () => {
    const db = new MockD1();
    db.seed("users", [
      { id: "u1", role: "patient", email: "u1@test.local", name: "U1" },
    ]);
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = { ENVIRONMENT: "production" } as any;
      c.set("db", db as any);
      c.set("locale", "en" as any);
      // Deliberately do NOT set userId so the inline fallback path
      // is forced. The middleware reads the JWT_SECRET then.
      await next();
    });
    app.use("*", tenantContextMiddleware);
    app.get("/probe", (c) => c.json({ ok: true }));

    const tok = await tokenSignedWith(DEV_FALLBACK_KEY);
    const res = await app.request("/probe", {
      headers: {
        Authorization: `Bearer ${tok}`,
        "x-active-hospital-id": "h-1",
      },
    });
    // Inline fallback runs and fails-closed → 503.
    expect(res.status).toBe(503);
  });
});
