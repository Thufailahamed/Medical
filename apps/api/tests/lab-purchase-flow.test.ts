// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildTestApp, postJson, getJson, patchJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagRouter from "../src/routes/diagnostic-tests";
import labPortalRouter from "../src/routes/lab-partner-portal";

const addr = { line1: "1 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" };

function seedPaid(db: MockD1, overrides: any = {}) {
  db.seed("users", [
    { id: "lab-a", role: "laboratory", name: "Lab A" },
    { id: "pat-u", role: "patient", name: "Pat" },
  ]);
  db.seed("patients", [{ id: "pat-1", userId: "pat-u" }]);
  db.seed("diagnostic_test_catalog", [
    { id: "t-1", slug: "cbc", name: "CBC", category: "blood", sampleType: "blood", fastingRequired: false, fastingHours: 0, homeCollectionAvailable: true, price: 2000, discountPrice: null, labPartnerId: "lab-a", turnaroundHours: 24, isActive: true },
  ]);
  db.seed("test_bookings", [
    {
      id: "b-1", patientId: "pat-1", labPartnerId: "lab-a",
      bookingType: "single_test", testId: "t-1", packageId: null,
      status: "confirmed", scheduledDate: "2099-02-01", scheduledTimeSlot: "morning",
      collectionAddress: JSON.stringify(addr),
      totalPrice: 2000, paymentStatus: "paid", paymentMethod: "online",
      paymentRef: "TB-123",
      ...overrides,
    },
  ]);
}

describe("lab purchase flow fixes", () => {
  it("lab cancel on paid booking flags refunded", async () => {
    const db = new MockD1();
    seedPaid(db);
    const app = await buildTestApp(db, { id: "lab-a", role: "laboratory" });
    app.route("/lab-portal", labPortalRouter);
    const res = await patchJson(app, "/lab-portal/bookings/b-1/cancel", { reason: "no rider" });
    expect(res.status).toBe(200);
    const rows = (db as any).tables.testBookings?.rows ?? [];
    expect(rows.find((r: any) => r.id === "b-1")?.paymentStatus).toBe("refunded");
  });

  it("patient cancel while en-route is allowed and returns refunded row", async () => {
    const db = new MockD1();
    seedPaid(db, { status: "sample_collection_en_route" });
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const res = await patchJson(app, "/diagnostic-tests/bookings/b-1/cancel", { cancellationReason: "change of plans" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe("cancelled");
    expect(body.booking.paymentStatus).toBe("refunded");
  });

  it("reschedule rejects a full slot with 409", async () => {
    const db = new MockD1();
    seedPaid(db, { status: "confirmed", paymentStatus: "cash_on_collection", paymentMethod: "cash" });
    const filler = Array.from({ length: 20 }, (_, i) => ({
      id: `f-${i}`, patientId: `px-${i}`, labPartnerId: "lab-a",
      bookingType: "single_test", testId: "t-1",
      status: "confirmed", scheduledDate: "2099-03-01", scheduledTimeSlot: "morning",
      collectionAddress: JSON.stringify(addr), totalPrice: 2000,
      paymentStatus: "cash_on_collection", paymentMethod: "cash",
    }));
    db.seed("test_bookings", filler);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const res = await patchJson(app, "/diagnostic-tests/bookings/b-1/reschedule", {
      scheduledDate: "2099-03-01", scheduledTimeSlot: "morning",
    });
    expect(res.status).toBe(409);
  });

  it("patient bookings list enriches labName", async () => {
    const db = new MockD1();
    seedPaid(db);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const res = await getJson(app, "/diagnostic-tests/bookings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings[0].labName).toBe("Lab A");
  });
});
