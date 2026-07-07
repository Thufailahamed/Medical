// tests/admin/stepup.test.ts
//
// Phase ADM-3: step-up auth gate on destructive admin endpoints.

import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, postJson, del, stepUpTokenFor } from "./_adminTestApp";

const ADMIN_ID = "admin-1";
const TARGET_ID = "user-target";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
    { id: TARGET_ID, role: "doctor", status: "active", name: "Target", email: "t@test.local" },
  ]);
});

function mintExpiredToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) - 60;
  const payload = JSON.stringify({ userId, exp });
  const mac = createHmac("sha256", "test-secret-do-not-use-in-prod").update(payload).digest();
  const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64(Buffer.from(payload))}.${b64(mac)}`;
}

function mintTokenForOtherUser(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const payload = JSON.stringify({ userId, exp });
  const mac = createHmac("sha256", "test-secret-do-not-use-in-prod").update(payload).digest();
  const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64(Buffer.from(payload))}.${b64(mac)}`;
}

describe("DELETE /admin/users/:id — step-up gate", () => {
  it("rejects without X-Stepup-Token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await del(app, `/admin/users/${TARGET_ID}`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("step_up_required");
  });

  it("rejects expired token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await del(app, `/admin/users/${TARGET_ID}`, {
      "X-Stepup-Token": mintExpiredToken(ADMIN_ID),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("step_up_invalid");
  });

  it("rejects token bound to a different user", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await del(app, `/admin/users/${TARGET_ID}`, {
      "X-Stepup-Token": mintTokenForOtherUser("someone-else"),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("step_up_mismatch");
  });

  it("accepts a fresh token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await del(app, `/admin/users/${TARGET_ID}`, {
      "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /admin/bulk/delete — step-up gate", () => {
  it("rejects without X-Stepup-Token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: [TARGET_ID],
      confirm: true,
    });
    expect(res.status).toBe(401);
  });

  it("accepts a fresh token", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);
    const res = await postJson(app, "/admin/bulk/delete", {
      userIds: [TARGET_ID],
      confirm: true,
    }, { "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.successCount).toBe(1);
  });
});