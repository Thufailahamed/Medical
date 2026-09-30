// tests/admin/auth-wiring.test.ts
//
// Regression test for the mobile admin/doctor login outage:
// every /admin/* router must run `authMiddleware` BEFORE `requireAdmin`
// (requireAdmin reads c.get("dbUser")/c.get("aud"), which only
// authMiddleware populates). Without it, all admin endpoints 401 with
// "Unauthorized", the mobile api() helper fires onAuthError(), and the
// admin session is nuked back to the login screen on every dashboard
// load — surviving a refresh only as a logged-out state.
//
// Unlike the other admin tests (which stub auth via _adminTestApp to
// isolate handler logic), this file goes through the REAL middleware
// chain with signed JWTs and no setWhere("users") overrides.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { MockD1 } from "../_mockDb";
import adminRouter from "../../src/routes/admin";
import adminBulkRouter from "../../src/routes/admin-bulk";
import adminExportRouter from "../../src/routes/admin-export";
import adminWebauthnRouter from "../../src/routes/admin-webauthn";
import adminImpersonateRouter from "../../src/routes/admin-impersonate";
import adminHealthRouter from "../../src/routes/admin-health";
import type { AppEnvironment } from "../../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";
const ADMIN_ID = "admin-wiring-1";

async function adminToken(): Promise<string> {
  return sign(
    {
      sub: ADMIN_ID,
      aud: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as any,
    TEST_SECRET,
  );
}

async function mobileToken(): Promise<string> {
  return sign(
    {
      sub: ADMIN_ID,
      aud: "mobile",
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as any,
    TEST_SECRET,
  );
}

function buildWiringApp(db: MockD1) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    await next();
  });
  app.route("/admin", adminRouter);
  app.route("/admin/bulk", adminBulkRouter);
  app.route("/admin/export", adminExportRouter);
  app.route("/admin/webauthn", adminWebauthnRouter);
  app.route("/admin/impersonate", adminImpersonateRouter);
  app.route("/admin/health", adminHealthRouter);
  return app;
}

describe("admin auth wiring (real middleware chain)", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [
      {
        id: ADMIN_ID,
        role: "super_admin",
        status: "active",
        name: "Wiring Admin",
        email: "wiring@test.local",
      },
    ]);
  });

  it("rejects unauthenticated /admin/dashboard with 401", async () => {
    const app = buildWiringApp(db);
    const res = await app.request("/admin/dashboard", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("rejects mobile-audience tokens on /admin/dashboard (audience_mismatch)", async () => {
    const app = buildWiringApp(db);
    const res = await app.request("/admin/dashboard", {
      method: "GET",
      headers: { Authorization: `Bearer ${await mobileToken()}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json().catch(() => ({}));
    expect(body.code).toBe("audience_mismatch");
  });

  it("accepts admin-audience tokens on /admin/dashboard (no auth 401)", async () => {
    const app = buildWiringApp(db);
    const res = await app.request("/admin/dashboard", {
      method: "GET",
      headers: { Authorization: `Bearer ${await adminToken()}` },
    });
    // Must NOT be an auth failure. Any non-401 (dashboard data, possibly
    // with empty aggregates from the mock DB) proves authMiddleware ran
    // and requireAdmin saw the super_admin.
    expect(res.status).not.toBe(401);
  });

  it("accepts admin-audience tokens on /admin/health/overview (no auth 401)", async () => {
    const app = buildWiringApp(db);
    const res = await app.request("/admin/health/overview", {
      method: "GET",
      headers: { Authorization: `Bearer ${await adminToken()}` },
    });
    expect(res.status).not.toBe(401);
  });

  it("ignores a stale foreign tenant header for super_admin (cross-org)", async () => {
    // Shared-device scenario: the previous account (e.g. a patient)
    // selected a hospital, and the tenant header leaked into the admin
    // session. super_admin holds no membership rows, so this must not
    // 403 with tenant_access_denied.
    const app = buildWiringApp(db);
    for (const headers of [
      { "x-active-hospital-id": "someone-elses-hospital" },
      { "x-active-clinic-id": "someone-elses-clinic" },
    ]) {
      const res = await app.request("/admin/dashboard", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await adminToken()}`,
          ...headers,
        },
      });
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    }
  });
});
