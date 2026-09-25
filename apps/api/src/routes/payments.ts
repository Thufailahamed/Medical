// @ts-nocheck
// payments.lk flow for appointments + lab test bookings.
// Endpoints:
//   POST /payments/initiate            → mint order, create hosted checkout
//     Body: { appointmentId } for consultations (HH- order, appointmentPayments)
//     Body: { testBookingId } for lab bookings (TB- order, test_bookings.paymentRef)
//   POST /payments/webhook/paymentslk  → payments.lk signed webhook
//     Dispatch: HH-* → appointmentPayments, TB-* → test_bookings, INS-* → insurance
//   GET  /payments/:id                 → patient polls status
//     :id accepts appointmentId, test bookingId, or TB-/HH- orderId
//
// All amounts in LKR. Sandbox vs live is decided by the key prefix
// (sk_test_ / sk_live_) — no separate sandbox URL.

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { appointments, appointmentPayments, doctors, users, patients, testBookings, invoices, payments as paymentsTable } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { createDb } from "../lib/db";
import { logger } from "../lib/logger";
import {
  PaymentsLkAdapter,
  mintOrderId,
  type PaymentsLkEnv,
} from "../lib/payments/paymentslk";
import {
  handleInsurancePremiumPaid,
  handleInsurancePremiumFailed,
} from "./insurance-marketplace";
import { PaymentError, PaymentErrorCode } from "../lib/payments/errors";
import { tryRecordWebhook, markWebhookProcessed } from "../lib/payments/webhook-idempotency";
import type { AppEnvironment } from "../types";

export const paymentsLk = new PaymentsLkAdapter();

/** Test hook: inject a fetch mock for gateway calls. */
export function setPaymentsLkFetch(fetchImpl?: typeof fetch): void {
  (paymentsLk as any).opts.fetchImpl = fetchImpl;
}

let webhookRawDb: unknown = undefined;

/** Test hook: inject a raw D1 handle for webhook idempotency + raw SQL. */
export function setWebhookRawDb(rawDb?: unknown): void {
  webhookRawDb = rawDb;
}

const paymentsRouter = new Hono<AppEnvironment>();

/**
 * POST /payments/initiate
 * Body: { appointmentId } | { testBookingId }
 * Returns: { orderId, amount, currency, checkoutUrl, provider }
 *
 * Appointment flow (HH- order, appointmentPayments) and lab flow
 * ({ testBookingId } loads test_bookings.totalPrice, mints TB- order,
 * stores paymentRef, paymentStatus=pending) both create a payments.lk
 * hosted checkout server-side.
 * Flow: POST /diagnostic-tests/book (card/online → pending + bookingId)
 *   → POST /payments/initiate {testBookingId} → payments.lk checkout
 *   → POST /payments/webhook/paymentslk (TB- → pending→paid)
 *   → GET /payments/:id polls.
 * Patient must own the appointment/booking. If a `pending` payment already
 * exists, reuse it (idempotency key = order id, so the gateway replays).
 */
