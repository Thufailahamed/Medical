// @ts-nocheck
// Phase 5: PayHere payment flow for appointments.
// Endpoints:
//   POST /payments/initiate    → mint order, return checkout fields
//   POST /payments/notify      → PayHere server-to-server callback
//   GET  /payments/:appointmentId → patient polls status
//
// All amounts in LKR. PayHere sandbox vs live controlled via env.

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { appointments, appointmentPayments, doctors, users, patients, invoices, payments as paymentsTable } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { createDb } from "../lib/db";
import { logger } from "../lib/logger";
import {
  mintOrderId,
  computeHash,
  verifyNotify,
  mapStatusCode,
  checkoutUrl,
  isSandbox,
  type PayHereStatus,
} from "../lib/payhere";
import {
  handleInsurancePremiumPaid,
  handleInsurancePremiumFailed,
} from "./insurance-marketplace";
import { StripeAdapter } from "../lib/payments/stripe";
import { PaymentError, PaymentErrorCode } from "../lib/payments/errors";
import { tryRecordWebhook, markWebhookProcessed } from "../lib/payments/webhook-idempotency";
import type { AppEnvironment } from "../types";

const stripeAdapter = new StripeAdapter();

const paymentsRouter = new Hono<AppEnvironment>();

/**
 * POST /payments/initiate
 * Body: { appointmentId }
 * Returns: { orderId, amount, currency, hash, checkoutUrl, fields }
 *
 * Patient must own the appointment. If a `pending` payment already exists
 * for this appointment, reuse it (avoids PayHere rejecting duplicate
 * order_ids). The mobile app posts these fields to PayHere.checkout().
 */
paymentsRouter.post(
  "/initiate",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const { appointmentId } = body;
    if (!appointmentId || typeof appointmentId !== "string") {
      return c.json({ error: "appointmentId required" }, 400);
    }

    const env = c.env;
    const merchantId = env.PAYHERE_MERCHANT_ID;
    const secret = env.PAYHERE_SECRET;
    if (!merchantId || !secret) {
      return c.json(
        {
          error:
            "Payments not configured. Set PAYHERE_MERCHANT_ID and PAYHERE_SECRET.",
        },
        503
      );
    }

    // Load appointment + verify ownership.
    const [appt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appt) {
      return c.json({ error: "Appointment not found" }, 404);
    }

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, appt.patientId))
      .limit(1);
    if (!patient || patient.userId !== userId) {
      return c.json({ error: "Not your appointment" }, 403);
    }

    if (["cancelled", "completed", "no_show"].includes(appt.status)) {
      return c.json(
        { error: `Cannot pay for a ${appt.status} appointment` },
        400
      );
    }

    // Determine fee: use appointment.paymentAmount if set, else doctor.consultationFee.
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, appt.doctorId))
      .limit(1);
    const amount =
      appt.paymentAmount ??
      doctor?.consultationFee ??
      0;
    if (!amount || amount <= 0) {
      return c.json(
        { error: "Appointment has no fee. Skip payment." },
        400
      );
    }

    // Reuse any pending payment for this appointment.
    const [existing] = await db
      .select()
      .from(appointmentPayments)
      .where(
        and(
          eq(appointmentPayments.appointmentId, appointmentId),
          eq(appointmentPayments.status, "pending")
        )
      )
      .limit(1);

    let orderId: string;
    let paymentId: string;
    if (existing) {
      orderId = existing.payhereOrderId;
      paymentId = existing.id;
    } else {
      orderId = mintOrderId();
      paymentId = crypto.randomUUID();
      await db.insert(appointmentPayments).values({
        id: paymentId,
        appointmentId,
        userId,
        amountLkr: amount,
        currency: "LKR",
        status: "pending",
        payhereOrderId: orderId,
      });
    }

    const hash = await computeHash(
      merchantId,
      orderId,
      amount,
      "LKR",
      secret
    );

    // Customer fields. PayHere requires at least name + email + phone.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email?.split("@")[0] ||
      "Patient";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || "-";

    const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";

    const fields = {
      merchant_id: merchantId,
      return_url: `${publicUrl}/payment/return?order=${orderId}`,
      cancel_url: `${publicUrl}/payment/cancel?order=${orderId}`,
      notify_url: `${publicUrl}/api/payments/notify`,
      order_id: orderId,
      items: `Consultation ${appt.date} ${appt.time}`,
      currency: "LKR",
      amount: amount.toFixed(2),
      first_name: firstName,
      last_name: lastName,
      email: user?.email || "noreply@healthhub.app",
      phone: user?.phone || "+94770000000",
      address: "Sri Lanka",
      city: "Colombo",
      country: "Sri Lanka",
      hash,
    };

    return c.json({
      orderId,
      paymentId,
      amount,
      currency: "LKR",
      hash,
      checkoutUrl: checkoutUrl(env),
      sandbox: isSandbox(env),
      fields,
    });
  }
);

