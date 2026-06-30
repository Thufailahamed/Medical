// @ts-nocheck
// Phase 2.2: vaccination reminder cron. Fires daily at 09:12 SL (03:42 UTC).
//
// For each patient with DOB:
//   1. compute due/overdue slots (reuses lib/vaccine-schedule.ts)
//   2. upsert `vaccine_reminders` rows for slots entering the 30-day window
//   3. for slots where due_date ≤ today+7 and not reminded in the last
//      3 days: dispatch `notify({ type: "vaccination" })` and stamp.
//
// Dedup: `vaccine_reminders.reminder_sent_at` + `reminded_count`. Each
// slot gets at most 2 pushes: an early one (>7d before due) and a final
// one (≤3d before due or past due). `reminded_count` cap = 2.
//
// Manual invocation:
//   POST /__cron/vaccination-reminders
//   Header: x-cron-secret: $CRON_SECRET
//
// Why 09:12 SL: late enough that parents see it during morning routine,
// offset 5min from the 09:07 SL refill cron to avoid stacking the
// same-isolate cold-start.

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, isNull, sql, lte, or } from "drizzle-orm";
import {
  medicalRecords,
  patients,
  users,
  vaccineCatalog,
  vaccineReminders,
} from "@healthcare/db";
import { notify } from "../lib/notifications";
import { computeVaccineDueSlots } from "../lib/vaccine-schedule";
import { createDb } from "../lib/db";
import { localToday, formatLocalDate } from "../lib/timezone";
import { writeAudit } from "../lib/audit";
import { translate, type Locale } from "../lib/locale";
import type { AppEnvironment } from "../types";

const REMINDER_WINDOW_DAYS = 30;  // when we start tracking a slot
const EARLY_REMINDER_DAYS = 7;    // "due in 7 days" first push
const FINAL_REMINDER_DAYS = 3;    // second push: due in ≤3 OR overdue
const MAX_PUSHES_PER_SLOT = 2;
const REMIND_HORIZON_DAYS = 60;   // cap on how far ahead we plan rows

export const vaccinationRemindersRouter = new Hono<AppEnvironment>();