paymentsRouter.post(
  "/initiate",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const { appointmentId, testBookingId } = body;

    const env = c.env;
    if (!env.PAYMENTS_LK_SECRET_KEY) {
      return c.json(
        {
          error:
            "Payments not configured. Set PAYMENTS_LK_SECRET_KEY.",
        },
        503
      );
    }

    // ─── Lab flow: test booking (TB- prefix) ─────────────
    // Reuses pending paymentRef if present.
    if (testBookingId && typeof testBookingId === "string") {
      const [booking] = await db
        .select()
        .from(testBookings)
        .where(eq(testBookings.id, testBookingId))
        .limit(1);
      if (!booking) {
        return c.json({ error: "Test booking not found" }, 404);
      }

      const [owner] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, booking.patientId))
        .limit(1);
      if (!owner || owner.userId !== userId) {
        return c.json({ error: "Not your booking" }, 403);
      }

      if (["cancelled", "completed", "rescheduled"].includes(booking.status)) {
        return c.json(
          { error: `Cannot pay for a ${booking.status} booking` },
          400
        );
      }
      if (booking.paymentStatus === "paid") {
        return c.json({ error: "Booking already paid" }, 400);
      }

      const amount = booking.totalPrice;
      if (!amount || amount <= 0) {
        return c.json(
          { error: "Booking has no fee. Skip payment." },
          400
        );
      }

      // Reuse pending TB- order if one already exists for this booking.
      let orderId: string | null = null;
      if (
        booking.paymentRef &&
        typeof booking.paymentRef === "string" &&
        booking.paymentRef.startsWith("TB-") &&
        booking.paymentStatus === "pending"
      ) {
        orderId = booking.paymentRef;
      }
      if (!orderId) {
        orderId = `TB-${mintOrderId()}`;
        await db
          .update(testBookings)
          .set({
            paymentRef: orderId,
            paymentStatus: "pending",
            // Cash bookings moving online now charge via payments.lk.
            paymentMethod:
              booking.paymentMethod === "cash" ? "online" : booking.paymentMethod,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(testBookings.id, testBookingId));
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const fullName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.name ||
        user?.email?.split("@")[0] ||
        "Patient";

      const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";

      const result = await paymentsLk.createCheckout(
        {
          amountCents: Math.round(amount * 100),
          description: `Lab test booking ${booking.scheduledDate} ${booking.scheduledTimeSlot}`.slice(0, 120),
          reference: orderId,
          successUrl: `${publicUrl}/lab/payment/return?order=${orderId}`,
          cancelUrl: `${publicUrl}/lab/payment/cancel?order=${orderId}`,
          customer: {
            name: fullName.slice(0, 80),
            email: user?.email || "noreply@healthhub.app",
          },
        },
        env as PaymentsLkEnv
      );

      return c.json({
        orderId,
        bookingId: testBookingId,
        testBookingId,
        paymentRef: orderId,
        amount,
        currency: "LKR",
        checkoutUrl: result.redirectUrl,
        provider: result.provider,
      });
    }

    if (!appointmentId || typeof appointmentId !== "string") {
      return c.json({ error: "appointmentId or testBookingId required" }, 400);
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
      orderId = existing.gatewayOrderId;
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
        gatewayOrderId: orderId,
      });
    }

    // Customer fields.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email?.split("@")[0] ||
      "Patient";

    const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";

    const result = await paymentsLk.createCheckout(
      {
        amountCents: Math.round(amount * 100),
        description: `Consultation ${appt.date} ${appt.time}`.slice(0, 120),
        reference: orderId,
        successUrl: `${publicUrl}/payment/return?order=${orderId}`,
        cancelUrl: `${publicUrl}/payment/cancel?order=${orderId}`,
        customer: {
          name: fullName.slice(0, 80),
          email: user?.email || "noreply@healthhub.app",
        },
      },
      env as PaymentsLkEnv
    );

    return c.json({
      orderId,
      paymentId,
      amount,
      currency: "LKR",
      checkoutUrl: result.redirectUrl,
      provider: result.provider,
    });
  }
);

