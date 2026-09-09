// @ts-nocheck
//
// Lab Task 5 — ratings RED→GREEN.
// Covers:
//   POST /diagnostic-tests/bookings/:id/rating {score 1-5, comment?}
//     completed-only, upsert into test_booking_ratings, patient owns booking
//     → {rating}
//   Aggregate ratingAvg,ratingCount on catalog availableAt (computed on read)
//

import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, postJson, getJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";

const PATIENT_USER = { id: "patient-001", role: "patient" };
const OTHER_PATIENT = { id: "patient-002", role: "patient" };

function seedBase(db: MockD1) {
  db.seed("users", [
    { id: "patient-001", supabaseId: "supabase-p1", role: "patient", name: "Test Patient", email: "p@test.com" },
    { id: "patient-002", supabaseId: "supabase-p2", role: "patient", name: "Other Patient", email: "o@test.com" },
    { id: "lab-001", supabaseId: "supabase-l1", role: "laboratory", name: "Test Lab", email: "lab@test.com" },
  ]);
  db.seed("patients", [
    { id: "pat-001", userId: "patient-001" },
    { id: "pat-002", userId: "patient-002" },
  ]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001", name: "Complete Blood Count", slug: "complete-blood-count",
      category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 1500, discountPrice: null,
      labPartnerId: "lab-001", turnaroundHours: 24, isActive: true,
      visibility: "public", isBookable: true, isDoctorOrderable: true,
      currency: "LKR", synonyms: "[]", displayOrder: 0,
    },
  ]);
  db.seed("lab_diagnostic_tests", [
    {
      id: "lt-001", labPartnerId: "lab-001", testId: "test-001",
      price: 1500, discountPrice: null, currency: "LKR",
      homeCollectionAvailable: true, labCollectionAvailable: true,
      turnaroundHours: 24, isActive: true,
    },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-pending-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "confirmed", scheduledDate: "2099-12-01", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
    },
    {
      id: "booking-done-001", patientId: "pat-001", labPartnerId: "lab-001",
      bookingType: "single_test", testId: "test-001", packageId: null,
      status: "completed", scheduledDate: "2099-11-01", scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({ line1: "123 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" }),
      totalPrice: 1500, paymentStatus: "paid", paymentMethod: "online",
      resultPdfUrl: "/files/download/abc", resultSummary: "All normal",
    },
  ]);
}

describe("lab ratings", () => {
  it("rejects rating before completed", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await postJson(app, "/diagnostic-tests/bookings/booking-pending-001/rating", {
      score: 5,
      comment: "Great!",
    });
    expect([400, 409]).toContain(res.status);
  });

  it("accepts rating after completed", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
      score: 5,
      comment: "Excellent service",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBeDefined();
    expect(body.rating.score ?? body.rating.stars).toBe(5);
  });

  it("upserts rating on second submit", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const first = await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
      score: 4,
      comment: "Good",
    });
    expect(first.status).toBe(200);
    const second = await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
      score: 5,
      comment: "Actually excellent",
    });
    expect(second.status).toBe(200);
    const body = await resJson(second);
    expect(body.rating.score ?? body.rating.stars).toBe(5);
    const rows = (db as any).tables.testBookingRatings?.rows ?? (db as any).tables.test_booking_ratings?.rows ?? [];
    const mine = rows.filter((r: any) => r.bookingId === "booking-done-001" || r.booking_id === "booking-done-001" || r.bookingId === "booking-done-001");
    // Upsert keeps a single row per booking (UNIQUE booking_id).
    expect(mine.length).toBeLessThanOrEqual(1);
    // Also verify via query that only one logical rating exists.
    const allForBooking = rows.filter((r: any) =>
      (r.bookingId ?? r.booking_id) === "booking-done-001"
    );
    expect(allForBooking.length).toBe(1);
  });

  it("validates score 1-5", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    for (const bad of [0, 6, "x", null]) {
      const res = await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
        score: bad,
      });
      expect(res.status).toBe(400);
    }
  });

  it("rejects other patient's booking with 403/404", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, OTHER_PATIENT);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
      score: 5,
    });
    expect([403, 404]).toContain(res.status);
  });

  it("exposes ratingAvg/ratingCount on catalog availableAt (computed on read)", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    // Rate the completed booking first so an aggregate exists.
    await postJson(app, "/diagnostic-tests/bookings/booking-done-001/rating", {
      score: 5,
      comment: "top",
    });
    const res = await getJson(app, "/diagnostic-tests/catalog?q=Complete");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    const item = body.items[0];
    expect(Array.isArray(item.availableAt)).toBe(true);
    if (item.availableAt.length > 0) {
      const offer = item.availableAt[0];
      // Aggregate fields present (computed on read, trivial).
      expect(offer).toHaveProperty("ratingAvg");
      expect(offer).toHaveProperty("ratingCount");
    }
  });
});

async function resJson(res: Response) {
  return await res.json();
}