vaccinationRemindersRouter.post("/__cron/vaccination-reminders", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev =
    c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";

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

  // 1. Pull all patients with DOB (vaccine reminders are only useful
  //    for people whose age we can compute). Join users to pick up the
  //    persistent `preferred_locale` so the push is localized.
  const allPatients: any[] = await db
    .select({
      id: patients.id,
      userId: patients.userId,
      dateOfBirth: patients.dateOfBirth,
      preferredLocale: users.preferredLocale,
    })
    .from(patients)
    .leftJoin(users, eq(users.id, patients.userId));

  // 2. Pull catalog + administered vaccines once (avoid per-patient re-fetch).
  const catalog: any[] = await db.select().from(vaccineCatalog);
  const administered: any[] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.recordType, "vaccination"));

  // Index vaccine name lookup by id; resolved per-user locale below.
  const vaccineById = new Map<string, any>(catalog.map((v: any) => [v.id, v]));

  /** Resolve a vaccine's display name in the patient's preferred locale.
   *  Falls back to English (`vaccineCatalog.name`) when the locale column
   *  is NULL or an unsupported locale sneaks in. */
  function vaccineNameFor(vaccineId: string, locale: Locale): string {
    const v = vaccineById.get(vaccineId);
    if (!v) return "";
    if (locale === "si" && v.nameSi) return v.nameSi;
    if (locale === "ta" && v.nameTa) return v.nameTa;
    return v.name;
  }

  function resolveLocale(raw: string | null | undefined): Locale {
    if (raw === "si" || raw === "ta") return raw;
    return "en";
  }

  let scanned = 0;
  let queued = 0;
  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const p of allPatients) {
    try {
      const locale = resolveLocale(p.preferredLocale);
      const slots = computeVaccineDueSlots({
        patient: { dateOfBirth: p.dateOfBirth },
        catalog,
        administered: administered.filter((a) => a.patientId === p.id),
      });

      // Slot window: due OR overdue OR within REMIND_HORIZON_DAYS of future.
      // We don't queue "upcoming" beyond the horizon — those will be
      // picked up when they cross the 30-day threshold in a later run.
      const horizonMs = REMIND_HORIZON_DAYS * 24 * 60 * 60 * 1000;
      const now = new Date();
      const relevantSlots = [...slots.due, ...slots.overdue].filter((s) => {
        const slotMs = new Date(s.dueDate).getTime() - now.getTime();
        return slotMs <= horizonMs;
      });
      scanned += relevantSlots.length;
      if (relevantSlots.length === 0) continue;

      for (const slot of relevantSlots) {
        try {
          const dueDate = slot.dueDate.slice(0, 10); // YYYY-MM-DD

          // 2a. Upsert vaccine_reminders row keyed by (patient, vaccine, dose).
          const reminderId = `vr_${p.id}_${slot.vaccineId}_${slot.dose}`;
          const existing: any[] = await db
            .select()
            .from(vaccineReminders)
            .where(
              and(
                eq(vaccineReminders.patientId, p.id),
                eq(vaccineReminders.vaccineId, slot.vaccineId),
                eq(vaccineReminders.doseIndex, slot.dose)
              )
            )
            .limit(1);

          const prior = existing[0] || null;
          if (!prior) {
            await db
              .insert(vaccineReminders)
              .values({
                id: reminderId,
                patientId: p.id,
                vaccineId: slot.vaccineId,
                doseIndex: slot.dose,
                dueDate,
                remindedCount: 0,
              } as any);
            queued++;
          } else if (prior.dueDate !== dueDate) {
            // Slot date shifted (DOB correction, etc.) — refresh.
            await db
              .update(vaccineReminders)
              .set({ dueDate } as any)
              .where(eq(vaccineReminders.id, prior.id));
          }

          // 2b. Decide whether to push now.
          const remindedCount = prior?.remindedCount ?? 0;
          if (remindedCount >= MAX_PUSHES_PER_SLOT) {
            skipped++;
            continue;
          }

          const lastSent = prior?.reminderSentAt
            ? new Date(prior.reminderSentAt)
            : null;
          const daysSinceLast = lastSent
            ? (now.getTime() - lastSent.getTime()) / (24 * 60 * 60 * 1000)
            : Infinity;

          // Push triggers:
          //   1. Never pushed before AND within EARLY_REMINDER window
          //   2. Within FINAL_REMINDER window (≤3d or overdue)
          // AND we haven't pushed in the last FINAL_REMINDER_DAYS days.
          const inEarlyWindow =
            remindedCount === 0 && slot.daysUntil <= EARLY_REMINDER_DAYS;
          const inFinalWindow =
            slot.daysUntil <= FINAL_REMINDER_DAYS; // includes negative daysUntil
          const cooldownOk = daysSinceLast >= FINAL_REMINDER_DAYS;

          if (!(inEarlyWindow || inFinalWindow) || !cooldownOk) {
            skipped++;
            continue;
          }

          // 2c. Fire notification. Body is pre-localized via translate()
          //     with the user's preferred_locale. Vaccine name resolves to
          //     `name_si` / `name_ta` when set, else English fallback.
          const vaccineLabel = vaccineNameFor(slot.vaccineId, locale);
          const count = slot.daysUntil < 0 ? Math.abs(slot.daysUntil) : slot.daysUntil;
          const tplKey =
            slot.daysUntil < 0
              ? `notifications.vaccination.bodyOverdue_${count === 1 ? "one" : "other"}`
              : slot.daysUntil === 0
              ? `notifications.vaccination.bodyDueToday`
              : `notifications.vaccination.bodyDueSoon_${count === 1 ? "one" : "other"}`;

          const tplFallback =
            slot.daysUntil < 0
              ? `${vaccineLabel} dose ${slot.dose} was due ${count} day${count === 1 ? "" : "s"} ago (${dueDate}).`
              : slot.daysUntil === 0
              ? `${vaccineLabel} dose ${slot.dose} is due today.`
              : `${vaccineLabel} dose ${slot.dose} is due in ${count} day${count === 1 ? "" : "s"} (${dueDate}).`;

          const body = translate(locale, tplKey, tplFallback)
            .replace(/\{\{vaccine\}\}/g, vaccineLabel)
            .replace(/\{\{dose\}\}/g, String(slot.dose))
            .replace(/\{\{count\}\}/g, String(count))
            .replace(/\{\{date\}\}/g, dueDate);

          const title = translate(
            locale,
            "notifications.vaccination.title",
            "Vaccination reminder"
          );

          await notify({
            db,
            userId: p.userId,
            type: "vaccination",
            title,
            body,
            data: {
              vaccineId: slot.vaccineId,
              vaccine: vaccineLabel,
              dose: slot.dose,
              dueDate,
              locale,
              deepLink: `/vaccinations?focus=${slot.vaccineId}`,
            },
          });

          await db
            .update(vaccineReminders)
            .set({
              reminderSentAt: now.toISOString(),
              remindedCount: remindedCount + 1,
            } as any)
            .where(eq(vaccineReminders.id, reminderId));

          await writeAudit(db, {
            userId: p.userId,
            action: "vaccination_reminder",
            details: {
              vaccineId: slot.vaccineId,
              vaccine: slot.vaccine,
              dose: slot.dose,
              dueDate,
              daysUntil: slot.daysUntil,
              remindedCount: remindedCount + 1,
            },
          });

          sent++;
        } catch (err: any) {
          failures.push(
            `${p.id}/${slot.vaccineId}/${slot.dose}: ${err?.message || "unknown"}`
          );
        }
      }
    } catch (err: any) {
      failures.push(`${p.id}: ${err?.message || "unknown"}`);
    }
  }

  return c.json({
    ok: true,
    today,
    scanned,
    queued,
    sent,
    skipped,
    failures: failures.length,
    sampleFailures: failures.slice(0, 5),
  });
});

/**
 * Ops preview: which slots are queued for pushes right now?
 * Useful to verify a new patient has their schedule registered.
 */
vaccinationRemindersRouter.get("/__cron/vaccination-reminders/preview", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const provided = c.req.header("x-cron-secret");
  const ok = !cronSecret || provided === cronSecret;
  if (!ok) return c.json({ ok: false }, 401);

  const db = createDb(c.env.DB);
  const today = localToday();
  const tParts = today.split("-").map((n) => parseInt(n, 10));
  const horizonDate = new Date(tParts[0], tParts[1] - 1, tParts[2] + REMIND_HORIZON_DAYS);
  const horizon = formatLocalDate(horizonDate);

  const rows: any[] = await db
    .select()
    .from(vaccineReminders)
    .where(
      and(
        lte(vaccineReminders.dueDate, horizon),
        or(
          isNull(vaccineReminders.reminderSentAt),
          sql`${vaccineReminders.remindedCount} < ${MAX_PUSHES_PER_SLOT}`
        )
      )
    )
    .limit(50);

  return c.json({ today, horizon, count: rows.length, samples: rows });
});
