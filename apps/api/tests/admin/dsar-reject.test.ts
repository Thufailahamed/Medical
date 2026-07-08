import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { dsarRequests } from "@healthcare/db";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, postJson, stepUpTokenFor } from "./_adminTestApp";

async function findDsar(db: MockD1, id: string): Promise<any> {
  const rows: any[] = await db.select().from(dsarRequests).where(eq(dsarRequests.id, id));
  return rows[0];
}

describe("admin/dsar-reject", () => {
  let db: MockD1;
  let adminId = "admin-1";

  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [{ id: "user-1", role: "patient", status: "active", email: "u@x" }]);
    db.seed("dsarRequests", [
      {
        id: "dsar-1",
        userId: "user-1",
        purpose: "export",
        status: "queued",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        completedAt: null,
        resultUrl: null,
        resultExpiresAt: null,
        notes: null,
      },
      {
        id: "dsar-2",
        userId: "user-1",
        purpose: "export",
        status: "approved",
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        completedAt: null,
        resultUrl: null,
        resultExpiresAt: null,
        notes: null,
      },
      {
        id: "dsar-3",
        userId: "user-1",
        purpose: "delete",
        status: "completed",
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        resultUrl: "https://x/y",
        resultExpiresAt: new Date().toISOString(),
        notes: null,
      },
    ]);
  });

  it("rejects a queued request with reason", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-1/reject",
      { reason: "Identity could not be verified" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(200);
    const updated = (await findDsar(db, "dsar-1")) as any;
    expect(updated.status).toBe("failed");
    expect(updated.notes).toBe("Identity could not be verified");
  });

  it("rejects an approved request", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-2/reject",
      { reason: "Withdrawing the export" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(200);
  });

  it("rejects with no step-up token", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-1/reject", { reason: "policy" });
    expect(res.status).toBe(401);
  });

  it("rejects with reason too short", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-1/reject", { reason: "no" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) });
    expect(res.status).toBe(400);
  });

  it("rejects a 404", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/nope/reject", { reason: "missing" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) });
    expect(res.status).toBe(404);
  });

  it("re-queues a failed request", async () => {
    db.seed("dsarRequests", [
      {
        id: "dsar-failed",
        userId: "user-1",
        purpose: "export",
        status: "failed",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        completedAt: new Date().toISOString(),
        resultUrl: null,
        resultExpiresAt: null,
        notes: "previous reason",
      },
    ]);
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-failed/requeue", {},
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) });
    expect(res.status).toBe(200);
    const updated = (await findDsar(db, "dsar-failed")) as any;
    expect(updated.status).toBe("queued");
    expect(updated.notes).toBeNull();
    expect(updated.completedAt).toBeNull();
  });

  it("blocks requeue of non-failed request", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/dsar/dsar-1/requeue", {},
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) });
    expect(res.status).toBe(409);
  });
});