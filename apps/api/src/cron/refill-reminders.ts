// @ts-nocheck

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { medicines, notifications, patients } from "@healthcare/db";
import { notify } from "../lib/notifications";
import { createDb } from "../lib/db";
import {
  formatLocalDate,
  localDayToUtcRange,
  localToday,
} from "../lib/timezone";
import type { AppEnvironment } from "../types";

/**
 * Refill reminder cron. Fires daily at 09:07 SL (03:37 UTC).
 *
 * For every medicine that:
 *   - is active
 *   - has refillReminder = true
 *   - has endDate set AND endDate is within the next REFILL_LOOKAHEAD_DAYS
 *   - has NOT received a refill notification in the last 7 days
 *
 * Dispatches a `prescription`-typed notification (reuses existing
 * preferences slot — no schema change required). User taps → deep-links
 * to the medicine edit screen where they can record the refill.
 *
 * Manual invocation:
 *   POST /__cron/refill-reminders   Header: x-cron-secret: $CRON_SECRET
 */

// How many days ahead of `endDate` we start reminding. Tweakable via env.
const REFILL_LOOKAHEAD_DAYS = Number(
  // Worker env doesn't allow dynamic import-time reads safely across
  // tools (dev vs prod). Hardcode a sensible default; env override below.
  3
);

// Dedup window: don't re-notify the same medicine within this many days.
const REFILL_DEDUP_DAYS = 7;

export const refillRemindersRouter = new Hono<AppEnvironment>();

refillRemindersRouter.post("/__cron/refill-reminders", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";

  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const ok =
    !cronSecret ||
    provided === cronSecret ||
    cookieSecret === cronSecret ||
    isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = createDb(c.env.DB);
  const today = localToday();
  const lookaheadDays = Number(c.env.REFILL_LOOKAHEAD_DAYS) || REFILL_LOOKAHEAD_DAYS;

  // Compute today + lookaheadDays as a local YYYY-MM-DD string.
  const tParts = today.split("-").map((n) => parseInt(n, 10));
  const horizonDate = new Date(tParts[0], tParts[1] - 1, tParts[2] + lookaheadDays);
  const horizon = formatLocalDate(horizonDate);

  // Pull medicines that are ending within the window and opted into
  // refill reminders. endDate IS NOT NULL filters out open-ended meds.
  const rows: any[] = await db
    .select({
      medId: medicines.id,
      medName: medicines.name,
      dosage: medicines.dosage,
      endDate: medicines.endDate,
      patientUserId: patients.userId,
    })
    .from(medicines)
    .innerJoin(patients, eq(patients.id, medicines.patientId))
    .where(
      and(
        eq(medicines.active, true),
        eq(medicines.refillReminder, true),
        isNotNull(medicines.endDate),
        gte(medicines.endDate, today),
        lte(medicines.endDate, horizon)
      )
    )
    .limit(500);

  let sent = 0;
  const skipped: string[] = [];
  const failures: string[] = [];

  for (const row of rows) {
    try {
      // Dedup: skip if a 'prescription' notification with refill flag
      // exists for this medicine in the last REFILL_DEDUP_DAYS days.
      const cutoffLocalDate = new Date(
        tParts[0],
        tParts[1] - 1,
        tParts[2] - REFILL_DEDUP_DAYS
      );
      const { startUtc: cutoffIso } = localDayToUtcRange(
        formatLocalDate(cutoffLocalDate)
      );

      const prior: any[] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, row.patientUserId),
            eq(notifications.type, "prescription"),
            sql`json_extract(${notifications.data}, '$.refill') = 1`,
            sql`json_extract(${notifications.data}, '$.medicineId') = ${row.medId}`,
            gte(notifications.createdAt, cutoffIso)
          )
        )
        .limit(1);
      if (prior.length > 0) {
        skipped.push(row.medId);
        continue;
      }

      const daysLeft = Math.max(
        0,
        Math.round(
          (new Date(row.endDate).getTime() -
            new Date(today).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      );
      const dayWord = daysLeft === 1 ? "day" : "days";
      const title = "Time to refill your medicine";
      const body =
        daysLeft === 0
          ? `Your prescription for ${row.medName} ${row.dosage} ends today.`
          : `Your prescription for ${row.medName} ${row.dosage} ends in ${daysLeft} ${dayWord} (${row.endDate}).`;

      await notify({
        db,
        userId: row.patientUserId,
        type: "prescription",
        title,
        body,
        data: {
          medicineId: row.medId,
          refill: true,
          endDate: row.endDate,
          deepLink: `/edit-medicine?id=${row.medId}`,
        },
      });
      sent++;
    } catch (err: any) {
      failures.push(`${row.medId}: ${err?.message || "unknown"}`);
    }
  }

  return c.json({
    ok: true,
    lookaheadDays,
    horizon,
    scanned: rows.length,
    sent,
    skipped: skipped.length,
    failures: failures.length,
  });
});

// GET helper for ops: who would be reminded if the cron fired now?
refillRemindersRouter.get("/__cron/refill-reminders/preview", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const provided = c.req.header("x-cron-secret");
  const ok = !cronSecret || provided === cronSecret;
  if (!ok) return c.json({ ok: false }, 401);

  const db = createDb(c.env.DB);
  const today = localToday();
  const tParts = today.split("-").map((n) => parseInt(n, 10));
  const horizonDate = new Date(tParts[0], tParts[1] - 1, tParts[2] + REFILL_LOOKAHEAD_DAYS);
  const horizon = formatLocalDate(horizonDate);

  const rows: any[] = await db
    .select({
      medId: medicines.id,
      medName: medicines.name,
      dosage: medicines.dosage,
      endDate: medicines.endDate,
    })
    .from(medicines)
    .where(
      and(
        eq(medicines.active, true),
        eq(medicines.refillReminder, true),
        isNotNull(medicines.endDate),
        gte(medicines.endDate, today),
        lte(medicines.endDate, horizon)
      )
    )
    .limit(100);
  return c.json({
    count: rows.length,
    today,
    horizon,
    samples: rows,
  });
});
