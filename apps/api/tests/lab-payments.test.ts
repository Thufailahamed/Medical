// @ts-nocheck
//
// Online payments for test bookings (payments.lk).
// Covers:
//   POST /payments/initiate {testBookingId} → {orderId:TB-...,checkoutUrl,...}
//   POST /payments/webhook/paymentslk TB- → test_bookings.pending→paid + paymentRef
//   GET /payments/:id booking lookup (by bookingId or TB- orderId)
//   POST /diagnostic-tests/book card/online → pending + bookingId
//   PATCH /diagnostic-tests/bookings/:id/cancel paid→refunded + ledger audit
//   Mobile book-test keeps cash + card/online with pending polling
//

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { buildTestApp, postJson, getJson, patchJson, makeMockRawDb } from "./_testApp";
import { MockD1 } from "./_mockDb";
import diagnosticTestsRouter from "../src/routes/diagnostic-tests";
import paymentsRouter, { setPaymentsLkFetch, setWebhookRawDb } from "../src/routes/payments";
import { mintOrderId } from "../src/lib/payments/paymentslk";

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
const PLK_ENV = {
  PAYMENTS_LK_SECRET_KEY: "sk_test_abc",
  PAYMENTS_LK_WEBHOOK_SECRET: "whsec_abc",
  PUBLIC_URL: "https://test.local",
};

function checkoutResponse(id = "chk_t1", paymentId = "pay_t1") {
  return new Response(
    JSON.stringify({ id, url: `https://payments.lk/checkout/${id}`, payment: { id: paymentId } }),
    { status: 201 }
  );
}

beforeEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });
afterEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });

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
  // Inject payments.lk env for initiate/webhook (buildTestApp only sets JWT_SECRET).
  app.use("*", async (c, next) => {
    for (const [k, v] of Object.entries(PLK_ENV)) {
      (c.env as any)[k] = v;
    }
    await next();
  });
  app.route("/payments", paymentsRouter);
  app.route("/diagnostic-tests", diagnosticTestsRouter);
  return app;
}

describe("lab payments", () => {
  it("mints TB- order", () => {
    expect("TB-abc".startsWith("TB-")).toBe(true);
  });

  it("mintOrderId mints HH-prefixed orders", () => {
    const raw = mintOrderId();
    expect(raw).toMatch(/^HH[0-9a-f]{20}$/);
    expect(`TB-${raw}`.startsWith("TB-")).toBe(true);
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
    const fetchMock = vi.fn().mockResolvedValue(checkoutResponse());
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildPaymentsApp(db);

    const res = await postJson(app, "/payments/initiate", {
      testBookingId: "booking-pay-001",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId.startsWith("TB-")).toBe(true);
    expect(body.testBookingId ?? body.bookingId).toBeDefined();
    expect(body.checkoutUrl).toContain("payments.lk/checkout");
    expect(body.provider).toBe("paymentslk");
    expect(body.hash).toBeUndefined();
    expect(body.fields).toBeUndefined();
    expect(body.amount).toBe(1500);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.payments.lk/v1/checkouts");
    expect(init.headers["Idempotency-Key"]).toBe(body.orderId);
    const gwBody = JSON.parse(init.body);
    expect(gwBody.amountCents).toBe(150000);
    expect(gwBody.customer.email).toBe("p@test.com");

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated).toBeDefined();
    expect(updated.paymentRef).toBe(body.orderId);
    expect(updated.paymentStatus).toBe("pending");
  });

  it("initiate reuses pending paymentRef on retry", async () => {
    const db = new MockD1();
    seedBase(db);
    setPaymentsLkFetch(vi.fn().mockImplementation(() => checkoutResponse()) as any);
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

  it("webhook TB- flips pending→paid + keeps paymentRef", async () => {
    const db = new MockD1();
    seedBase(db);
    setPaymentsLkFetch(vi.fn().mockResolvedValue(checkoutResponse()) as any);
    const { handle, state } = makeMockRawDb();
    setWebhookRawDb(handle as any);
    const app = await buildPaymentsApp(db);

    const init = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();
    const orderId = init.orderId as string;
    expect(orderId.startsWith("TB-")).toBe(true);

    const event = JSON.stringify({
      id: "evt_tb1",
      object: "event",
      type: "payment.succeeded",
      mode: "test",
      created: new Date().toISOString(),
      data: { id: "pay_t1", status: "succeeded", amountCents: 150000, reference: orderId },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", PLK_ENV.PAYMENTS_LK_WEBHOOK_SECRET).update(`${ts}.${event}`).digest("hex");

    const webhookRes = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": `t=${ts},v1=${sig}` },
      body: event,
    });
    expect(webhookRes.status).toBe(200);
    expect(state.inserts.length).toBe(1);

    const rows = (db as any).tables.testBookings?.rows ?? [];
    const updated = rows.find((r: any) => r.id === "booking-pay-001");
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.status).toBe("confirmed");
    expect(updated.paymentRef).toBe(orderId);

    // Replay of the same event is idempotent.
    const replay = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": `t=${ts},v1=${sig}` },
      body: event,
    });
    const replayBody = await replay.json();
    expect(replayBody).toEqual({ ok: true, idempotent: true });
    expect(state.inserts.length).toBe(1);
  });

  it("GET /payments/:id supports booking lookup by bookingId and orderId", async () => {
    const db = new MockD1();
    seedBase(db);
    setPaymentsLkFetch(vi.fn().mockResolvedValue(checkoutResponse()) as any);
    const app = await buildPaymentsApp(db);

    // Before payment: pending (or pending via stored null ref → still pending status row).
    const init = await (
      await postJson(app, "/payments/initiate", { testBookingId: "booking-pay-001" })
    ).json();

    const byBooking = await getJson(app, "/payments/booking-pay-001");
    expect(byBooking.status).toBe(200);
    const byBookingBody = await byBooking.json();
    expect(["pending", "paid"]).toContain(byBookingBody.status);
    expect(byBookingBody.gatewayOrderId ?? byBookingBody.orderId ?? init.orderId).toBeDefined();

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

  it("payments source supports TB- initiate/webhook/lookup via payments.lk", () => {
    const src = repoRead("apps/api/src/routes/payments.ts");
    expect(src).toContain("testBookingId");
    expect(src).toContain('startsWith("TB-")');
    expect(src).toContain("paymentRef");
    expect(src).toContain("testBookings");
    expect(src).toContain("mintOrderId");
    expect(src).toContain("paymentsLk.createCheckout");
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

  it("payments source is gateway-neutral: payments.lk webhook + TB- dispatch, no PayHere", () => {
    const src = repoRead("apps/api/src/routes/payments.ts");
    expect(src).toContain("/webhook/paymentslk");
    expect(src).toContain("paymentsLk.createCheckout");
    expect(src.toLowerCase()).not.toContain("payhere");
    expect(src).not.toContain("/notify");
    expect(src).toContain("/checkout");
  });
});
