// @ts-nocheck
//
// Tests for the per-lab diagnostic-test availability endpoints added in
// Task 4 (/lab-portal/diagnostic-tests-availability*). Mirrors the
// pattern in `lab-partner-portal.test.ts`.

import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, postJson, getJson, patchJson, deleteJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import labPartnerPortalRouter from "../src/routes/lab-partner-portal";

const LAB_USER = { id: "lab-101", role: "laboratory" };
const OTHER_LAB = { id: "lab-202", role: "laboratory" };

function seedCatalog(db: MockD1) {
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-cbc",
      name: "Complete Blood Count",
      slug: "complete-blood-count",
      code: "CBC",
      category: "cbc",
      sampleType: "blood",
      fastingRequired: false,
      fastingHours: 0,
      homeCollectionAvailable: true,
      labCollectionAvailable: true,
      price: 1500,
      discountPrice: null,
      labPartnerId: null,
      turnaroundHours: 24,
      isActive: true,
      currency: "LKR",
      visibility: "public",
      isBookable: true,
      isDoctorOrderable: true,
      synonyms: JSON.stringify(["CBC"]),
      displayOrder: 0,
    },
    {
      id: "test-lipid",
      name: "Lipid Profile",
      slug: "lipid-profile",
      code: "LIPID",
      category: "lipid",
      sampleType: "blood",
      fastingRequired: true,
      fastingHours: 12,
      homeCollectionAvailable: true,
      labCollectionAvailable: true,
      price: 2500,
      discountPrice: null,
      labPartnerId: null,
      turnaroundHours: 24,
      isActive: true,
      currency: "LKR",
      visibility: "public",
      isBookable: true,
      isDoctorOrderable: true,
      synonyms: JSON.stringify(["Lipid Panel"]),
      displayOrder: 0,
    },
  ]);
}

describe("Lab Partner Portal — Diagnostic Test Availability (Task 4)", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    seedCatalog(db);
  });

  // ─── Role Gating ─────────────────────────────────────

  describe("Role gating", () => {
    it("rejects non-laboratory users with 403", async () => {
      const app = await buildTestApp(db, { id: "patient-1", role: "patient" });
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/diagnostic-tests-availability");
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── GET list ────────────────────────────────────────

  describe("GET /diagnostic-tests-availability", () => {
    it("returns empty list when lab has no availability rows", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/diagnostic-tests-availability");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    it("does not return rows belonging to another lab", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1",
          labPartnerId: "lab-202",
          testId: "test-cbc",
          price: 1500,
          discountPrice: null,
          currency: "LKR",
          homeCollectionAvailable: true,
          labCollectionAvailable: true,
          isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/diagnostic-tests-availability");
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    it("returns rows owned by the calling lab, joined with canonical name/slug", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1",
          labPartnerId: "lab-101",
          testId: "test-cbc",
          price: 1500,
          discountPrice: 1200,
          currency: "LKR",
          homeCollectionAvailable: true,
          labCollectionAvailable: true,
          turnaroundHours: 12,
          isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/diagnostic-tests-availability");
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        testSlug: "complete-blood-count",
        testName: "Complete Blood Count",
        testCode: "CBC",
        price: 1500,
        discountPrice: 1200,
      });
    });

    it("hides soft-deleted rows by default; includes them with ?includeInactive=true", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-active", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
        {
          id: "lt-inactive", labPartnerId: "lab-101", testId: "test-lipid",
          price: 2500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: false,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const def = await (await getJson(app, "/lab-portal/diagnostic-tests-availability")).json();
      const full = await (await getJson(app, "/lab-portal/diagnostic-tests-availability?includeInactive=true")).json();
      expect(def.items.map((r) => r.id).sort()).toEqual(["lt-active"]);
      expect(full.items.map((r) => r.id).sort()).toEqual(["lt-active", "lt-inactive"]);
    });
  });

  // ─── POST enable ─────────────────────────────────────

  describe("POST /diagnostic-tests-availability", () => {
    it("creates a new availability row and returns 201", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability", {
        testId: "test-cbc",
        price: 2000,
        discountPrice: 1800,
        turnaroundHours: 8,
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.row).toMatchObject({
        labPartnerId: "lab-101",
        testId: "test-cbc",
        price: 2000,
        discountPrice: 1800,
      });
      expect(body.row.id).toBeTruthy();
    });

    it("returns 400 when price is not positive", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability", {
        testId: "test-cbc",
        price: 0,
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when discountPrice >= price", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability", {
        testId: "test-cbc",
        price: 1000,
        discountPrice: 1500,
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 when testId is not in the canonical catalog", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability", {
        testId: "test-does-not-exist",
        price: 1000,
      });
      expect(res.status).toBe(404);
    });

    it("returns 409 when the lab already enabled this test", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-existing", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability", {
        testId: "test-cbc",
        price: 2000,
      });
      expect(res.status).toBe(409);
    });
  });

  // ─── PATCH ───────────────────────────────────────────

  describe("PATCH /diagnostic-tests-availability/:id", () => {
    it("updates price and other fields", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true,
          turnaroundHours: 24, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/diagnostic-tests-availability/lt-1", {
        price: 1750,
        discountPrice: 1600,
        turnaroundHours: 12,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.row.price).toBe(1750);
      expect(body.row.discountPrice).toBe(1600);
      expect(body.row.turnaroundHours).toBe(12);
    });

    it("returns 404 when row does not exist", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/diagnostic-tests-availability/missing", {
        price: 2000,
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when row belongs to another lab", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-other", labPartnerId: "lab-202", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/diagnostic-tests-availability/lt-other", {
        price: 2000,
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 on invalid body", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/diagnostic-tests-availability/lt-1", {
        price: -5,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ──────────────────────────────────────────

  describe("DELETE /diagnostic-tests-availability/:id", () => {
    it("soft-deactivates the row and returns 204", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await deleteJson(app, "/lab-portal/diagnostic-tests-availability/lt-1");
      expect(res.status).toBe(204);
    });

    it("returns 404 when row does not exist", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await deleteJson(app, "/lab-portal/diagnostic-tests-availability/missing");
      expect(res.status).toBe(404);
    });
  });

  // ─── Bulk toggle ─────────────────────────────────────

  describe("POST /diagnostic-tests-availability/bulk-toggle", () => {
    it("enables a batch of tests and reports enabledCount", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability/bulk-toggle", {
        testIds: ["test-cbc", "test-lipid"],
        enabled: true,
        price: 1500,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.enabledCount).toBe(2);
      expect(body.disabledCount).toBe(0);
    });

    it("disables a batch and reports disabledCount", async () => {
      db.seed("lab_diagnostic_tests", [
        {
          id: "lt-1", labPartnerId: "lab-101", testId: "test-cbc",
          price: 1500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
        {
          id: "lt-2", labPartnerId: "lab-101", testId: "test-lipid",
          price: 2500, discountPrice: null, currency: "LKR",
          homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true,
        },
      ]);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability/bulk-toggle", {
        testIds: ["test-cbc", "test-lipid"],
        enabled: false,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.disabledCount).toBe(2);
      expect(body.enabledCount).toBe(0);
    });

    it("returns 400 when enabling without price", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability/bulk-toggle", {
        testIds: ["test-cbc"],
        enabled: true,
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 on empty testIds", async () => {
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/diagnostic-tests-availability/bulk-toggle", {
        testIds: [],
        enabled: false,
      });
      expect(res.status).toBe(400);
    });
  });
});
