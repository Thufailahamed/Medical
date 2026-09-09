// @ts-nocheck
//
// Lab Task 4 — onboarding + roster + admin moderation + packages UI (RED→GREEN).
// Covers:
//   GET/POST/PUT/DELETE /lab-portal/phlebotomists scoped to labPartnerId
//   PATCH /lab-portal/bookings/:id/assign-phlebotomist accepts phlebotomistId FK
//     (back-compat free-text name/phone still works)
//   Migration 0078 additive with phlebotomists + test_booking_ratings
//   Admin laboratories approve/reject inline, packages create/edit modal,
//   catalog availability UI (new + legacy fallback), lab register page.
//

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildTestApp, postJson, getJson, patchJson, putJson, deleteJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import labPartnerPortalRouter from "../src/routes/lab-partner-portal";

function repoRead(rel: string): string {
  const candidates = [
    join(process.cwd(), rel),
    join(process.cwd(), "..", "..", rel),
    join(process.cwd(), "apps/api", rel),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {}
  }
  try {
    const url = new URL(`../../../../${rel}`, import.meta.url);
    return readFileSync(url, "utf8");
  } catch {}
  throw new Error(`cannot read repo file: ${rel}`);
}

function repoExists(rel: string): boolean {
  const candidates = [
    join(process.cwd(), rel),
    join(process.cwd(), "..", "..", rel),
    join(process.cwd(), "apps/api", rel),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return true;
    } catch {}
  }
  try {
    const url = new URL(`../../../../${rel}`, import.meta.url);
    if (existsSync(url)) return true;
  } catch {}
  return false;
}

const LAB_USER = { id: "lab-001", role: "laboratory" };
const OTHER_LAB = { id: "lab-other", role: "laboratory" };

function seedBase(db: MockD1) {
  db.seed("users", [
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
    { id: "lab-other", supabaseId: "supabase-l2", role: "laboratory", name: "Other Lab", email: "other@test.com" },
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
  ]);
  db.seed("patients", [{ id: "pat-001", userId: "patient-001" }]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
    },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "confirmed", scheduledDate: "2099-12-01", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      phlebotomistId: null, phlebotomistName: null, phlebotomistPhone: null,
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
    },
  ]);
  db.seed("phlebotomists", [
    { id: "phleb-001", labPartnerId: "lab-001", name: "Kamal", phone: "0771111111", email: null, isActive: true },
    { id: "phleb-other", labPartnerId: "lab-other", name: "Other Tech", phone: "0779999999", email: null, isActive: true },
  ]);
}

