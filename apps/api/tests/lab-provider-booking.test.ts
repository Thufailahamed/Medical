// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildTestApp, postJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagRouter from "../src/routes/diagnostic-tests";

function seedBase(db: MockD1) {
  db.seed("users", [
    { id: "lab-a", role: "laboratory", name: "Lab A" },
    { id: "lab-b", role: "laboratory", name: "Lab B" },
    { id: "pat-u", role: "patient", name: "Pat" },
  ]);
  db.seed("patients", [{ id: "pat-1", userId: "pat-u" }]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "t-1", slug: "cbc", name: "CBC", category: "blood",
      sampleType: "blood", fastingRequired: false, fastingHours: 0,
      homeCollectionAvailable: true, price: 2000, discountPrice: null,
      labPartnerId: null, turnaroundHours: 24, isActive: true,
    },
  ]);
  db.seed("lab_diagnostic_tests", [
    { id: "o-a", labPartnerId: "lab-a", testId: "t-1", price: 1800, discountPrice: null, currency: "LKR", homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true },
    { id: "o-b", labPartnerId: "lab-b", testId: "t-1", price: 1500, discountPrice: 1200, currency: "LKR", homeCollectionAvailable: true, labCollectionAvailable: true, isActive: true },
  ]);
}

const addr = { line1: "1 Main", city: "Colombo", district: "Colombo", contactPhone: "0771234567" };

describe("lab-specific booking", () => {
  it("rejects unknown lab", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const bad = await postJson(app, "/diagnostic-tests/book", {
      bookingType: "single_test", testId: "t-1", labPartnerId: "lab-unknown",
      scheduledDate: "2099-01-01", scheduledTimeSlot: "morning",
      collectionAddress: addr, paymentMethod: "cash",
    });
    expect([400, 404]).toContain(bad.status);
  });

  it("books with explicit lab and uses its price", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const res = await postJson(app, "/diagnostic-tests/book", {
      bookingType: "single_test", testId: "t-1", labPartnerId: "lab-a",
      scheduledDate: "2099-01-02", scheduledTimeSlot: "morning",
      collectionAddress: addr, paymentMethod: "cash",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.labPartnerId).toBe("lab-a");
    expect(body.booking.totalPrice).toBe(1800);
  });

  it("falls back to cheapest offer when lab omitted", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, { id: "pat-u", role: "patient" });
    app.route("/diagnostic-tests", diagRouter);
    const res = await postJson(app, "/diagnostic-tests/book", {
      bookingType: "single_test", testId: "t-1",
      scheduledDate: "2099-01-03", scheduledTimeSlot: "morning",
      collectionAddress: addr, paymentMethod: "cash",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.labPartnerId).toBe("lab-b");
    expect(body.booking.totalPrice).toBe(1200);
  });
});
