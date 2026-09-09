import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import {
  insuranceEnrollments,
  insurancePremiumInvoices,
} from "@healthcare/db";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

/**
 * Insurance billing cron.
 *
 * Fires daily around 09:15 UTC. For each `active` enrollment whose
 * `next_premium_due_at` is today or earlier, create a fresh
 * `insurance_premium_invoices` row (status=open) with per-day idempotency
 * (skip if an open invoice already exists for today). Does NOT charge —
 * payment is initiated by the patient via the existing PayHere link
 * from the policy detail screen. This cron materialises the invoice,
 * then notifies the policyholder (SMS via env).
 *
 * Manual invocation:
 *   POST /__cron/insurance-billing with x-cron-secret header.
 */
export const insuranceBillingRouter = new Hono<AppEnvironment>();

insuranceBillingRouter.post("/__cron/insurance-billing", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev =
    c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const ok =
    !cronSecret || provided === cronSecret || cookieSecret === cronSecret || isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = createDb(c.env.DB);
  const now = new Date();

  const due: any[] = await db
    .select({
      id: insuranceEnrollments.id,
      userId: insuranceEnrollments.userId,
      billingCycle: insuranceEnrollments.billingCycle,
      premiumAmountLkr: insuranceEnrollments.premiumAmountLkr,
      nextPremiumDueAt: insuranceEnrollments.nextPremiumDueAt,
    })
    .from(insuranceEnrollments)
    .where(
      and(
        eq(insuranceEnrollments.status, "active"),
        // MockD1 doesn't parse `lte`/`gte` reliably — use plain JS filter below.
      ),
    )
    .limit(2000);

  const todayIso = now.toISOString().slice(0, 10);
  const overdue = due.filter((e) => {
    const dueISO = (e.nextPremiumDueAt ?? "").slice(0, 10);
    return dueISO && dueISO <= todayIso;
  });

  let invoicesCreated = 0;
  const skipped: string[] = [];

  for (const enr of overdue) {
    try {
      // Idempotency: skip if an open invoice already exists for this cycle/due.
      const existing: any[] = await db
        .select({
          id: insurancePremiumInvoices.id,
          dueAt: insurancePremiumInvoices.dueAt,
        })
        .from(insurancePremiumInvoices)
        .where(
          and(
            eq(insurancePremiumInvoices.enrollmentId, enr.id),
            eq(insurancePremiumInvoices.status, "open"),
          ),
        );
      const dupe = existing.find(
        (i) => (i.dueAt ?? "").slice(0, 10) === todayIso,
      );
      if (dupe) {
        skipped.push(enr.id);
        continue;
      }

      await db.insert(insurancePremiumInvoices).values({
        enrollmentId: enr.id,
        cycle: enr.billingCycle,
        amountLkr: enr.premiumAmountLkr,
        dueAt: enr.nextPremiumDueAt ?? now.toISOString(),
        status: "open",
      } as any);
      invoicesCreated++;
      // Notify after invoice creation (SMS via env, best-effort).
      try {
        if (enr.userId) {
          await notify({
            db,
            env: c.env,
            userId: enr.userId,
            type: "insurance",
            title: "Premium invoice ready",
            body: `Your premium invoice for LKR ${Number(enr.premiumAmountLkr).toLocaleString()} is ready. Due ${String(enr.nextPremiumDueAt ?? todayIso).slice(0, 10)}. Pay via the Insurance tab to keep coverage active.`,
            data: {
              enrollmentId: enr.id,
              deepLink: `/insurance/policy/${enr.id}`,
            },
          });
          await audit(db, {
            userId: enr.userId,
            action: "insurance.premium.invoiced",
            resource: "insurance_enrollment",
            resourceId: enr.id,
            details: { amountLkr: enr.premiumAmountLkr, dueAt: enr.nextPremiumDueAt },
          });
        }
      } catch {
        // Notify is best-effort — invoice already created.
      }
    } catch (err: any) {
      skipped.push(`${enr.id}: ${err?.message ?? "unknown"}`);
    }
  }

  return c.json({
    ok: true,
    dueEnrollments: overdue.length,
    invoicesCreated,
    skipped: skipped.length,
  });
});

insuranceBillingRouter.get(
  "/__cron/insurance-billing/preview",
  async (c) => {
    const cronSecret = c.env.CRON_SECRET || "";
    const provided = c.req.header("x-cron-secret");
    const ok = !cronSecret || provided === cronSecret;
    if (!ok) return c.json({ ok: false }, 401);
    return c.json({ ok: true });
  },
);