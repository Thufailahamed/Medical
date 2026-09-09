import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gte, like, lte } from "drizzle-orm";
import {
  auditLogs,
  insuranceEnrollments,
  insurancePlans,
  insuranceProviders,
  users,
} from "@healthcare/db";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

/**
 * Insurance premium-reminder cron.
 *
 * Fires daily around 09:00 UTC (14:30 IST). Sends a `premium.due_soon`
 * notification to policyholders whose `next_premium_due_at` is within
 * the next 7 days.
 *
 * Dedup: in-memory notified set per run + audit lookup
 * (`insurance.premium.reminded`) to skip if already notified today.
 * Additive only — no schema migration.
 *
 * Manual invocation:
 *   POST /__cron/insurance-premium-reminders with x-cron-secret header.
 */
export const insurancePremiumRemindersRouter = new Hono<AppEnvironment>();

insurancePremiumRemindersRouter.post(
  "/__cron/insurance-premium-reminders",
  async (c) => {
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
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const rows: any[] = await db
      .select({
        enrollmentId: insuranceEnrollments.id,
        policyNumber: insuranceEnrollments.policyNumber,
        nextPremiumDueAt: insuranceEnrollments.nextPremiumDueAt,
        premiumAmountLkr: insuranceEnrollments.premiumAmountLkr,
        billingCycle: insuranceEnrollments.billingCycle,
        userId: insuranceEnrollments.userId,
        planName: insurancePlans.name,
        providerName: insuranceProviders.name,
      })
      .from(insuranceEnrollments)
      .innerJoin(
        insurancePlans,
        eq(insurancePlans.id, insuranceEnrollments.planId),
      )
      .innerJoin(
        insuranceProviders,
        eq(insuranceProviders.id, insuranceEnrollments.providerId),
      )
      .where(
        and(
          eq(insuranceEnrollments.status, "active"),
          gte(insuranceEnrollments.nextPremiumDueAt, now.toISOString()),
          lte(
            insuranceEnrollments.nextPremiumDueAt,
            horizon.toISOString(),
          ),
        ),
      )
      .limit(1000);

    let sent = 0;
    let skipped = 0;
    const failed: string[] = [];
    const notifiedThisRun = new Set<string>();
    const todayIso = now.toISOString().slice(0, 10);

    for (const row of rows) {
      // In-memory per-run guard: skip duplicates within this execution.
      if (notifiedThisRun.has(row.enrollmentId)) {
        skipped++;
        continue;
      }
      // Skip if already notified today (audit lookup — avoids migration).
      try {
        const prior: any[] = await db
          .select({ createdAt: auditLogs.createdAt })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.action, "insurance.premium.reminded"),
              eq(auditLogs.resourceId, row.enrollmentId),
              like(auditLogs.createdAt, `${todayIso}%`),
            ),
          )
          .limit(1);
        if (prior.length > 0) {
          skipped++;
          continue;
        }
      } catch {
        // Best-effort dedup — if audit lookup fails, fall through to notify.
      }
      try {
        await notify({
          db,
          env: c.env,
          userId: row.userId,
          type: "insurance",
          title: "Premium due soon",
          body: `Your ${row.providerName} ${row.planName} premium of LKR ${row.premiumAmountLkr.toLocaleString()} is due on ${new Date(row.nextPremiumDueAt).toLocaleDateString()}.`,
          data: {
            enrollmentId: row.enrollmentId,
            deepLink: `/insurance/policy/${row.enrollmentId}`,
          },
        });
        notifiedThisRun.add(row.enrollmentId);
        await audit(db, {
          userId: row.userId,
          action: "insurance.premium.reminded",
          resource: "insurance_enrollment",
          resourceId: row.enrollmentId,
          details: { nextPremiumDueAt: row.nextPremiumDueAt },
        });
        sent++;
      } catch (err: any) {
        failed.push(`${row.enrollmentId}: ${err?.message || "unknown"}`);
      }
    }

    return c.json({
      ok: true,
      scanned: rows.length,
      sent,
      skipped,
      failed: failed.length,
    });
  },
);

insurancePremiumRemindersRouter.get(
  "/__cron/insurance-premium-reminders/preview",
  async (c) => {
    const cronSecret = c.env.CRON_SECRET || "";
    const provided = c.req.header("x-cron-secret");
    const ok = !cronSecret || provided === cronSecret;
    if (!ok) return c.json({ ok: false }, 401);
    const db = createDb(c.env.DB);
    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rows: any[] = await db
      .select({
        enrollmentId: insuranceEnrollments.id,
        nextPremiumDueAt: insuranceEnrollments.nextPremiumDueAt,
      })
      .from(insuranceEnrollments)
      .where(
        and(
          eq(insuranceEnrollments.status, "active"),
          gte(insuranceEnrollments.nextPremiumDueAt, now.toISOString()),
          lte(
            insuranceEnrollments.nextPremiumDueAt,
            horizon.toISOString(),
          ),
        ),
      )
      .limit(100);
    return c.json({
      count: rows.length,
      now: now.toISOString(),
      samples: rows,
    });
  },
);
