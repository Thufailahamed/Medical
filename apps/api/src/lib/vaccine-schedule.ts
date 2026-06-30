// @ts-nocheck
// Phase 2.2: shared vaccine-due-slot computation. Used by:
//   - apps/api/src/routes/vaccinations.ts  (GET /me/due, on-read compute)
//   - apps/api/src/cron/vaccination-reminders.ts  (daily push)
// Extracted so the cron + the route compute due windows identically —
// no drift between what the user sees and what gets notified.

export interface VaccineSlot {
  vaccineId: string;
  vaccine: string;
  shortName?: string | null;
  dose: number;            // 1-indexed
  doseLabel: string;
  dueDate: string;          // ISO timestamp
  daysUntil: number;
  targetDisease?: string | null;
}

interface CatalogRow {
  id: string;
  name: string;
  shortName?: string | null;
  targetDisease?: string | null;
  schedule: string;          // JSON: [{ monthsFromBirth, label }]
}

interface AdministeredRow {
  title?: string | null;
  recordDate?: string | null;
  createdAt?: string | null;
}

export function ageInMonths(dob: string | null, ref: Date): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ms = ref.getTime() - birth.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30.4375));
}

function parseSchedule(scheduleJson: string): { monthsFromBirth: number; label: string }[] {
  try {
    const arr = JSON.parse(scheduleJson);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Compute due / overdue / upcoming vaccine slots for a patient.
 *
 * - `due`      : due within 30 days (positive daysUntil ≤ 30)
 * - `overdue`  : past due, AND user is not yet adult for childhood doses
 * - `upcoming` : due in > 30 days
 *
 * Slots the user has already administered are filtered out — we match
 * catalog name (loosely) against administered record titles.
 */
export function computeVaccineDueSlots(args: {
  patient: { dateOfBirth?: string | null };
  catalog: CatalogRow[];
  administered: AdministeredRow[];
  now?: Date;
}): {
  due: VaccineSlot[];
  overdue: VaccineSlot[];
  upcoming: VaccineSlot[];
} {
  const now = args.now ?? new Date();
  const ageMonths = ageInMonths(args.patient.dateOfBirth ?? null, now);
  const due: VaccineSlot[] = [];
  const overdue: VaccineSlot[] = [];
  const upcoming: VaccineSlot[] = [];

  for (const v of args.catalog) {
    const schedule = parseSchedule(v.schedule);
    if (schedule.length === 0) continue;

    const matched = args.administered.filter((a) => {
      const t = (a.title || "").toLowerCase();
      return (
        t.includes(v.name.toLowerCase()) ||
        v.name.toLowerCase().includes(t) ||
        (v.shortName && t.includes(v.shortName.toLowerCase()))
      );
    });
    const lastDoseIndex = matched.length;

    for (let i = lastDoseIndex; i < schedule.length; i++) {
      const slot = schedule[i];
      if (ageMonths == null) continue;

      const slotDate = new Date(args.patient.dateOfBirth || now.toISOString());
      slotDate.setMonth(slotDate.getMonth() + (slot.monthsFromBirth || 0));
      const diffMs = slotDate.getTime() - now.getTime();
      const daysUntil = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const item: VaccineSlot = {
        vaccineId: v.id,
        vaccine: v.name,
        shortName: v.shortName,
        dose: i + 1,
        doseLabel: slot.label,
        dueDate: slotDate.toISOString(),
        daysUntil,
        targetDisease: v.targetDisease,
      };

      if (daysUntil < 0) {
        const isUserAdult = ageMonths >= 216;
        const isChildhoodVaccine = (slot.monthsFromBirth || 0) < 216;
        if (isUserAdult && isChildhoodVaccine) continue;
        overdue.push(item);
      } else if (daysUntil <= 30) {
        due.push(item);
      } else {
        upcoming.push(item);
      }
    }
  }

  overdue.sort((a, b) => a.daysUntil - b.daysUntil);
  due.sort((a, b) => a.daysUntil - b.daysUntil);
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  return { due, overdue, upcoming };
}