/**
 * POST /payments/notify
 * PayHere server-to-server callback (form-encoded).
 * Verifies md5sig, then updates payment row + appointment status.
 *
 * NO auth middleware — PayHere calls this directly. We verify by signature.
 */
paymentsRouter.post("/notify", async (c) => {
  const env = c.env;
  const merchantId = env.PAYHERE_MERCHANT_ID;
  const secret = env.PAYHERE_SECRET;
  if (!merchantId || !secret) {
    return c.text("payments not configured", 503);
  }

  const db = createDb(env.DB);

  const form = await c.req.parseBody();
  const merchant_id = String(form.merchant_id || "");
  const order_id = String(form.order_id || "");
  const payhere_amount = String(form.payhere_amount || "");
  const payhere_currency = String(form.payhere_currency || "");
  const status_code = String(form.status_code || "");
  const md5sig = String(form.md5sig || "");
  const payhere_payment_id = form.payment_id ? String(form.payment_id) : null;
  const method = form.method ? String(form.method) : null;

  if (!order_id || !md5sig) {
    return c.text("invalid notify payload", 400);
  }

  const ok = await verifyNotify(
    {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    },
    secret
  );
  if (!ok) {
    logger.error("payments.notify", "signature mismatch", { orderId: order_id });
    return c.text("invalid signature", 400);
  }

  const [row] = await db
    .select()
    .from(appointmentPayments)
    .where(eq(appointmentPayments.payhereOrderId, order_id))
    .limit(1);

  // Dispatch insurance premium payments to their own handler. The order_id
  // prefix INS- (set by insurance-marketplace/enrollments/:id/pay) marks
  // a PayHere order routed here for activation. The handler flips the
  // premium_invoice, mints the policy_number, generates an E-card, and
  // notifies the patient.
  if (!row) {
    if (order_id.startsWith("INS-")) {
      const mapped = mapStatusCode(status_code);
      try {
        if (mapped === "paid") {
          await handleInsurancePremiumPaid(
            env,
            order_id,
            payhere_payment_id,
            method,
          );
        } else if (mapped === "failed" || mapped === "cancelled") {
          await handleInsurancePremiumFailed(
            env,
            order_id,
            String(mapped),
          );
        }
      } catch (err) {
        logger.error("payments.notify", "insurance dispatch failed", {
          orderId: order_id,
          err: String(err),
        });
        // Still ack so PayHere stops retrying.
      }
      return c.text("ok", 200);
    }
    logger.warn("payments.notify", "notify for unknown order", { orderId: order_id });
    return c.text("ok", 200); // ack so PayHere stops retrying
  }

  const mapped = mapStatusCode(status_code);
  const isPaid = mapped === "paid";

  await db
    .update(appointmentPayments)
    .set({
      status: mapped === "paid" ? "paid" : mapped === "chargeback" ? "refunded" : mapped === "cancelled" ? "failed" : "failed",
      payherePaymentId: payhere_payment_id,
      payhereStatusCode: status_code,
      payhereMethod: method,
      rawNotify: JSON.stringify(form),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appointmentPayments.id, row.id));

  if (isPaid) {
    await db
      .update(appointments)
      .set({
        paymentStatus: "paid",
        status: "confirmed",
      })
      .where(eq(appointments.id, row.appointmentId));

    // Notify patient.
    await notify({
      db,
      userId: row.userId,
      type: "appointment",
      title: "Payment confirmed",
      body: `Your appointment payment of LKR ${row.amountLkr.toFixed(2)} was successful.`,
      data: { appointmentId: row.appointmentId, paymentId: row.id },
    });

    await audit({
      db,
      userId: row.userId,
      action: "payment.paid",
      entityType: "appointment",
      entityId: row.appointmentId,
      details: {
        amountLkr: row.amountLkr,
        payhereOrderId: order_id,
        payherePaymentId: payhere_payment_id,
        method,
      },
    });
  } else if (mapped === "failed" || mapped === "cancelled") {
    await audit({
      db,
      userId: row.userId,
      action: "payment.failed",
      entityType: "appointment",
      entityId: row.appointmentId,
      details: {
        statusCode: status_code,
        reason: mapped,
      },
    });
  }

  return c.text("ok", 200);
});

/**
 * GET /payments/:appointmentId
 * Patient polls to check if notify has flipped status to `paid`.
 */