/**
 * GET /payments/:id
 * Patient polls to check if notify has flipped status to `paid`.
 * :id accepts appointmentId (HH- flow), test bookingId, or TB-/HH- orderId.
 * Appointment flow untouched; booking fallback added for Lab Task 2.
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
    if (!appt) {
      // Lab Task 2 fallback: booking lookup by bookingId or TB- paymentRef.
      let [booking] = await db
        .select()
        .from(testBookings)
        .where(eq(testBookings.id, appointmentId))
        .limit(1);
      if (!booking) {
        [booking] = await db
          .select()
          .from(testBookings)
          .where(eq(testBookings.paymentRef, appointmentId))
          .limit(1);
      }
      if (!booking) return c.json({ error: "Not found" }, 404);

      const [bPatient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, booking.patientId))
        .limit(1);
      if (!bPatient || bPatient.userId !== userId) {
        return c.json({ error: "Forbidden" }, 403);
      }

      return c.json({
        status: booking.paymentStatus,
        bookingId: booking.id,
        testBookingId: booking.id,
        amountLkr: booking.totalPrice,
        currency: "LKR",
        method: booking.paymentMethod,
        gatewayOrderId: booking.paymentRef,
        paymentRef: booking.paymentRef,
        bookingStatus: booking.status,
      });
    }

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
      method: payment.gatewayMethod,
      gatewayOrderId: payment.gatewayOrderId,
      gatewayPaymentId: payment.gatewayPaymentId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  }
);

export default paymentsRouter;

// ─────────────────────────────────────────────────────────────────────
// Generic payment routes (hospital-billing invoices) — payments.lk only.
// Uses the `payments` table for any invoice — not appointment-bound.
// The appointment/lab flow stays in /initiate above.
// ─────────────────────────────────────────────────────────────────────

paymentsRouter.post("/checkout", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const { invoiceId, returnUrl, cancelUrl } = body as {
    invoiceId?: string;
    returnUrl?: string;
    cancelUrl?: string;
  };
  if (!invoiceId || !returnUrl) {
    return c.json({ error: "invoiceId, returnUrl required" }, 400);
  }

  if (!c.env.PAYMENTS_LK_SECRET_KEY) {
    return c.json({ error: "Payments not configured. Set PAYMENTS_LK_SECRET_KEY." }, 503);
  }

  const [invoice] = await db
    .select({ id: invoices.id, totalLkr: invoices.totalLkr })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.patientId, userId)))
    .limit(1);
  if (!invoice) {
    return c.json({ error: "invoice not found" }, 404);
  }

  const orderId = mintOrderId();
  const result = await paymentsLk.createCheckout(
    {
      amountCents: Math.round(invoice.totalLkr * 100),
      description: `HealthHub invoice ${invoice.id}`.slice(0, 120),
      reference: orderId,
      successUrl: returnUrl,
      cancelUrl,
    },
    c.env as PaymentsLkEnv
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
    providerChargeId: result.paymentId ?? result.merchantOrderId,
  });
  await audit(db, { userId, action: "payments.checkout", resource: "payment", resourceId: result.merchantOrderId });
  return c.json(result);
});

paymentsRouter.post("/webhook/paymentslk", async (c) => {
  const env = c.env;
  if (!env.PAYMENTS_LK_WEBHOOK_SECRET) {
    return c.text("payments not configured", 503);
  }

  const raw = await c.req.text();
  const sig = c.req.header("Payments-Signature") ?? "";
  let event;
  try {
    event = paymentsLk.verifyWebhook(raw, sig, env as PaymentsLkEnv);
  } catch (e) {
    if (e instanceof PaymentError) {
      return c.json({ ok: false, code: e.code }, 401);
    }
    throw e;
  }

  // Drizzle db for row dispatch; raw D1 handle for idempotency + raw SQL.
  const db = (c.get("db") as any) ?? createDb(env.DB);
  const rawDb = (webhookRawDb as any) ?? env.DB;

  const rec = await tryRecordWebhook(rawDb, event.provider, event.eventId, event.raw);
  if (!rec.isNew) {
    return c.json({ ok: true, idempotent: true });
  }

  const orderId = event.merchantOrderId;
  try {
    // INS- orders dispatch to the insurance activation flow.
    if (orderId.startsWith("INS-")) {
      if (event.statusCode === 2) {
        await handleInsurancePremiumPaid(env as any, orderId, event.paymentId, "paymentslk");
      } else {
        await handleInsurancePremiumFailed(env as any, orderId, String(event.statusCode));
      }
    } else {
      // Consultation payments: appointmentPayments row keyed by the minted
      // gatewayOrderId.
      const [row] = await db
        .select()
        .from(appointmentPayments)
        .where(eq(appointmentPayments.gatewayOrderId, orderId))
        .limit(1);

      if (row) {
        const status = event.statusCode === 2 ? "paid" : "failed";
        await db
          .update(appointmentPayments)
          .set({
            status,
            gatewayPaymentId: event.paymentId,
            gatewayStatusCode: String(event.statusCode),
            gatewayMethod: "card",
            rawNotify: JSON.stringify(event.raw),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(appointmentPayments.id, row.id));

        if (event.statusCode === 2) {
          await db
            .update(appointments)
            .set({ paymentStatus: "paid", status: "confirmed" })
            .where(eq(appointments.id, row.appointmentId));
          await notify({
            db,
            userId: row.userId,
            type: "appointment",
            title: "Payment confirmed",
            body: `Your appointment payment of LKR ${row.amountLkr.toFixed(2)} was successful.`,
            data: { appointmentId: row.appointmentId, paymentId: row.id },
          });
          await audit(db, {
            userId: row.userId,
            action: "payment.paid",
            entityType: "appointment",
            entityId: row.appointmentId,
            details: {
              amountLkr: row.amountLkr,
              gatewayOrderId: orderId,
              gatewayPaymentId: event.paymentId,
              provider: "paymentslk",
            },
          });
        }
      } else if (orderId.startsWith("TB-")) {
        // Lab bookings: flip test_bookings pending→paid.
        const [booking] = await db
          .select()
          .from(testBookings)
          .where(eq(testBookings.paymentRef, orderId))
          .limit(1);
        if (booking && event.statusCode === 2 && booking.paymentStatus !== "paid") {
          await db
            .update(testBookings)
            .set({
              paymentStatus: "paid",
              status: booking.status === "pending" ? "confirmed" : booking.status,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(testBookings.id, booking.id));
          const [owner] = await db
            .select()
            .from(patients)
            .where(eq(patients.id, booking.patientId))
            .limit(1);
          await notify({
            db,
            env,
            userId: owner?.userId ?? booking.patientId,
            type: "lab_ready",
            title: "Payment confirmed",
            body: `Your lab booking payment of LKR ${Number(booking.totalPrice).toFixed(2)} was successful.`,
            data: { bookingId: booking.id, testBookingId: booking.id, paymentRef: orderId },
          }).catch(() => {});
          await audit(db, {
            userId: owner?.userId ?? booking.patientId,
            action: "payment.paid",
            resource: "test_booking",
            resourceId: booking.id,
            details: {
              amountLkr: booking.totalPrice,
              gatewayOrderId: orderId,
              gatewayPaymentId: event.paymentId,
              provider: "paymentslk",
            },
          }).catch(() => {});
        }
      } else if (event.statusCode === 2) {
        // Generic invoice path: stamp paid_at on the recorded charge.
        await rawDb
          .prepare(
            "UPDATE payments SET paid_at = datetime('now'), webhook_received_at = datetime('now') WHERE provider_charge_id = ?"
          )
          .bind(event.paymentId ?? orderId)
          .run();
      }
    }
  } catch (err) {
    logger.error("payments.webhook.paymentslk", "dispatch failed", {
      orderId,
      err: String(err),
    });
    // Still mark processed so payments.lk stops retrying.
  }

  await markWebhookProcessed(rawDb, rec.id, String(event.statusCode));
  await audit(db as any, {
    action: "payments.webhook",
    resource: "payment",
    resourceId: orderId,
    details: { provider: event.provider, statusCode: event.statusCode, orderId },
  });
  return c.json({ ok: true });
});

paymentsRouter.post("/refund", authMiddleware, requireRole("patient", "super_admin"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const { paymentId, amountCents, reason } = body as {
    paymentId?: string;
    amountCents?: number;
    reason?: string;
  };
  if (!paymentId) return c.json({ error: "paymentId required" }, 400);

  const [payment] = await db
    .select({
      id: paymentsTable.id,
      provider: paymentsTable.provider,
      providerChargeId: paymentsTable.providerChargeId,
      patientId: invoices.patientId,
    })
    .from(paymentsTable)
    .innerJoin(invoices, eq(paymentsTable.invoiceId, invoices.id))
    .where(eq(paymentsTable.id, paymentId))
    .limit(1);

  if (!payment) {
    return c.json({ error: "payment not found" }, 404);
  }

  if (payment.provider === "paymentslk" && payment.providerChargeId) {
    try {
      const result = await paymentsLk.refund(
        { paymentId: payment.providerChargeId, amountCents, reason },
        c.env as PaymentsLkEnv
      );
      await audit(db, { userId, action: "payments.refund", resource: "payment", resourceId: paymentId, details: { provider: payment.provider } });
      return c.json(result);
    } catch (e) {
      if (e instanceof PaymentError) {
        // Gateway refusal (e.g. not yet settled / not refundable).
        return c.json({ error: e.message }, 502);
      }
      throw e;
    }
  }

  return c.json({ error: "refund not supported for this provider" }, 501);
});

paymentsRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const rows = await db
    .select({
      id: paymentsTable.id,
      invoiceId: paymentsTable.invoiceId,
      amountLkr: paymentsTable.amountLkr,
      provider: paymentsTable.provider,
      paidAt: paymentsTable.paidAt,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .innerJoin(invoices, eq(paymentsTable.invoiceId, invoices.id))
    .where(eq(invoices.patientId, userId))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(50);
  return c.json({ payments: rows });
});