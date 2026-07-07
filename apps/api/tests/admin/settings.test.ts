// tests/admin/settings.test.ts
//
// Phase ADM-2: settings CRUD + type validation + sensitive gate.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, patchJson, postJson } from "./_adminTestApp";

const ADMIN_ID = "admin-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_ID, role: "super_admin", status: "active", name: "Admin", email: "admin@test.local" },
  ]);
  // Seed via lib helper rather than test setup so the row shape
  // matches what the seed inserts in prod.
});

describe("GET /admin/settings", () => {
  it("lists seeded settings grouped by category", async () => {
    const { seedSettings } = await import("../../src/lib/seed-settings");
    await seedSettings(db, ADMIN_ID);
    db.setWhere("system_settings", () => true);

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await get(app, "/admin/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.grouped.registration).toBeDefined();
  });
});

describe("PATCH /admin/settings/:key", () => {
  it("updates a boolean setting", async () => {
    const { seedSettings } = await import("../../src/lib/seed-settings");
    await seedSettings(db, ADMIN_ID);
    db.setWhere("system_settings", (r) => r.key === "registration.requireApproval");

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await patchJson(app, "/admin/settings/registration.requireApproval", {
      value: false,
    });
    expect(res.status).toBe(200);
  });

  it("rejects a non-boolean value for a boolean setting", async () => {
    const { seedSettings } = await import("../../src/lib/seed-settings");
    await seedSettings(db, ADMIN_ID);
    db.setWhere("system_settings", (r) => r.key === "registration.requireApproval");

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    const res = await patchJson(app, "/admin/settings/registration.requireApproval", {
      value: "not-a-bool",
    });
    expect(res.status).toBe(400);
  });

  it("requires confirm=true for sensitive settings", async () => {
    const { seedSettings } = await import("../../src/lib/seed-settings");
    await seedSettings(db, ADMIN_ID);
    db.setWhere("system_settings", (r) => r.key === "operations.maintenanceMode");

    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    // Without confirm → 400.
    const res1 = await patchJson(app, "/admin/settings/operations.maintenanceMode", {
      value: true,
    });
    expect(res1.status).toBe(400);
    // With confirm → 200.
    const res2 = await patchJson(app, "/admin/settings/operations.maintenanceMode", {
      value: true,
      confirm: true,
    });
    expect(res2.status).toBe(200);
  });

  it("returns 404 for an unknown key", async () => {
    const app = buildAdminApp(db, { id: ADMIN_ID, role: "super_admin" });
    db.setWhere("system_settings", () => false);
    const res = await patchJson(app, "/admin/settings/nope.nothing", { value: 1 });
    expect(res.status).toBe(404);
  });
});