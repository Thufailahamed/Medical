import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { buildTestApp, postJson, makeMockRawDb } from "./_testApp";
import { MockD1 } from "./_mockDb";
import paymentsRouter, { setPaymentsLkFetch, setWebhookRawDb } from "../src/routes/payments";

const PATIENT_USER = { id: "patient-001", role: "patient" };
const PLK_ENV = {
  PAYMENTS_LK_SECRET_KEY: "sk_test_abc",
  PAYMENTS_LK_WEBHOOK_SECRET: "whsec_abc",
  PUBLIC_URL: "https://test.local",
};

function seedInvoice(db: MockD1) {
  db.seed("users", [
    { id: "patient-001", role: "patient", email: "p@test.local", name: "P" },
    { id: "staff-001", role: "hospital_admin", email: "s@test.local", name: "S" },
  ]);
  db.seed("patients", [{ id: "pat-001", userId: "patient-001" }]);
  db.seed("invoices", [
    {
      id: "inv-001",
      patientId: "patient-001",
      hospitalId: "hosp-001",
      status: "open",
      totalLkr: 3500,
      createdAt: new Date().toISOString(),
    },
  ]);
}

async function buildApp(db: MockD1, user = PATIENT_USER) {
  const app = await buildTestApp(db, user);
  app.use("*", async (c, next) => {
    for (const [k, v] of Object.entries(PLK_ENV)) (c.env as any)[k] = v;
    await next();
  });
  app.route("/payments", paymentsRouter);
  return app;
}

function checkoutResponse(id = "chk_1", paymentId = "pay_1") {
  return new Response(
    JSON.stringify({ id, url: `https://payments.lk/checkout/${id}`, payment: { id: paymentId } }),
    { status: 201 }
  );
}

function webhookBody(orderId = "HH123") {
  return JSON.stringify({
    id: "evt_w1",
    object: "event",
    type: "payment.succeeded",
    mode: "test",
    created: new Date().toISOString(),
    data: { id: "pay_w1", status: "succeeded", amountCents: 350000, reference: orderId },
  });
}

function webhookSig(body: string, ts = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", PLK_ENV.PAYMENTS_LK_WEBHOOK_SECRET).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

beforeEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });
afterEach(() => { setPaymentsLkFetch(undefined); setWebhookRawDb(undefined); });

describe("POST /payments/checkout (invoice)", () => {
  it("creates a payments.lk checkout and records the payment row", async () => {
    const db = new MockD1();
    seedInvoice(db);
    const fetchMock = vi.fn().mockResolvedValue(checkoutResponse());
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildApp(db);

    const res = await postJson(app, "/payments/checkout", {
      invoiceId: "inv-001",
      returnUrl: "https://test.local/billing/return",
      cancelUrl: "https://test.local/billing",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("paymentslk");
    expect(body.redirectUrl).toContain("payments.lk/checkout");
    expect(body.merchantOrderId).toBe("chk_1");
    expect(body.paymentId).toBe("pay_1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.payments.lk/v1/checkouts");
    expect(init.headers["Idempotency-Key"]).toMatch(/^(HH|TB|INS)/);
    const gwBody = JSON.parse(init.body);
    expect(gwBody.amountCents).toBe(350000);
    expect(gwBody.reference).toBe(init.headers["Idempotency-Key"]);

    const rows = (db as any).tables.payments?.rows ?? [];
    const pay = rows.find((r: any) => r.invoiceId === "inv-001");
    expect(pay).toBeDefined();
    expect(pay.provider).toBe("paymentslk");
    expect(pay.providerChargeId).toBe("pay_1");
  });

  it("404s on someone else's invoice", async () => {
    const db = new MockD1();
    seedInvoice(db);
    setPaymentsLkFetch(vi.fn() as any);
    const app = await buildApp(db, { id: "patient-002", role: "patient" });
    const res = await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" });
    expect(res.status).toBe(404);
  });

  it("503s when gateway not configured", async () => {
    const db = new MockD1();
    seedInvoice(db);
    // Same as buildApp, but with the secret missing.
    const app = await buildTestApp(db, PATIENT_USER);
    app.use("*", async (c, next) => {
      (c.env as any).PUBLIC_URL = PLK_ENV.PUBLIC_URL;
      (c.env as any).PAYMENTS_LK_SECRET_KEY = undefined;
      await next();
    });
    app.route("/payments", paymentsRouter);
    const res = await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" });
    expect(res.status).toBe(503);
  });
});

describe("POST /payments/webhook/paymentslk", () => {
  it("records the event and updates the payments row on payment.succeeded", async () => {
    const db = new MockD1();
    seedInvoice(db);
    const fetchMock = vi.fn().mockResolvedValue(checkoutResponse());
    setPaymentsLkFetch(fetchMock as any);
    const { handle, state } = makeMockRawDb();
    setWebhookRawDb(handle as any);
    const app = await buildApp(db);
    const created = await (await postJson(app, "/payments/checkout", { invoiceId: "inv-001", returnUrl: "https://x" })).json();

    const body = webhookBody(created.merchantOrderId);
    const res = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": webhookSig(body) },
      body,
    });
    expect(res.status).toBe(200);
    expect(state.inserts.length).toBe(1);
    expect(state.updates.some((u) => u.sql.includes("UPDATE payments SET paid_at"))).toBe(true);

    const replay = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Payments-Signature": webhookSig(body) },
      body,
    });
    const replayBody = await replay.json();
    expect(replayBody).toEqual({ ok: true, idempotent: true });
    expect(state.inserts.length).toBe(1);
  });

  it("rejects unsigned deliveries", async () => {
    const db = new MockD1();
    const app = await buildApp(db);
    const res = await app.request("/payments/webhook/paymentslk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: webhookBody(),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /payments/refund", () => {
  it("refunds via payments.lk for paymentslk provider", async () => {
    const db = new MockD1();
    seedInvoice(db);
    db.seed("payments", [
      { id: "pay-001", invoiceId: "inv-001", provider: "paymentslk", providerChargeId: "pay_1", amountLkr: 3500 },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "re_1", status: "pending" }), { status: 201 })
    );
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildApp(db);

    const res = await postJson(app, "/payments/refund", { paymentId: "pay-001", amountCents: 50000, reason: "dup" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refundId).toBe("re_1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.payments.lk/v1/refunds");
    expect(init.headers["Idempotency-Key"]).toBe("refund-pay_1-50000");
  });

  it("502s on gateway refusal", async () => {
    const db = new MockD1();
    seedInvoice(db);
    db.seed("payments", [
      { id: "pay-001", invoiceId: "inv-001", provider: "paymentslk", providerChargeId: "pay_1", amountLkr: 3500 },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "CONFLICT", reason: "not_refundable" }), { status: 409 })
    );
    setPaymentsLkFetch(fetchMock as any);
    const app = await buildApp(db);

    const res = await postJson(app, "/payments/refund", { paymentId: "pay-001" });
    expect(res.status).toBe(502);
  });
});
