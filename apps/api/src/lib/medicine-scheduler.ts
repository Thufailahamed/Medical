// apps/api/src/lib/medicine-scheduler.ts
// Server-side dose scheduling helper. Extracted from doses.ts so both
// the mobile POST /schedule/today endpoint AND the dose-reminders cron
// can produce today's dose rows idempotently.
//
// Idempotent: existingKey (medicineId @ local HH:MM) prevents duplicate
// inserts across multiple invocations. Safe to call repeatedly.

import { and, eq, gte, lte, isNull, or, sql } from "drizzle-orm";
import { medicineDoses, medicines } from "@healthcare/db";
import {
  localDayToUtcRange,
  localHHMM,
  localToday,
} from "./timezone";
import { slotsForFrequency } from "./medicine-slots";

/**
 * Ensures today's doses exist for one patient: reads active medicines,
 * inserts dose rows for any (medicineId, HH:MM) slot that doesn't yet
 * have a row in today's local-day window. Returns #rows created.
 *
 * @param offsetMinutes - user's UTC offset in minutes (e.g. 330 for
 *   Asia/Colombo UTC+5:30). Defaults to 330 (Sri Lanka) when omitted.
 */
export async function scheduleTodayForPatient(
  db: any,
  patientId: string,
  offsetMinutes: number = 330
): Promise<{ created: number; date: string }> {
  const today = localToday(offsetMinutes);
  const { startUtc: dayStartIso, endUtc: dayEndIso } =
    localDayToUtcRange(today, offsetMinutes);
  const now = new Date();

  const activeMeds = await db
    .select()
    .from(medicines)
    .where(
      and(eq(medicines.patientId, patientId), eq(medicines.active, true))
    );

  const existing = await db
    .select()
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.patientId, patientId),
        gte(medicineDoses.scheduledFor, dayStartIso),
        lte(medicineDoses.scheduledFor, dayEndIso)
      )
    );
  const existingKey = new Set(
    existing.map((e: any) => `${e.medicineId}@${localHHMM(e.scheduledFor, offsetMinutes)}`)
  );

  let created = 0;
  for (const med of activeMeds) {
    const m: any = (med as any).medicines || med;
    const start = m.startDate ?? today;
    const end = m.endDate ?? today;
    if (today < start || today > end) continue;

    for (const time of slotsForFrequency(m.frequency, m.timing)) {
      const key = `${m.id}@${time}`;
      if (existingKey.has(key)) continue;

      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const scheduled = new Date(now);
      scheduled.setHours(hh ?? 9, mm ?? 0, 0, 0);

      await db.insert(medicineDoses).values({
        medicineId: m.id,
        patientId,
        scheduledFor: scheduled.toISOString(),
      } as any);
      existingKey.add(key);
      created++;
    }
  }
  return { created, date: today };
}

/**
 * Returns the patient IDs that have at least one active medicine whose
 * [startDate, endDate] window includes today. Used by the cron to limit
 * the schedule-today fan-out to patients who actually need it.
 */
export async function patientsWithActiveMedsToday(
  db: any,
  offsetMinutes: number = 330
): Promise<string[]> {
  const today = localToday(offsetMinutes);
  // startDate <= today AND (endDate IS NULL OR endDate >= today).
  // SQLite D1 supports the IS NULL branch via or() + isNull().
  const rows: any[] = await db
    .selectDistinct({ patientId: medicines.patientId })
    .from(medicines)
    .where(
      and(
        eq(medicines.active, true),
        lte(medicines.startDate, today),
        or(isNull(medicines.endDate), gte(medicines.endDate, today))
      )
    );
  return rows.map((r: any) => r.patientId).filter(Boolean);
}

/**
 * Server-side schedule-today fan-out. Iterates every patient with
 * active meds in today's window and ensures their dose rows exist.
 * Returns aggregate counts.
 */
export async function scheduleTodayForAllPatients(
  db: any,
  offsetMinutes: number = 330
): Promise<{ patients: number; created: number }> {
  const patientIds = await patientsWithActiveMedsToday(db, offsetMinutes);
  let created = 0;
  for (const pid of patientIds) {
    const r = await scheduleTodayForPatient(db, pid, offsetMinutes);
    created += r.created;
  }
  return { patients: patientIds.length, created };
}
