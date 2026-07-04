// tests/tenant-context.test.ts
//
// Phase MTN-1: tenant-context middleware behaviour.
//
// Validates the priority chain:
//   1. x-active-hospital-id / x-active-clinic-id header (mutex, 400 if both)
//   2. users.active_tenant_* column (durable fallback)
//   3. no header/column → both contexts NULL
//
// And the access-denied paths:
//   - doctor with no membership at the hospital → 403
//   - patient with no registration at the hospital → 403
//   - hospital_admin principal mismatch → 403
//
// Membership is set up via the mockDb seed (no real hospital/clinic
// inserts needed because middleware does SELECT, not INSERT).

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { tenantContextMiddleware } from "../src/middleware/tenant-context";
import { sign } from "hono/jwt";
import { MockD1 } from "./_mockDb";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

async function build(ctx: {
  user: { id: string; role: string; activeTenantType?: string; activeTenantId?: string };
  db: MockD1;
}) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { JWT_SECRET: TEST_SECRET } as any;
    c.set("db", ctx.db as any);
    c.set("locale", "en" as any);
    c.set("userId", ctx.user.id);
    c.set("userRole", ctx.user.role);
    // Seed a stub auth so the middleware treats the call as authed.
    ctx.db.seed("users", {
      id: ctx.user.id,
      role: ctx.user.role,
      activeTenantType: ctx.user.activeTenantType || null,
      activeTenantId: ctx.user.activeTenantId || null,
    });
    await next();
  });
  app.use("*", tenantContextMiddleware);
  app.get("/probe", (c) =>
    c.json({
      activeHospitalId: c.get("activeHospitalId") || null,
      activeClinicId: c.get("activeClinicId") || null,
      myHospitals: (c.get("myHospitals") || []).length,
      myClinics: (c.get("myClinics") || []).length,
    })
  );
  return app;
}

describe("tenant-context middleware", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
  });

  it("returns 400 when both headers are sent", async () => {
    const app = await build({ user: { id: "u1", role: "doctor" }, db });
    const res = await app.request("/probe", {
      headers: {
        "x-active-hospital-id": "h1",
        "x-active-clinic-id": "c1",
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.reason).toBe("tenant_header_conflict");
  });

  it("sets activeHospitalId NULL when no header / no column / doctor with no membership", async () => {
    const app = await build({
      user: { id: "u1", role: "doctor", activeTenantType: "hospital", activeTenantId: "h-foreign" },
      db,
    });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    // No hospital_doctors row for u1 → membership invalid → fallback to NULL.
    const res = await app.request("/probe");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.activeHospitalId).toBe(null);
    expect(body.activeClinicId).toBe(null);
  });

  it("403s when header points to a hospital the doctor doesn't belong to", async () => {
    const app = await build({
      user: { id: "u1", role: "doctor" },
      db,
    });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc-other", status: "active" });
    const res = await app.request("/probe", {
      headers: { "x-active-hospital-id": "h1" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.reason).toBe("tenant_access_denied");
  });

  it("200s when doctor is an active hospital_doctors member", async () => {
    const app = await build({
      user: { id: "u1", role: "doctor" },
      db,
    });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active" });
    db.seed("hospitals", { id: "h1", userId: "someone-else" });
    const res = await app.request("/probe", {
      headers: { "x-active-hospital-id": "h1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.activeHospitalId).toBe("h1");
    expect(body.activeClinicId).toBe(null);
    expect(body.myHospitals).toBeGreaterThanOrEqual(1);
  });

  it("falls back to durable column when no header sent", async () => {
    const app = await build({
      user: { id: "u1", role: "doctor", activeTenantType: "hospital", activeTenantId: "h1" },
      db,
    });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active" });
    const res = await app.request("/probe");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.activeHospitalId).toBe("h1");
  });

  it("hospital_admin must own the hospital to use the header", async () => {
    const app = await build({ user: { id: "u1", role: "hospital_admin" }, db });
    db.seed("hospitals", { id: "h1", userId: "u1" });
    db.seed("hospitals", { id: "h2", userId: "u-other" });
    // u1 owns h1, not h2.
    const ok = await app.request("/probe", { headers: { "x-active-hospital-id": "h1" } });
    expect(ok.status).toBe(200);
    const bad = await app.request("/probe", { headers: { "x-active-hospital-id": "h2" } });
    expect(bad.status).toBe(403);
  });
});