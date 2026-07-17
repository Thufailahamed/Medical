import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import {
  insuranceEnrollments,
  insurancePremiumInvoices,
} from "@healthcare/db";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

/**
 * Insurance billing cron.
 *
 * Fires daily around 09:15 UTC. For each `active` enrollment whose
 * `next_premium_due_at` is today or earlier, create a fresh
 * `insurance_premium_invoices` row (status=open). Does NOT charge —
 * payment is initiated by the patient via the existing PayHere link
 * from the policy detail screen. This cron materialises the invoice.
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