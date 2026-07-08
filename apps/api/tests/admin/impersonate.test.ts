import { describe, it, expect, beforeEach } from "bun:test";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, postJson, stepUpTokenFor } from "./_adminTestApp";

describe("admin/impersonate", () => {
  let db: MockD1;
  let adminId = "admin-1";

  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [
      { id: "admin-1", role: "super_admin", status: "active", email: "a@x", name: "Admin" },
      { id: "patient-1", role: "patient", status: "active", email: "p@x", name: "Pat" },
      { id: "admin-2", role: "super_admin", status: "active", email: "b@x", name: "Bob" },
    ]);
  });

  it("mints an impersonation token with aud=admin", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/start",
      { userId: "patient-1" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.targetUser.id).toBe("patient-1");
    expect(body.targetUser.role).toBe("patient");
    expect(body.expiresAt).toBeDefined();
  });

  it("refuses to impersonate self", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/start",
      { userId: "admin-1" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(400);
  });

  it("refuses to impersonate another admin", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/start",
      { userId: "admin-2" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown user", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/start",
      { userId: "ghost" },
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) },
    );
    expect(res.status).toBe(404);
  });

  it("refuses without step-up", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/start",
      { userId: "patient-1" });
    expect(res.status).toBe(401);
  });

  it("end records audit row", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await postJson(app, "/admin/impersonate/end", {},
      { "X-Stepup-Token": stepUpTokenFor({ id: adminId, role: "super_admin" }) });
    expect(res.status).toBe(200);
  });

  it("whoami returns null when not impersonating", async () => {
    const app = buildAdminApp(db, { id: adminId, role: "super_admin" });
    const res = await app.request("/admin/impersonate/whoami");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actingAs).toBeNull();
  });

  it("requires super_admin role", async () => {
    const app = buildAdminApp(db, { id: "patient-1", role: "patient" });
    const res = await app.request("/admin/impersonate/whoami");
    expect(res.status).toBe(403);
  });
});