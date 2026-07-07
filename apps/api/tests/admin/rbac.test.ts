// tests/admin/rbac.test.ts
//
// Phase ADM-1: every /admin/* route must reject non-super_admins at
// the requireAdmin gate. Verifies the negative path — the positive
// path is exercised in approvals.test.ts / users.test.ts.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson } from "./_adminTestApp";

const ADMIN_ID = "admin-1";
const DOCTOR_ID = "doctor-1";
const PATIENT_ID = "patient-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active" },
    { id: DOCTOR_ID, role: "doctor", status: "active" },
    { id: PATIENT_ID, role: "patient", status: "active" },
  ]);
});

describe("admin RBAC — gate", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const app = buildAdminApp(db);
    const res = await get(app, "/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("rejects doctor with 403", async () => {
    const app = buildAdminApp(db, { id: DOCTOR_ID, role: "doctor" });
    const res = await get(app, "/admin/dashboard");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("not_admin");
  });

  it("rejects patient with 403", async () => {
    const app = buildAdminApp(db, { id: PATIENT_ID, role: "patient" });
    const res = await get(app, "/admin/users");
    expect(res.status).toBe(403);
  });

  it("rejects suspended super_admin with 403", async () => {
    const app = buildAdminApp(db, {
      id: ADMIN_ID,
      role: "super_admin",
      status: "suspended",
    });
    const res = await get(app, "/admin/dashboard");
    expect(res.status).toBe(403);
  });

  it("rejects non-admin write attempts on /admin/users/:id/suspend", async () => {
    const app = buildAdminApp(db, { id: DOCTOR_ID, role: "doctor" });
    const res = await postJson(app, `/admin/users/${PATIENT_ID}/suspend`, { reason: "test" });
    expect(res.status).toBe(403);
  });
});