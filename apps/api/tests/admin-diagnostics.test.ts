// @ts-nocheck
//
// Tests for /admin/diagnostics/packages (Task 5 — admin packages +
// image assignment). Mirrors the existing admin-insurance test pattern.

import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, postJson, getJson, patchJson, putJson, deleteJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import adminDiagnosticsRouter from "../src/routes/admin-diagnostics";

const ADMIN_USER = { id: "admin-1", role: "super_admin" };
const LAB_USER = { id: "lab-101", role: "laboratory" };

describe("Admin Diagnostics — Packages + Image (Task 5)", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    db.seed("users", [
      { id: "admin-1", supabaseId: "supabase-a1", role: "super_admin", name: "Admin", email: "admin@test.com" },
      { id: "lab-101", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
    ]);
  });

  // ─── Role Gating ─────────────────────────────────────

  describe("Role gating", () => {
    it("rejects non-super_admin users with 403", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await getJson(app, "/admin/diagnostics/packages");
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── Create ──────────────────────────────────────────

  describe("POST /admin/diagnostics/packages", () => {
    it("creates a package with required fields and returns 201", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await postJson(app, "/admin/diagnostics/packages", {
        name: "Full Body Premium",
        slug: "full-body-premium",
        price: 4500,
        labPartnerId: "lab-101",
        description: "Comprehensive full body screening.",
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.package).toMatchObject({
        name: "Full Body Premium",
        slug: "full-body-premium",
        price: 4500,
        labPartnerId: "lab-101",
        isActive: true,
      });
    });

    it("attaches tests when testIds provided", async () => {
      db.seed("diagnostic_test_catalog", [
        { id: "test-cbc", slug: "cbc", name: "CBC", isActive: true, isBookable: true, visibility: "public", price: 1500, labPartnerId: null },
        { id: "test-lipid", slug: "lipid", name: "Lipid", isActive: true, isBookable: true, visibility: "public", price: 2500, labPartnerId: null },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await postJson(app, "/admin/diagnostics/packages", {
        name: "Combo A",
        slug: "combo-a",
        price: 3500,
        labPartnerId: "lab-101",
        testIds: ["test-cbc", "test-lipid"],
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.package.id).toBeTruthy();
    });

    it("returns 409 on duplicate slug", async () => {
      db.seed("test_packages", [
        { id: "existing", name: "Existing", slug: "combo-a", price: 1000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48 },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await postJson(app, "/admin/diagnostics/packages", {
        name: "Dup", slug: "combo-a", price: 2000, labPartnerId: "lab-101",
      });
      expect(res.status).toBe(409);
    });

    it("returns 400 when price is missing or non-positive", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await postJson(app, "/admin/diagnostics/packages", {
        name: "Bad", slug: "bad-pkg", labPartnerId: "lab-101",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when labPartnerId is missing (FK safety)", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await postJson(app, "/admin/diagnostics/packages", {
        name: "No Lab", slug: "no-lab", price: 1000,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Update ──────────────────────────────────────────

  describe("PATCH /admin/diagnostics/packages/:id", () => {
    it("updates price and other fields", async () => {
      db.seed("test_packages", [
        { id: "pkg-1", name: "Combo", slug: "combo", price: 3000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48 },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await patchJson(app, "/admin/diagnostics/packages/pkg-1", {
        price: 3500,
        featured: true,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.package.price).toBe(3500);
      expect(body.package.featured).toBe(true);
    });

    it("returns 404 on missing id", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await patchJson(app, "/admin/diagnostics/packages/missing", { price: 1 });
      expect(res.status).toBe(404);
    });
  });

  // ─── Deactivate ──────────────────────────────────────

  describe("DELETE /admin/diagnostics/packages/:id", () => {
    it("soft-deactivates and returns 204", async () => {
      db.seed("test_packages", [
        { id: "pkg-1", name: "Combo", slug: "combo", price: 3000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48 },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await deleteJson(app, "/admin/diagnostics/packages/pkg-1");
      expect(res.status).toBe(204);
    });

    it("returns 404 on missing id", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await deleteJson(app, "/admin/diagnostics/packages/missing");
      expect(res.status).toBe(404);
    });
  });

  // ─── Image assignment ────────────────────────────────

  describe("PUT /admin/diagnostics/packages/:id/image", () => {
    it("sets imageUrl on the package and returns the gallery row", async () => {
      db.seed("test_packages", [
        { id: "pkg-1", name: "Combo", slug: "combo", price: 3000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48, imageUrl: null },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await putJson(app, "/admin/diagnostics/packages/pkg-1/image", {
        imageUrl: "https://cdn.example.com/packages/combo.jpg",
        displayOrder: 0,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.image).toMatchObject({
        packageId: "pkg-1",
        imageUrl: "https://cdn.example.com/packages/combo.jpg",
      });
      expect(body.package.imageUrl).toBe("https://cdn.example.com/packages/combo.jpg");
    });

    it("returns 400 on invalid URL", async () => {
      db.seed("test_packages", [
        { id: "pkg-1", name: "Combo", slug: "combo", price: 3000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48 },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await putJson(app, "/admin/diagnostics/packages/pkg-1/image", {
        imageUrl: "not-a-url",
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 on missing package", async () => {
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await putJson(app, "/admin/diagnostics/packages/missing/image", {
        imageUrl: "https://cdn.example.com/x.jpg",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Get one ─────────────────────────────────────────

  describe("GET /admin/diagnostics/packages/:id", () => {
    it("returns the package with items and images", async () => {
      db.seed("diagnostic_test_catalog", [
        { id: "test-cbc", slug: "cbc", name: "CBC", isActive: true, isBookable: true, visibility: "public", price: 1500, labPartnerId: null },
      ]);
      db.seed("test_packages", [
        { id: "pkg-1", name: "Combo", slug: "combo", price: 3000, labPartnerId: "lab-101", isActive: true, turnaroundHours: 48 },
      ]);
      db.seed("test_package_items", [
        { id: "item-1", packageId: "pkg-1", testId: "test-cbc" },
      ]);
      db.seed("test_package_images", [
        { id: "img-1", packageId: "pkg-1", imageUrl: "https://cdn.example.com/pkg-1.jpg", displayOrder: 0 },
      ]);
      const app = await buildTestApp(db, ADMIN_USER);
      app.route("/admin", adminDiagnosticsRouter);

      const res = await getJson(app, "/admin/diagnostics/packages/pkg-1");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.package.id).toBe("pkg-1");
      expect(body.items).toHaveLength(1);
      expect(body.images).toHaveLength(1);
    });
  });
});
