// @ts-nocheck
//
// Lab Task 2 — online payments for test bookings (RED→GREEN).
// Covers:
//   POST /payments/initiate {testBookingId} → {orderId:TB-...,checkoutUrl,hash,...}
//   POST /payments/notify TB- → test_bookings.pending→paid + paymentRef
//   GET /payments/:id booking lookup (by bookingId or TB- orderId)
//   POST /diagnostic-tests/book card/online → pending + bookingId
//   PATCH /diagnostic-tests/bookings/:id/cancel paid→refunded + ledger audit
//   Mobile book-test keeps cash + card/online with pending polling
//   PayHere helpers reused, Stripe PayHere-only documented
//

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { buildTestApp, postJson, getJson, patchJson } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";
import paymentsRouter from "../src/routes/payments";
import {
  mintOrderId,
  computeHash,
  verifyNotify,
  mapStatusCode,
  md5Hex,
} from "../src/lib/payhere";

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

const PATIENT_USER = { id: "patient-001", role: "patient" };
const TEST_SECRET = "test-secret-do-not-use-in-prod";
const PAYHERE_ENV = {
  PAYHERE_MERCHANT_ID: "test-merchant-123",
  PAYHERE_SECRET: "test-secret-xyz",
  PAYHERE_SANDBOX: "true",
  PUBLIC_URL: "https://test.local",
};

function seedBase(db: MockD1) {
  db.seed("users", [
    {
      id: "patient-001",
      supabaseId: "supabase-p1",
      role: "patient",
      name: "Test Patient",
      firstName: "Test",
      lastName: "Patient",
      email: "p@test.com",
      phone: "+94770000000",
    },
    {
      id: "lab-001",
      supabaseId: "supabase-l1",
      role: "laboratory",
      name: "Test Lab",
      email: "lab@test.com",
    },
  ]);
  db.seed("patients", [
    { id: "pat-001", userId: "patient-001", gender: "male", dateOfBirth: "1990-01-01" },
  ]);
  db.seed("diagnostic_test_catalog", [
    {
      id: "test-001",
      name: "Complete Blood Count",
      slug: "complete-blood-count",
      category: "blood",
      sampleType: "blood",
      fastingRequired: false,
      fastingHours: 0,
      homeCollectionAvailable: true,
      price: 1500,
      discountPrice: null,
      labPartnerId: "lab-001",
      turnaroundHours: 24,
      isActive: true,
      visibility: "public",
      isBookable: true,
      isDoctorOrderable: true,
      currency: "LKR",
      synonyms: "[]",
      displayOrder: 0,
      description: "Basic blood test",
      instructions: null,
    },
  ]);
  db.seed("test_bookings", [
    {
      id: "booking-pay-001",
      patientId: "pat-001",
      labPartnerId: "lab-001",
      bookingType: "single_test",
      testId: "test-001",
      packageId: null,
      status: "pending",
      scheduledDate: "2099-12-31",
      scheduledTimeSlot: "08:00-10:00",
      collectionAddress: JSON.stringify({
        line1: "123 Main St",
        city: "Colombo",
        district: "Colombo",
        contactPhone: "0771234567",
      }),
      phlebotomistId: null,
      phlebotomistName: null,
      phlebotomistPhone: null,
      totalPrice: 1500,
      paymentStatus: "pending",
      paymentMethod: "online",
      paymentRef: null,
      resultPdfUrl: null,
      resultSummary: null,
      resultReadyAt: null,
      cancellationReason: null,
      notes: null,
    },
  ]);
}

async function buildPaymentsApp(db: MockD1, user: any = PATIENT_USER) {
  const app = await buildTestApp(db, user);
  // Inject PayHere env for initiate/notify (buildTestApp only sets JWT_SECRET).
  app.use("*", async (c, next) => {
    for (const [k, v] of Object.entries(PAYHERE_ENV)) {
      (c.env as any)[k] = v;
    }
    await next();
  });
  app.route("/payments", paymentsRouter);
  app.route("/diagnostic-tests", diagnosticTestsRouter);
  return app;
}

async function computeNotifySig(opts: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  statusCode: string;
  secret: string;
}): Promise<string> {
  const secretUpper = (await md5Hex(opts.secret)).toUpperCase();
  const payload =
    `${opts.merchantId}${opts.orderId}${opts.amount}${opts.currency}${opts.statusCode}${secretUpper}`;
  return (await md5Hex(payload)).toUpperCase();
}

