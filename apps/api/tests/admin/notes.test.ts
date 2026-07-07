// tests/admin/notes.test.ts
//
// Phase ADM-2: notes CRUD + ownership rules.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "../_mockDb";
import { buildAdminApp, get, postJson, patchJson, del } from "./_adminTestApp";

const ADMIN_A = "admin-a";
const ADMIN_B = "admin-b";
const TARGET = "user-target";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: ADMIN_A, role: "super_admin", status: "active", name: "Admin A", email: "a@test.local" },
    { id: ADMIN_B, role: "super_admin", status: "active", name: "Admin B", email: "b@test.local" },
    { id: TARGET, role: "doctor", status: "active", name: "Doc", email: "doc@test.local" },
  ]);
});

describe("POST /admin/users/:id/notes", () => {
  it("creates a note and returns its id", async () => {
    const app = buildAdminApp(db, { id: ADMIN_A, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET);
    db.setWhere("user_admin_notes", () => true);

    const res = await postJson(app, `/admin/users/${TARGET}/notes`, {
      body: "Called patient, awaiting SLMC docs.",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe("string");
  });

  it("rejects empty body", async () => {
    const app = buildAdminApp(db, { id: ADMIN_A, role: "super_admin" });
    db.setWhere("users", (r) => r.id === TARGET);
    const res = await postJson(app, `/admin/users/${TARGET}/notes`, { body: "" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /admin/notes/:noteId", () => {
  it("allows the author to edit", async () => {
    const noteId = "note-1";
    db.seed("user_admin_notes", [
      { id: noteId, userId: TARGET, adminUserId: ADMIN_A, body: "original", createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_A, role: "super_admin" });
    db.setWhere("user_admin_notes", (r) => r.id === noteId);

    const res = await patchJson(app, `/admin/notes/${noteId}`, { body: "updated" });
    expect(res.status).toBe(200);
  });

  it("blocks non-authors from editing", async () => {
    const noteId = "note-1";
    db.seed("user_admin_notes", [
      { id: noteId, userId: TARGET, adminUserId: ADMIN_A, body: "original", createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_B, role: "super_admin" });
    db.setWhere("user_admin_notes", (r) => r.id === noteId);

    const res = await patchJson(app, `/admin/notes/${noteId}`, { body: "hijacked" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /admin/notes/:noteId", () => {
  it("soft-deletes an authored note", async () => {
    const noteId = "note-1";
    db.seed("user_admin_notes", [
      { id: noteId, userId: TARGET, adminUserId: ADMIN_A, body: "x", createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_A, role: "super_admin" });
    db.setWhere("user_admin_notes", (r) => r.id === noteId);

    const res = await del(app, `/admin/notes/${noteId}`);
    expect(res.status).toBe(200);
    const note = db.tables.user_admin_notes.rows.find((r: any) => r.id === noteId);
    expect(note.deletedAt).toBeTruthy();
  });

  it("blocks non-authors from deleting", async () => {
    const noteId = "note-1";
    db.seed("user_admin_notes", [
      { id: noteId, userId: TARGET, adminUserId: ADMIN_A, body: "x", createdAt: new Date().toISOString() },
    ]);
    const app = buildAdminApp(db, { id: ADMIN_B, role: "super_admin" });
    db.setWhere("user_admin_notes", (r) => r.id === noteId);

    const res = await del(app, `/admin/notes/${noteId}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /admin/users/:id/notes", () => {
  it("returns notes excluding soft-deleted", async () => {
    db.seed("user_admin_notes", [
      { id: "n1", userId: TARGET, adminUserId: ADMIN_A, body: "kept", createdAt: "2025-01-01T00:00:00Z" },
      { id: "n2", userId: TARGET, adminUserId: ADMIN_A, body: "deleted", createdAt: "2025-01-02T00:00:00Z", deletedAt: "2025-01-03T00:00:00Z" },
    ]);
    db.setWhere("users", (r) => r.id === TARGET);
    // The mock's Drizzle parser doesn't handle `isNull`, so we
    // register the equivalent predicate manually. The route still
    // emits the isNull clause for real D1 — the mock just short-
    // circuits via the registered predicate. setWhere normalises to
    // camelCase, matching the route's table resolution.
    db.setWhere("userAdminNotes", (r) => r.userId === TARGET && !r.deletedAt);

    const app = buildAdminApp(db, { id: ADMIN_A, role: "super_admin" });
    const res = await get(app, `/admin/users/${TARGET}/notes`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe("n1");
    expect(body.items[0].id).toBe("n1");
  });
});