paymentsRouter.get(
  "/:appointmentId",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const appointmentId = c.req.param("appointmentId");

    const [appt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appt) return c.json({ error: "Not found" }, 404);

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, appt.patientId))
      .limit(1);
    if (!patient || patient.userId !== userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const [payment] = await db
      .select()
      .from(appointmentPayments)
      .where(eq(appointmentPayments.appointmentId, appointmentId))
      .orderBy(desc(appointmentPayments.createdAt))
      .limit(1);

    if (!payment) {
      return c.json({ status: "none" });
    }
    return c.json({
      status: payment.status,
      amountLkr: payment.amountLkr,
      currency: payment.currency,
      method: payment.payhereMethod,
      payhereOrderId: payment.payhereOrderId,
      payherePaymentId: payment.payherePaymentId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  }
);

// Helper removed: notify handler now uses createDb(env.DB) directly,
// matching the pattern in cron handlers.

export default paymentsRouter;

// ─────────────────────────────────────────────────────────────────────
// Generic gateway-agnostic payment routes (added in Block A).
// Coexists with the appointment-specific /initiate + /notify above.
// Uses `payments` (hospital-billing) table for any invoice — not
// appointment-bound. PayHere appointment flow stays in /initiate.
// ─────────────────────────────────────────────────────────────────────

paymentsRouter.post("/checkout", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const { invoiceId, method, returnUrl, cancelUrl } = body as {
    invoiceId?: string;
    method?: "payhere" | "stripe";
    returnUrl?: string;
    cancelUrl?: string;
  };
  if (!invoiceId || !method || !returnUrl) {
    return c.json({ error: "invoiceId, method, returnUrl required" }, 400);
  }

  const [invoice] = await db
    .select({ id: schema.invoices.id, totalLkr: schema.invoices.totalLkr })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.patientId, userId)))
    .limit(1);
  if (!invoice) {
    return c.json({ error: "invoice not found" }, 404);
  }

  if (method === "stripe") {
    const result = await stripeAdapter.createCheckout(
      { invoiceId, method, returnUrl, cancelUrl },
      c.env as any
    );
    await db.insert(paymentsTable).values({
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      amountLkr: invoice.totalLkr,
      method: "card",
      reference: result.merchantOrderId,
      receivedByUserId: userId,
      paidAt: new Date().toISOString(),
      provider: result.provider,
      providerChargeId: result.merchantOrderId,
    });
    await audit(db, { userId, action: "payments.checkout", resource: "payment", resourceId: result.merchantOrderId });
    return c.json(result);
  }

  return c.json({ error: "PayHere checkout for non-appointment invoices not yet wired — use /payments/initiate for appointments" }, 501);
});

paymentsRouter.post("/webhook/stripe", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("stripe-signature") ?? "";
  let event;
  try {
    event = stripeAdapter.verifyWebhook(raw, sig, c.env as any);
  } catch (e) {
    if (e instanceof PaymentError) {
      return c.json({ ok: false, code: e.code }, 401);
    }
    throw e;
  }

  const db = c.env.DB;
  const rec = await tryRecordWebhook(db as any, event.provider, event.eventId, event.raw);
  if (!rec.isNew) {
    return c.json({ ok: true, idempotent: true });
  }

  if (event.statusCode === 2) {
    await db
      .prepare(
        "UPDATE payments SET paid_at = datetime('now'), webhook_received_at = datetime('now') WHERE provider_charge_id = ?"
      )
      .bind(event.merchantOrderId)
      .run();
  }
  await markWebhookProcessed(db as any, rec.id, String(event.statusCode));
  await audit(db as any, {
    action: "payments.webhook",
    resource: "payment",
    resourceId: event.merchantOrderId,
    details: { provider: event.provider, statusCode: event.statusCode },
  });
  return c.json({ ok: true });
});

paymentsRouter.post("/refund", authMiddleware, requireRole("patient", "super_admin"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const { paymentId, amountMinor, reason } = body as {
    paymentId?: string;
    amountMinor?: number;
    reason?: string;
  };
  if (!paymentId) return c.json({ error: "paymentId required" }, 400);

  const [payment] = await db
    .select({
      id: schema.payments.id,
      provider: schema.payments.provider,
      providerChargeId: schema.payments.providerChargeId,
      patientId: invoices.patientId,
    })
    .from(paymentsTable)
    .innerJoin(invoices, eq(paymentsTable.invoiceId, invoices.id))
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) {
    return c.json({ error: "payment not found" }, 404);
  }

  if (payment.provider === "stripe" && payment.providerChargeId) {
    const result = await stripeAdapter.refund(
      { paymentId: payment.providerChargeId, amountMinor, reason },
      c.env as any
    );
    await audit(db, { userId, action: "payments.refund", resource: "payment", resourceId: paymentId, details: { provider: payment.provider } });
    return c.json(result);
  }

  return c.json({ error: "refund not supported for this provider" }, 501);
});

paymentsRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const rows = await db
    .select({
      id: schema.payments.id,
      invoiceId: schema.payments.invoiceId,
      amountLkr: schema.payments.amountLkr,
      provider: schema.payments.provider,
      paidAt: schema.payments.paidAt,
      createdAt: schema.payments.createdAt,
    })
    .from(paymentsTable)
    .innerJoin(invoices, eq(paymentsTable.invoiceId, invoices.id))
    .where(eq(invoices.patientId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);
  return c.json({ payments: rows });
});