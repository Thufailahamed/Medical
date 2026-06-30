// @ts-nocheck

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import {
  medicineDoses,
  medicines,
  patients,
} from "@healthcare/db";
import { notify } from "../lib/notifications";
import { createDb } from "../lib/db";
import {
  scheduleTodayForAllPatients,
} from "../lib/medicine-scheduler";
import type { AppEnvironment } from "../types";

/**
 * Dose reminder cron. Fires every 5 min (Wrangler Cron Trigger).
 * For each dose scheduled in the next 15 min that hasn't been taken or
 * skipped, and hasn't been reminded yet, insert a `notifications` row
 * and dispatch an Expo push. Stamps `medicineDoses.notifiedAt` so the
 * next pass (and any manual re-run) won't double-fire.
 *
 * Manual invocation:
 *   POST /__cron/dose-reminders
 *   Header: x-cron-secret: $CRON_SECRET
 *
 * Why 15-min window + 5-min cron = up to 3 cron passes can see the dose,
 * but `notifiedAt IS NULL` filter ensures exactly one notification.
 */
export const doseRemindersRouter = new Hono<AppEnvironment>();

doseRemindersRouter.post("/__cron/dose-reminders", async (c) => {
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
  const now = new Date();
  const horizon = new Date(now.getTime() + 15 * 60 * 1000);
  const nowIso = now.toISOString();
  const horizonIso = horizon.toISOString();

  // Companion to F1: ensure today's dose rows exist for every patient
  // with active meds. Idempotent — first cron pass per day creates the
  // rows; subsequent passes no-op. Without this, users who never open
  // the app get zero reminders because there are no dose rows to remind.
  const sched = await scheduleTodayForAllPatients(db);

  // Pull doses due in [now, now+15min], not yet taken/skipped/reminded.
  // Join medicines for name+dosage, patients for userId (the notification
  // recipient). One row per pending reminder.
  const rows: any[] = await db
    .select({
      doseId: medicineDoses.id,
      medicineId: medicineDoses.medicineId,
      patientUserId: patients.userId,
      medName: medicines.name,
      dosage: medicines.dosage,
      timing: medicines.timing,
      scheduledFor: medicineDoses.scheduledFor,
    })
    .from(medicineDoses)
    .innerJoin(medicines, eq(medicines.id, medicineDoses.medicineId))
    .innerJoin(patients, eq(patients.id, medicineDoses.patientId))
    .where(
      and(
        gte(medicineDoses.scheduledFor, nowIso),
        lte(medicineDoses.scheduledFor, horizonIso),
        isNull(medicineDoses.takenAt),
        eq(medicineDoses.skipped, false),
        isNull(medicineDoses.notifiedAt)
      )
    )
    .limit(500);

  let sent = 0;
  const failures: string[] = [];
  const stampNow = nowIso;

  for (const row of rows) {
    try {
      // Format the local time-of-day for the notification body.
      // The dose's scheduledFor is UTC ISO; for SL (UTC+5:30) we render
      // the local HH:MM. Use Intl for timezone safety.
      let hhmm = "";
      try {
        hhmm = new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Colombo",
        }).format(new Date(row.scheduledFor));
      } catch {
        hhmm = new Date(row.scheduledFor).toISOString().slice(11, 16);
      }

      const timingSuffix = row.timing ? ` (${row.timing})` : "";
      await notify({
        db,
        userId: row.patientUserId,
        type: "medicine",
        title: "Time for your medicine",
        body: `${row.medName} ${row.dosage}${timingSuffix} — ${hhmm}`,
        data: {
          doseId: row.doseId,
          medicineId: row.medicineId,
          deepLink: `/medicines`,
        },
      });

      // Mark dose as reminded so subsequent cron passes skip it.
      await db
        .update(medicineDoses)
        .set({ notifiedAt: stampNow } as any)
        .where(eq(medicineDoses.id, row.doseId));

      sent++;
    } catch (err: any) {
      failures.push(`${row.doseId}: ${err?.message || "unknown"}`);
    }
  }

  return c.json({
    ok: true,
    scheduled: sched,
    scanned: rows.length,
    sent,
    failures: failures.length,
    window: { from: nowIso, to: horizonIso },
  });
});

// GET helper: who's due right now? Useful for ops debugging.
doseRemindersRouter.get("/__cron/dose-reminders/preview", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const provided = c.req.header("x-cron-secret");
  const ok = !cronSecret || provided === cronSecret;
  if (!ok) return c.json({ ok: false }, 401);

  const db = createDb(c.env.DB);
  const now = new Date();
  const horizon = new Date(now.getTime() + 15 * 60 * 1000);
  const rows: any[] = await db
    .select({
      doseId: medicineDoses.id,
      medicineId: medicineDoses.medicineId,
      scheduledFor: medicineDoses.scheduledFor,
      medName: medicines.name,
      dosage: medicines.dosage,
    })
    .from(medicineDoses)
    .innerJoin(medicines, eq(medicines.id, medicineDoses.medicineId))
    .where(
      and(
        gte(medicineDoses.scheduledFor, now.toISOString()),
        lte(medicineDoses.scheduledFor, horizon.toISOString()),
        isNull(medicineDoses.takenAt),
        eq(medicineDoses.skipped, false),
        isNull(medicineDoses.notifiedAt)
      )
    )
    .limit(100);
  return c.json({
    count: rows.length,
    now: now.toISOString(),
    horizon: horizon.toISOString(),
    samples: rows,
  });
});
