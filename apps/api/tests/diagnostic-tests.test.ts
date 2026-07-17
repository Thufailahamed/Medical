// @ts-nocheck

import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, postJson, getJson, patchJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";

const PATIENT_USER = { id: "patient-001", role: "patient" };
const LAB_USER = { id: "lab-001", role: "laboratory" };

function seedBaseData(db: MockD1) {
  db.seed("users", [
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
  ]);
  db.seed("patients", [
    { id: "pat-001", userId: "patient-001", gender: "male", dateOfBirth: "1990-01-01" },
  ]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
      description: "Basic blood test", instructions: null,
    },
    {
      id: "test-002", name: "Fasting Blood Sugar", slug: "fasting-blood-sugar",
      category: "diabetes", sampleType: "blood", fastingRequired: true, fastingHours: 8,
      homeCollectionAvailable: true, price: 800, discountPrice: 600,
      labPartnerId: "lab-001", turnaroundHours: 12, isActive: true,
      description: "Diabetes screening", instructions: "Fast for 8 hours",
    },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "pending", scheduledDate: "2026-07-20", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main St", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      phlebotomistId: null, phlebotomistName: null, phlebotomistPhone: null,
      totalPrice: 1500, paymentStatus: "cash_on_collection", paymentMethod: "cash",
      paymentRef: null, resultPdfUrl: null, resultSummary: null, resultReadyAt: null,
      cancellationReason: null, notes: null,
    },
  ]);
}

describe("Diagnostic Tests API", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    seedBaseData(db);
  });

  // ─── Catalog ─────────────────────────────────────────

  describe("GET /catalog", () => {
    it("returns active tests", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/catalog");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tests).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("filters by category", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/catalog?category=blood");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tests).toHaveLength(1);
      expect(body.tests[0].category).toBe("blood");
    });

    it("filters by search", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/catalog?search=sugar");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tests).toHaveLength(1);
      expect(body.tests[0].name).toContain("Sugar");
    });
  });

  describe("GET /catalog/:slug", () => {
    it("returns test detail by slug", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/catalog/complete-blood-count");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.test.name).toBe("Complete Blood Count");
    });

    it("returns 404 for unknown slug", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/catalog/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // ─── Categories ──────────────────────────────────────

  describe("GET /categories", () => {
    it("returns categories with counts", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/categories");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.categories.length).toBeGreaterThan(0);
    });
  });

  // ─── Time Slots ──────────────────────────────────────

  describe("GET /time-slots", () => {
    it("returns available time slots", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/time-slots");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.slots).toHaveLength(6);
    });
  });

  // ─── Booking ─────────────────────────────────────────

  describe("POST /book", () => {
    it("creates a booking for a single test", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await postJson(app, "/diagnostic-tests/book", {
        bookingType: "single_test",
        testId: "test-001",
        scheduledDate: "2026-07-25",
        scheduledTimeSlot: "08:00-10:00",
        collectionAddress: {
          line1: "456 Oak Ave",
          city: "Kandy",
          district: "Kandy",
          contactPhone: "0779876543",
        },
        paymentMethod: "cash",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.booking.status).toBe("pending");
      expect(body.booking.totalPrice).toBe(1500);
    });

    it("rejects past dates", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await postJson(app, "/diagnostic-tests/book", {
        bookingType: "single_test",
        testId: "test-001",
        scheduledDate: "2020-01-01",
        scheduledTimeSlot: "08:00-10:00",
        collectionAddress: {
          line1: "123 St",
          city: "Colombo",
          district: "Colombo",
          contactPhone: "0771234567",
        },
        paymentMethod: "cash",
      });

      expect(res.status).toBe(400);
    });

    it("rejects missing testId", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await postJson(app, "/diagnostic-tests/book", {
        bookingType: "single_test",
        scheduledDate: "2026-07-25",
        scheduledTimeSlot: "08:00-10:00",
        collectionAddress: {
          line1: "123 St",
          city: "Colombo",
          district: "Colombo",
          contactPhone: "0771234567",
        },
        paymentMethod: "cash",
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── My Bookings ─────────────────────────────────────

  describe("GET /bookings", () => {
    it("returns patient's bookings", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/bookings");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bookings).toHaveLength(1);
    });
  });

  // ─── Cancel ──────────────────────────────────────────

  describe("PATCH /bookings/:id/cancel", () => {
    it("cancels a pending booking", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await patchJson(app, "/diagnostic-tests/bookings/booking-001/cancel", {
        cancellationReason: "Changed my mind",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.booking.status).toBe("cancelled");
    });
  });

  // ─── Rating ──────────────────────────────────────────

  describe("POST /bookings/:id/rating", () => {
    it("rejects rating for non-completed bookings", async () => {
      const app = buildTestApp(db, PATIENT_USER);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await postJson(app, "/diagnostic-tests/bookings/booking-001/rating", {
        stars: 5,
        comment: "Great service",
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Promo Validation ────────────────────────────────

  describe("POST /validate-promo", () => {
    it("returns valid=false for unknown code", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await postJson(app, "/diagnostic-tests/validate-promo", {
        code: "INVALID",
        bookingTotal: 1000,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(false);
    });
  });

  // ─── Popular Tests ───────────────────────────────────

  describe("GET /popular", () => {
    it("returns popular tests (fallback to catalog)", async () => {
      const app = buildTestApp(db);
      app.route("/diagnostic-tests", diagnosticTestsRouter);

      const res = await getJson(app, "/diagnostic-tests/popular");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tests.length).toBeGreaterThan(0);
    });
  });
});
