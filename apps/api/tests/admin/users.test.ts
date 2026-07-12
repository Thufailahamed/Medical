// tests/admin/users.test.ts
//
// Phase ADM-1: /admin/users — list, suspend, unsuspend, delete.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson, del, stepUpTokenFor } from "./_adminTestApp";

const ADMIN_ID = "admin-1";
const TARGET_ID = "user-target";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
    { id: TARGET_ID, role: "doctor", status: "active", name: "Dr. Target", email: "doc@test.local" },
  ]);
});

describe("GET /admin/users", () => {
  it("returns paginated list", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", () => true);

    const res = await get(app, "/admin/users?role=doctor&limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(typeof body.total).toBe("number");
  });
});

describe("POST /admin/users/:id/suspend", () => {
  it("requires reason of at least 3 chars", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);

    const res = await postJson(app, `/admin/users/${TARGET_ID}/suspend`, { reason: "x" }, {
      "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }),
    });
    expect(res.status).toBe(400);
  });

  it("blocks self-suspension", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === ADMIN_ID);

    const res = await postJson(app, `/admin/users/${ADMIN_ID}/suspend`, {
      reason: "self-suspend attempt",
    }, {
      "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }),
    });
    expect(res.status).toBe(400);
  });

  it("suspends a target user", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET_ID);

    const res = await postJson(app, `/admin/users/${TARGET_ID}/suspend`, {
      reason: "policy violation",
    }, {
      "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /admin/users/:id", () => {
  it("blocks self-delete", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === ADMIN_ID);

    const res = await del(app, `/admin/users/${ADMIN_ID}`, {
      "X-Stepup-Token": stepUpTokenFor({ id: ADMIN_ID, role: "super_admin" }),
    });
    expect(res.status).toBe(400);
  });
});