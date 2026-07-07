// tests/admin/bulk.test.ts
//
// Phase ADM-2: bulk operations + partial-success semantics.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, postJson, stepUpTokenFor } from "./_adminTestApp";

const ADMIN_ID = "admin-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
    { id: "u-pending-1", role: "doctor", status: "pending" },
    { id: "u-pending-2", role: "doctor", status: "pending" },
    { id: "u-active", role: "doctor", status: "active" },
  ]);
});

describe("POST /admin/bulk/approve", () => {
  it("approves all-pending batch", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");

    const res = await postJson(app, "/admin/bulk/approve", {
      userIds: ["u-pending-1", "u-pending-2"],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(2);
    expect(body.failureCount).toBe(0);
  });

  it("reports partial success when some ids are not pending", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");

    const res = await postJson(app, "/admin/bulk/approve", {
      userIds: ["u-pending-1", "u-active"],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(1);
    expect(body.failureCount).toBe(1);
    const fail = body.results.find((r: any) => r.userId === "u-active");
    expect(fail.status).toBe("error");
    expect(fail.code).toBe("not_pending");
  });

  it("rejects empty userIds", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/bulk/approve", { userIds: [] });
    expect(res.status).toBe(400);
  });

  it("rejects batches over 200", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const userIds = Array.from({ length: 201 }, (_, i) => `u-${i}`);
    const res = await postJson(app, "/admin/bulk/approve", { userIds });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/bulk/reject", () => {
  it("rejects pending users with a reason", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");

    const res = await postJson(app, "/admin/bulk/reject", {
      userIds: ["u-pending-1"],
      reason: "SLMC unverifiable",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(1);
  });

  it("requires reason of at least 3 chars", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/bulk/reject", {
      userIds: ["u-pending-1"],
      reason: "x",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/bulk/delete", () => {
  it("requires confirm=true", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: ["u-pending-1"],
    }, { "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }) });
    expect(res.status).toBe(400);
  });

  it("rejects without step-up token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: ["u-pending-1"],
      confirm: true,
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("step_up_required");
  });

  it("blocks self-delete", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === ADMIN_ID);
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: [ADMIN_ID],
      confirm: true,
    }, { "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(0);
    expect(body.failureCount).toBe(1);
    expect(body.results[0].code).toBe("self_delete");
  });

  it("deletes the targeted users with confirm", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.role === "doctor");
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: ["u-pending-1", "u-active"],
      confirm: true,
    }, { "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(2);
    expect(body.failureCount).toBe(0);
  });
});

describe("Bulk master switch", () => {
  it("blocks all bulk endpoints when featureFlags.bulkOpsEnabled=false", async () => {
    db.seed("system_settings", [
      { key: "featureFlags.bulkOpsEnabled", value: "false", valueType: "boolean", category: "feature_flags", description: "", isSensitive: false, updatedAt: new Date().toISOString() },
    ]);
    db.setWhere("system_settings", (r) => r.key === "featureFlags.bulkOpsEnabled");

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/bulk/approve", { userIds: ["u-pending-1"] });
    expect(res.status).toBe(403);
  });
});