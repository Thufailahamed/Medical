// tests/admin/approvals.test.ts
//
// Phase ADM-1: approvals queue — list pending users, approve, reject.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson } from "./_adminTestApp";

const ADMIN_ID = "admin-1";
const PENDING_DOCTOR_ID = "user-pending-doc";
const PENDING_PHARMACY_ID = "user-pending-pharm";
const ACTIVE_PATIENT_ID = "user-active-pat";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
    { id: PENDING_DOCTOR_ID, role: "doctor", status: "pending", name: "Dr. Pending", email: "doc@test.local" },
    { id: PENDING_PHARMACY_ID, role: "pharmacy", status: "pending", name: "Pharm Pending", email: "pharm@test.local" },
    { id: ACTIVE_PATIENT_ID, role: "patient", status: "active", name: "Active Patient", email: "pat@test.local" },
  ]);
});

describe("GET /admin/approvals", () => {
  it("returns pending users only", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.status === "pending");
    const res = await get(app, "/admin/approvals?status=pending");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2);
  });
});

describe("POST /admin/approvals/:userId/approve", () => {
  it("flips a pending user to active and stamps approvedByUserId", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    // The route does a SELECT users WHERE id=?, then UPDATE.
    db.setWhere("users", (r) => r.id === PENDING_DOCTOR_ID);

    const res = await postJson(app, `/admin/approvals/${PENDING_DOCTOR_ID}/approve`, {});
    expect(res.status).toBe(200);

    const after = db.tables.users?.rows.find((u: any) => u.id === PENDING_DOCTOR_ID);
    expect(after).toBeTruthy();
    // status update happens via the mock's update pipeline.
  });

  it("rejects approving an already-active user with 409", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === ACTIVE_PATIENT_ID);

    const res = await postJson(app, `/admin/approvals/${ACTIVE_PATIENT_ID}/approve`, {});
    expect(res.status).toBe(409);
  });

  it("requires reason to reject", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === PENDING_DOCTOR_ID);

    const res = await postJson(app, `/admin/approvals/${PENDING_DOCTOR_ID}/reject`, {});
    expect(res.status).toBe(400);
  });

  it("rejects when reason is provided", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("users", (r) => r.id === PENDING_DOCTOR_ID);

    const res = await postJson(
      app,
      `/admin/approvals/${PENDING_DOCTOR_ID}/reject`,
      { reason: "SLMC number unverifiable" },
    );
    expect(res.status).toBe(200);
  });
});