// @ts-nocheck

import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, postJson, getJson, patchJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import labPartnerPortalRouter from "../src/routes/lab-partner-portal";

const LAB_USER = { id: "lab-001", role: "laboratory" };

function seedLabData(db: MockD1) {
  db.seed("users", [
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
  ]);
  db.seed("patients", [
    { id: "pat-001", userId: "patient-001" },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "pending", scheduledDate: "2026-07-20", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main St", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      phlebotomistId: null, phlebotomistName: null, phlebotomistPhone: null,
      totalPrice: 1500, paymentStatus: "cash_on_collection", paymentMethod: "cash",
    },
    {
      id: "booking-002", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "confirmed", scheduledDate: "2026-07-21", scheduledTimeSlot: "10:00-12:00",
      collectionAddress: JSON.stringify({ line1: "456 Oak Ave", city: "Kandy", district: "Kandy", contactPhone: "0779876543" }),
      phlebotomistId: null, phlebotomistName: null, phlebotomistPhone: null,
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
    },
  ]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
    },
  ]);
  db.seed("phlebotomists", [
    { id: "phleb-001", labPartnerId: "lab-001", name: "Kamal", phone: "0771111111", email: null, isActive: true },
  ]);
}

describe("Lab Partner Portal API", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    seedLabData(db);
  });

  // ─── Role Gating ─────────────────────────────────────

  describe("Role gating", () => {
    it("rejects non-laboratory users", async () => {
      const app = buildTestApp(db, { id: "patient-001", role: "patient" });
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/bookings");
      expect(res.status).toBe(403);
    });
  });

  // ─── Bookings ────────────────────────────────────────

  describe("GET /bookings", () => {
    it("lists lab's bookings", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/bookings");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bookings).toHaveLength(2);
    });

    it("filters by status", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/bookings?status=pending");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bookings).toHaveLength(1);
      expect(body.bookings[0].status).toBe("pending");
    });
  });

  // ─── Confirm ─────────────────────────────────────────

  describe("PATCH /bookings/:id/confirm", () => {
    it("confirms a pending booking", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/bookings/booking-001/confirm", {});
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.status).toBe("confirmed");
    });

    it("rejects confirming a non-pending booking", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/bookings/booking-002/confirm", {});
      expect(res.status).toBe(400);
    });
  });

  // ─── Assign Phlebotomist ─────────────────────────────

  describe("PATCH /bookings/:id/assign-phlebotomist", () => {
    it("assigns a phlebotomist to a confirmed booking", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/bookings/booking-002/assign-phlebotomist", {
        phlebotomistId: "phleb-001",
        phlebotomistName: "Kamal",
        phlebotomistPhone: "0771111111",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.status).toBe("phlebotomist_assigned");
      expect(body.booking.phlebotomistName).toBe("Kamal");
    });
  });

  // ─── Collect Sample ──────────────────────────────────

  describe("PATCH /bookings/:id/collect-sample", () => {
    it("marks sample as collected", async () => {
      // Set booking to phlebotomist_assigned
      db.seed("test_bookings", [
        {
          id: "booking-003", patientId: "pat-001", labPartnerId: "lab-001",
          bookingType: "single_test", testId: "test-001", packageId: null,
          status: "phlebotomist_assigned", scheduledDate: "2026-07-20", scheduledTimeSlot: "08:00-10:00",
          collectionAddress: "{}", phlebotomistId: "phleb-001", phlebotomistName: "Kamal",
          phlebotomistPhone: "0771111111", totalPrice: 1500, paymentStatus: "cash_on_collection",
          paymentMethod: "cash",
        },
      ]);

      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await patchJson(app, "/lab-portal/bookings/booking-003/collect-sample", {});
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.status).toBe("sample_collected");
      expect(body.booking.paymentStatus).toBe("paid"); // Cash collected
    });
  });

  // ─── Catalog CRUD ────────────────────────────────────

  describe("POST /catalog", () => {
    it("creates a new test", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/catalog", {
        name: "Lipid Profile",
        slug: "lipid-profile",
        category: "lipid",
        sampleType: "blood",
        price: 2000,
        turnaroundHours: 24,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.test.name).toBe("Lipid Profile");
    });

    it("rejects duplicate slugs", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/catalog", {
        name: "CBC Duplicate",
        slug: "complete-blood-count",
        category: "blood",
        sampleType: "blood",
        price: 1500,
      });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /catalog", () => {
    it("lists lab's own catalog", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/catalog");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tests).toHaveLength(1);
    });
  });

  // ─── Phlebotomist CRUD ───────────────────────────────

  describe("GET /phlebotomists", () => {
    it("lists phlebotomists", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/phlebotomists");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phlebotomists).toHaveLength(1);
    });
  });

  describe("POST /phlebotomists", () => {
    it("creates a phlebotomist", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await postJson(app, "/lab-portal/phlebotomists", {
        name: "Nimal",
        phone: "0772222222",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.phlebotomist.name).toBe("Nimal");
    });
  });

  // ─── Stats ───────────────────────────────────────────

  describe("GET /stats", () => {
    it("returns dashboard stats", async () => {
      const app = buildTestApp(db, LAB_USER);
      app.route("/lab-portal", labPartnerPortalRouter);

      const res = await getJson(app, "/lab-portal/stats");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stats).toBeDefined();
      expect(body.stats.totalBookings).toBe(2);
    });
  });
});
