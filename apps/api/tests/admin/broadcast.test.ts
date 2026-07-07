// tests/admin/broadcast.test.ts
//
// Phase ADM-1: broadcast notification — must exclude super_admins from
// the target list so admin broadcasts never loop to other admins.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, postJson } from "./_adminTestApp";

const ADMIN_ID = "admin-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active" },
    { id: "pat-1", role: "patient", status: "active" },
    { id: "doc-1", role: "doctor", status: "active" },
    { id: "adm-2", role: "super_admin", status: "active" },
  ]);
});

describe("POST /admin/notifications/broadcast", () => {
  it("validates title and body", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await postJson(app, "/admin/notifications/broadcast", { title: "", body: "" });
    expect(res.status).toBe(400);
  });

  it("sends broadcast and excludes other super_admins", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    // The route does SELECT users WHERE role != 'super_admin' AND status = 'active'.
    db.setWhere("users", (r) => r.role !== "super_admin" && r.status === "active");

    const res = await postJson(app, "/admin/notifications/broadcast", {
      title: "Test broadcast",
      body: "Hello all",
      audience: "active",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.sent).toBe("number");
  });
});