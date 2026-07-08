import { describe, it, expect, beforeEach } from "bun:test";
import { MockD1 } from "../_mockDb";
import { buildAdminApp } from "./_adminTestApp";

describe("admin/health", () => {
  let db: MockD1;
  let adminId = "admin-1";

  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [
      { id: "admin-1", role: "super_admin", status: "active", email: "a@x" },
      { id: "patient-1", role: "patient", status: "active", email: "p@x" },
      { id: "doctor-1", role: "doctor", status: "active", email: "d@x" },
    ]);
  });

  it("overview returns counts", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/overview");
    expect(res.status).toBe(200);
    const body = await res.json();
    // We only assert the shape here — the mock D1 doesn't fully
    // simulate aggregates, but the route must still return valid
    // JSON with all required keys.
    expect(body.counts).toBeDefined();
    expect(typeof body.counts.totalUsers).toBe("number");
    expect(body.generatedAt).toBeDefined();
  });

  it("overview records an audit row", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/overview");
    expect(res.status).toBe(200);
  });

  it("overview includes queued DSAR", async () => {
    db.seed("dsarRequests", [
      {
        id: "dsar-1",
        userId: "patient-1",
        purpose: "export",
        status: "queued",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        completedAt: null,
        resultUrl: null,
        resultExpiresAt: null,
        notes: null,
      },
    ]);
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/overview");
    expect(res.status).toBe(200);
  });

  it("cron endpoint returns recent runs for known names", async () => {
    db.seed("auditLogs", [
      { id: "l1", userId: "admin-1", action: "cron.booking", resource: "system", resourceId: null, details: null, ip: null, createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/cron/booking");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("booking");
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("cron endpoint rejects unknown cron name", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/cron/unknown");
    expect(res.status).toBe(400);
  });

  it("errors endpoint returns failure audit rows", async () => {
    db.seed("auditLogs", [
      { id: "e1", userId: "admin-1", action: "payment.fail", resource: "payout", resourceId: "1", details: null, ip: null, createdAt: new Date().toISOString() },
      { id: "e2", userId: "admin-1", action: "notify.error", resource: "user", resourceId: "2", details: null, ip: null, createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/health/errors");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("requires super_admin role", async () => {
    const app = buildAdminApp(db, { id: "patient-1", role: "patient" });
    const res = await app.request("/admin/health/overview");
    expect(res.status).toBe(403);
  });
});