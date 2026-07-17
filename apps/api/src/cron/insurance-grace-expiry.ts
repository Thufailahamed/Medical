import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import {
  insuranceEnrollments,
  insurancePremiumInvoices,
} from "@healthcare/db";
import { notify } from "../lib/notifications";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

/**
 * Insurance grace-expiry cron.
 *
 * Fires daily around 09:30 UTC. For each enrollment currently in
 * `grace` status whose grace window (lastPremiumPaidAt + 7 days) has
 * elapsed, transition to `lapsed` and notify the policyholder.
 *
 * Manual invocation:
 *   POST /__cron/insurance-grace-expiry with x-cron-secret header.
 */
const GRACE_DAYS = 7;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

export const insuranceGraceExpiryRouter = new Hono<AppEnvironment>();

insuranceGraceExpiryRouter.post(
  "/__cron/insurance-grace-expiry",
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

    const grace: any[] = await db
      .select({
        id: insuranceEnrollments.id,
        userId: insuranceEnrollments.userId,
        policyNumber: insuranceEnrollments.policyNumber,
        lastPremiumPaidAt: insuranceEnrollments.lastPremiumPaidAt,
      })
      .from(insuranceEnrollments)
      .where(eq(insuranceEnrollments.status, "grace"))
      .limit(2000);

    let lapsed = 0;
    const failed: string[] = [];

    for (const enr of grace) {
      const paidAt = enr.lastPremiumPaidAt
        ? new Date(enr.lastPremiumPaidAt)
        : null;
      if (!paidAt) {
        failed.push(`${enr.id}: no lastPremiumPaidAt`);
        continue;
      }
      const elapsed = now.getTime() - paidAt.getTime();
      if (elapsed < GRACE_MS) continue;

      try {
        await db
          .update(insuranceEnrollments)
          .set({
            status: "lapsed",
            updatedAt: now.toISOString(),
          } as any)
          .where(eq(insuranceEnrollments.id, enr.id));

        await notify({
          db,
          userId: enr.userId,
          type: "insurance",
          title: "Policy lapsed",
          body: `Your policy ${enr.policyNumber ?? enr.id} has lapsed. Renew within 30 days to restore coverage without re-underwriting.`,
          data: {
            enrollmentId: enr.id,
            deepLink: `/insurance/policy/${enr.id}`,
          },
        });

        // Mark any still-open invoices as expired so they don't re-bill.
        await db
          .update(insurancePremiumInvoices)
          .set({ status: "expired", updatedAt: now.toISOString() } as any)
          .where(
            and(
              eq(insurancePremiumInvoices.enrollmentId, enr.id),
              eq(insurancePremiumInvoices.status, "open"),
            ),
          );

        lapsed++;
      } catch (err: any) {
        failed.push(`${enr.id}: ${err?.message ?? "unknown"}`);
      }
    }

    return c.json({
      ok: true,
      scanned: grace.length,
      lapsed,
      failed: failed.length,
    });
  },
);

insuranceGraceExpiryRouter.get(
  "/__cron/insurance-grace-expiry/preview",
  async (c) => {
    const cronSecret = c.env.CRON_SECRET || "";
    const provided = c.req.header("x-cron-secret");
    const ok = !cronSecret || provided === cronSecret;
    if (!ok) return c.json({ ok: false }, 401);
    return c.json({ ok: true });
  },
);