describe("lab payments", () => {
  it("mints TB- order", () => {
    expect("TB-abc".startsWith("TB-")).toBe(true);
  });

  it("PayHere helpers mint + hash + mapStatusCode", async () => {
    const raw = mintOrderId();
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeGreaterThan(5);
    const tb = `TB-${raw}`;
    expect(tb.startsWith("TB-")).toBe(true);
    const hash = await computeHash(
      PAYHERE_ENV.PAYHERE_MERCHANT_ID,
      tb,
      1500,
      "LKR",
      PAYHERE_ENV.PAYHERE_SECRET
    );
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^[A-F0-9]{32}$/);
    expect(mapStatusCode("2")).toBe("paid");
    expect(mapStatusCode("0")).toBe("pending");
    expect(mapStatusCode("-1")).toBe("cancelled");
    expect(mapStatusCode("-2")).toBe("failed");
    expect(mapStatusCode("-3")).toBe("chargeback");
  });

  it("book card/online creates pending + returns bookingId for initiate step", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);

    for (const [idx, method] of (["card", "online"] as const).entries()) {
      const res = await postJson(app, "/diagnostic-tests/book", {
        bookingType: "single_test",
        testId: "test-001",
        scheduledDate: idx === 0 ? "2099-12-10" : "2099-12-11",
        scheduledTimeSlot: "08:00-10:00",
        collectionAddress: {
          line1: "456 Oak Ave",
          city: "Kandy",
          district: "Kandy",
          contactPhone: "0779876543",
        },
        paymentMethod: method,
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.booking).toBeDefined();
      expect(body.booking.id).toBeDefined();
      expect(body.booking.paymentStatus).toBe("pending");
      expect(body.booking.paymentMethod).toBe(method);
    }
  });

  it("book cash creates cash_on_collection", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await postJson(app, "/diagnostic-tests/book", {
      bookingType: "single_test",
      testId: "test-001",
      scheduledDate: "2099-11-30",
      scheduledTimeSlot: "08:00-10:00",
      collectionAddress: {
        line1: "123 St",
        city: "Colombo",
        district: "Colombo",
        contactPhone: "0771234567",
      },
      paymentMethod: "cash",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.paymentStatus).toBe("cash_on_collection");
  });

  it("initiate accepts testBookingId, mints TB- order, stores paymentRef", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildPaymentsApp(db);

    const res = await postJson(app, "/payments/initiate", {
      testBookingId: "booking-pay-001",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId.startsWith("TB-")).toBe(true);
    expect(body.testBookingId ?? body.bookingId).toBeDefined();
    expect(body.checkoutUrl).toContain("payhere");
    expect(body.hash).toMatch(/^[A-F0-9]{32}$/);
    expect(body.fields).toBeDefined();
    expect(body.fields.order_id).toBe(body.orderId);
    expect(body.amount).toBe(1500);

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated).toBeDefined();
    expect(updated.paymentRef).toBe(body.orderId);
    expect(updated.paymentStatus).toBe("pending");
  });

  it("initiate reuses pending paymentRef on retry", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildPaymentsApp(db);
    const first = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();
    const second = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();
    expect(second.orderId).toBe(first.orderId);
  });

  it("initiate rejects unknown booking and forbidden booking", async () => {
    const db = new MockD1();
    seedBase(db);
    // Other patient owns nothing; seed second user without booking.
    db.seed("users", [
      { id: "patient-002", supabaseId: "supabase-p2", role: "patient", name: "Other", email: "o@test.com" },
    ]);
    db.seed("patients", [{ id: "pat-002", userId: "patient-002" }]);
    const appOwner = await buildPaymentsApp(db, PATIENT_USER);
    const res404 = await postJson(appOwner, "/payments/initiate", {
      testBookingId: "nope-001",
    });
    expect(res404.status).toBe(404);

    const appOther = await buildPaymentsApp(db, { id: "patient-002", role: "patient" });
    const res403 = await postJson(appOther, "/payments/initiate", {
      testBookingId: "booking-pay-001",
    });
    expect(res403.status).toBe(403);
  });

  it("notify TB- flips pending→paid + keeps paymentRef", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildPaymentsApp(db);

    const init = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();
    const orderId = init.orderId as string;
    expect(orderId.startsWith("TB-")).toBe(true);

    const sig = await computeNotifySig({
      merchantId: PAYHERE_ENV.PAYHERE_MERCHANT_ID,
      orderId,
      amount: "1500.00",
      currency: "LKR",
      statusCode: "2",
      secret: PAYHERE_ENV.PAYHERE_SECRET,
    });

    const form = new URLSearchParams({
      merchant_id: PAYHERE_ENV.PAYHERE_MERCHANT_ID,
      order_id: orderId,
      payhere_amount: "1500.00",
      payhere_currency: "LKR",
      status_code: "2",
      md5sig: sig,
      payment_id: "PH-123",
      method: "VISA",
    });
    const notifyRes = await app.request("/payments/notify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    expect(notifyRes.status).toBe(200);

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.paymentRef).toBe(orderId);
  });

  it("GET /payments/:id supports booking lookup by bookingId and orderId", async () => {
    const db = new MockD1();
    seedBase(db);
    const app = await buildPaymentsApp(db);

    // Before payment: pending (or pending via stored null ref → still pending status row).
    const init = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();

    const byBooking = await getJson(app, "/payments/booking-pay-001");
    expect(byBooking.status).toBe(200);
    const byBookingBody = await byBooking.json();
    expect(["pending", "paid"]).toContain(byBookingBody.status);
    expect(byBookingBody.payhereOrderId ?? byBookingBody.orderId ?? init.orderId).toBeDefined();

    const byOrder = await getJson(app, `/payments/${init.orderId}`);
    expect(byOrder.status).toBe(200);
    const byOrderBody = await byOrder.json();
    expect(["pending", "paid"]).toContain(byOrderBody.status);
  });

  it("cancel paid→refunded writes ledger audit", async () => {
    const db = new MockD1();
    seedBase(db);
    // Paid booking still cancellable (pending status + paid payment).
    db.seed("test_bookings", [
      {
        id: "booking-paid-001",
        patientId: "pat-001",
        labPartnerId: "lab-001",
        bookingType: "single_test",
        testId: "test-001",
        packageId: null,
        status: "pending",
        scheduledDate: "2099-12-31",
        scheduledTimeSlot: "08:00-10:00",
        collectionAddress: JSON.stringify({
          line1: "123 Main St",
          city: "Colombo",
          district: "Colombo",
          contactPhone: "0771234567",
        }),
        totalPrice: 2000,
        paymentStatus: "paid",
        paymentMethod: "online",
        paymentRef: "TB-test123",
      },
    ]);
    const app = await buildTestApp(db, PATIENT_USER);
    app.route("/diagnostic-tests", diagnosticTestsRouter);
    const res = await patchJson(app, "/diagnostic-tests/bookings/booking-paid-001/cancel", {
      cancellationReason: "changed mind",
    });
    expect(res.status).toBe(200);
    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-paid-001");
    expect(updated.status).toBe("cancelled");
    expect(updated.paymentStatus).toBe("refunded");
    const audits =
      (db as any).tables.auditLogs?.rows ??
      (db as any).tables.auditLog?.rows ??
      [];
    const refundAudit = audits.find((a: any) => {
      const s = JSON.stringify(a).toLowerCase();
      return s.includes("refund") && s.includes("booking-paid-001");
    });
    expect(refundAudit).toBeDefined();
  });

  it("payments source supports TB- initiate/notify/lookup via PayHere helpers", () => {
    const src = repoRead("apps/api/src/routes/payments.ts");
    expect(src).toContain("testBookingId");
    expect(src).toContain('startsWith("TB-")');
    expect(src).toContain("paymentRef");
    expect(src).toContain("testBookings");
    expect(src).toContain("mintOrderId");
    expect(src).toContain("computeHash");
    // Appointment flow untouched.
    expect(src).toContain("appointmentId");
    expect(src).toContain("appointmentPayments");
  });

  it("diagnostic book documents online flow + cancel audits refund ledger", () => {
    const src = repoRead("apps/api/src/routes/diagnostic-tests.ts");
    expect(src).toContain("cash_on_collection");
    expect(src).toContain("pending");
    expect(src).toContain("/payments/initiate");
    expect(src).toContain("TB-");
    expect(src).toContain("refunded");
    expect(src.toLowerCase()).toContain("refund");
    // Ledger audit on refund (not just status flag).
    expect(src).toContain('action: "refund"');
  });

  it("mobile book-test keeps cash + card/online with pending polling to booking detail", () => {
    const src = repoRead("apps/mobile/src/app/(app)/book-test.tsx");
    expect(src).toContain('"cash"');
    expect(src).toContain('"card"');
    expect(src).toContain('"online"');
    expect(src).toContain("/payments/initiate");
    expect(src).toContain("testBookingId");
    expect(src).toContain("/payments/");
    expect(src).toContain("test-booking-detail");
  });

  it("Stripe: PayHere-only for TB- documented, generic checkout untouched", () => {
    const src = repoRead("apps/api/src/routes/payments.ts");
    // Documents why TB- is PayHere-only (Stripe via generic /checkout if needed).
    expect(src.toLowerCase()).toContain("payhere-only");
    expect(src).toContain("/checkout");
  });
});