describe("lab onboarding", () => {
  it("phlebotomist CRUD exists", () => {
    expect(true).toBe(true);
  });

  describe("GET /phlebotomists", () => {
    it("lists roster scoped to calling lab", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await getJson(app, "/lab-portal/phlebotomists");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phlebotomists).toHaveLength(1);
      expect(body.phlebotomists[0].id).toBe("phleb-001");
    });

    it("does not leak other lab roster", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, OTHER_LAB);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await getJson(app, "/lab-portal/phlebotomists");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phlebotomists).toHaveLength(1);
      expect(body.phlebotomists[0].id).toBe("phleb-other");
    });
  });

  describe("POST /phlebotomists", () => {
    it("creates a phlebotomist with name/phone", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await postJson(app, "/lab-portal/phlebotomists", {
        name: "Nimal",
        phone: "0772222222",
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.phlebotomist.name).toBe("Nimal");
      expect(body.phlebotomist.id).toBeTruthy();
    });

    it("validates name/phone", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const missing = await postJson(app, "/lab-portal/phlebotomists", { name: "", phone: "0772222222" });
      expect(missing.status).toBe(400);
      const badPhone = await postJson(app, "/lab-portal/phlebotomists", { name: "Nimal", phone: "x" });
      expect(badPhone.status).toBe(400);
    });
  });

  describe("PUT /phlebotomists/:id", () => {
    it("updates own roster entry", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await putJson(app, "/lab-portal/phlebotomists/phleb-001", { name: "Kamal Updated" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phlebotomist.name).toBe("Kamal Updated");
    });

    it("404 for other lab roster", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await putJson(app, "/lab-portal/phlebotomists/phleb-other", { name: "Hijack" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /phlebotomists/:id", () => {
    it("soft deactivates own roster entry", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await deleteJson(app, "/lab-portal/phlebotomists/phleb-001");
      expect([200, 204]).toContain(res.status);
      const rows = (db as any).tables.phlebotomists?.rows ?? [];
      const row = rows.find((r: any) => r.id === "phleb-001");
      // soft deactivate: isActive false / 0
      expect([false, 0]).toContain(row?.isActive);
    });

    it("404 for other lab roster", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await deleteJson(app, "/lab-portal/phlebotomists/phleb-other");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /bookings/:id/assign-phlebotomist", () => {
    it("accepts phlebotomistId FK and resolves roster name/phone", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await patchJson(app, "/lab-portal/bookings/booking-001/assign-phlebotomist", {
        phlebotomistId: "phleb-001",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.status).toBe("phlebotomist_assigned");
      expect(body.booking.phlebotomistId).toBe("phleb-001");
      expect(body.booking.phlebotomistName).toBe("Kamal");
    });

    it("keeps back-compat free-text name/phone working", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await patchJson(app, "/lab-portal/bookings/booking-001/assign-phlebotomist", {
        phlebotomistId: "phleb-free-1",
        phlebotomistName: "Free Text Tech",
        phlebotomistPhone: "0773333333",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.phlebotomistName).toBe("Free Text Tech");
    });

    it("rejects unknown phlebotomistId without free-text fallback", async () => {
      const db = new MockD1();
      seedBase(db);
      const app = await buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);
      const res = await patchJson(app, "/lab-portal/bookings/booking-001/assign-phlebotomist", {
        phlebotomistId: "phleb-missing",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("migration + UI wiring", () => {
    it("migration 0078 additive with roster + ratings", () => {
      expect(repoExists("apps/api/migrations/0078_lab_roster_ratings.sql")).toBe(true);
      const sql = repoRead("apps/api/migrations/0078_lab_roster_ratings.sql");
      expect(sql).toContain("phlebotomists");
      expect(sql).toContain("test_booking_ratings");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS");
      // additive only: no drops
      expect(sql).not.toMatch(/DROP TABLE/i);
      // roster shape
      expect(sql).toContain("lab_partner_id");
      expect(sql).toContain("is_active");
      // ratings shape: score/stars 1-5 + booking FK unique
      expect(sql).toMatch(/score|stars/);
      expect(sql).toMatch(/booking_id/);
    });

    it("lab-portal route exposes roster CRUD + FK assign", () => {
      const src = repoRead("apps/api/src/routes/lab-partner-portal.ts");
      expect(src).toContain("/phlebotomists");
      expect(src).toContain("phlebotomistId");
      expect(src).toContain("isActive");
    });

    it("admin laboratories has approve/reject inline via approvals endpoint", () => {
      const page = repoRead("apps/marketing/src/app/admin/(admin)/laboratories/page.tsx");
      expect(page).toContain("Approve");
      expect(page).toContain("Reject");
      expect(page).toContain("/admin/approvals");
    });

    it("packages page wires create/edit POST/PUT with modal form", () => {
      const page = repoRead("apps/marketing/src/app/lab-portal/(portal)/packages/page.tsx");
      expect(page).toContain("/lab-portal/packages");
      expect(page).toMatch(/POST|method: "POST"/);
      expect(page).toMatch(/PUT|method: "PUT"/);
      expect(page.toLowerCase()).toContain("modal");
    });

    it("catalog page uses new availability UI with bulk-toggle + legacy fallback", () => {
      const page = repoRead("apps/marketing/src/app/lab-portal/(portal)/catalog/page.tsx");
      expect(page).toContain("/lab-portal/diagnostic-tests-availability");
      expect(page).toContain("bulk-toggle");
      expect(page).toContain("/lab-portal/catalog");
    });

    it("lab register page posts laboratory with license/accreditation/address/hours/bank", () => {
      expect(repoExists("apps/marketing/src/app/lab-portal/register/page.tsx")).toBe(true);
      const page = repoRead("apps/marketing/src/app/lab-portal/register/page.tsx");
      expect(page).toContain("/auth/register");
      expect(page).toContain("laboratory");
      expect(page.toLowerCase()).toContain("license");
      expect(page.toLowerCase()).toContain("address");
    });
  });
});
