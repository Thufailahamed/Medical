// @ts-nocheck
//
// Day 4 #5 — refill prediction. NO LLM — pure heuristic over the
// `medicines` table. For each active medicine, estimate an "expected
// end date" from:
//
//   1. The row's explicit `endDate` if present.
//   2. Otherwise: `startDate + typicalDurationDays(frequency, dosage)`.
//
// `typicalDurationDays` is a conservative lookup table tuned for the
// most common chronic-disease regimens. Anything we can't classify
// falls back to a 30-day course.
//
// We then return medicines whose expectedEnd is within `withinDays` of
// today. The mobile app shows a "refill soon" badge; the patient can
// tap to request a prescription renewal from their doctor.
//
// Cost: $0 — pure SQL + a tiny JS lookup. Free tier fully covered.

export interface RefillCandidate {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  expectedEndDate: string;
  daysRemaining: number;
  refillReminder: boolean;
  source: "explicit" | "inferred" | "unknown";
}

/**
 * Conservative default durations (days) keyed by a lowercased snippet
 * of `frequency` or `dosage`. The matchers are intentionally
 * substring-based because real-world data is messy ("twice daily",
 * "BID", "bd", "2x/d" all coexist).
 */
const DURATION_HINTS: Array<{ hint: string; days: number }> = [
  { hint: "weekly", days: 7 },
  { hint: "1 week", days: 7 },
  { hint: "2 week", days: 14 },
  { hint: "fortnight", days: 14 },
  { hint: "month", days: 30 },
  { hint: "1 month", days: 30 },
  { hint: "3 month", days: 90 },
  { hint: "quarter", days: 90 },
  { hint: "6 month", days: 180 },
  { hint: "annual", days: 365 },
  { hint: "year", days: 365 },
  // Common antibiotics get shorter courses.
  { hint: "5 day", days: 5 },
  { hint: "7 day", days: 7 },
  { hint: "10 day", days: 10 },
  { hint: "14 day", days: 14 },
];

const FALLBACK_DURATION_DAYS = 30;

/**
 * Parse a frequency string like "twice daily" / "BID" / "OD" into a
 * per-day dose count. Used to bias the inferred duration for chronic
 * meds (1/day → ~90 days for a 3-month prescription, etc.).
 */
function dosesPerDay(frequency: string | null): number | null {
  if (!frequency) return null;
  const f = frequency.toLowerCase();
  if (/\b(od|once daily|once a day|qd|q\.d\.)\b/.test(f)) return 1;
  if (/\b(bd|bid|twice daily|twice a day|2 ?x ?(a ?day|per day|daily))\b/.test(f)) return 2;
  if (/\b(tds|tid|three times|3 ?x ?(a ?day|per day|daily))\b/.test(f)) return 3;
  if (/\b(qid|four times|4 ?x ?(a ?day|per day|daily))\b/.test(f)) return 4;
  if (/\b(prn|as needed|when required)\b/.test(f)) return 1;
  return null;
}

/**
 * Infer the typical duration for a medicine row. Tries the explicit
 * `endDate` first (handled outside this function), then the most
 * informative string fragment in `frequency`/`dosage`, then falls
 * back to a 30-day course.
 */
function inferDurationDays(input: {
  frequency: string | null;
  dosage: string | null;
}): { days: number; source: "inferred" | "unknown" } {
  const haystack = [input.frequency, input.dosage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack) {
    for (const h of DURATION_HINTS) {
      if (haystack.includes(h.hint)) return { days: h.days, source: "inferred" };
    }
  }
  // Chronic meds (1/day) default to 90 days; acute meds to 14.
  const dpd = dosesPerDay(input.frequency);
  if (dpd === 1) return { days: 90, source: "inferred" };
  if (dpd && dpd >= 2) return { days: 30, source: "inferred" };
  return { days: FALLBACK_DURATION_DAYS, source: "unknown" };
}

/**
 * Add `days` to an ISO `YYYY-MM-DD` date string. Defensive against
 * malformed input — returns the input unchanged if we can't parse.
 */
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the expected end date for a medicine row.
 */
export function expectedEndDate(input: {
  startDate: string;
  endDate?: string | null;
  frequency?: string | null;
  dosage?: string | null;
}): { date: string; source: "explicit" | "inferred" | "unknown" } {
  if (input.endDate) {
    return { date: input.endDate, source: "explicit" };
  }
  const { days, source } = inferDurationDays({
    frequency: input.frequency ?? null,
    dosage: input.dosage ?? null,
  });
  return { date: addDays(input.startDate, days), source };
}

/**
 * Days remaining until `expectedEnd`. Negative = already overdue.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const end = new Date(iso);
  if (isNaN(end.getTime())) return 0;
  const ms = end.getTime() - now.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Given a list of active medicines and a `withinDays` horizon, return
 * the rows that need a refill within that window. Sorted ascending by
 * days remaining (most urgent first).
 */
export function findRefillsDue(
  medicines: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency?: string | null;
    timing?: string | null;
    startDate: string;
    endDate?: string | null;
    refillReminder?: boolean | null;
    active?: boolean | null;
  }>,
  withinDays: number = 14,
  now: Date = new Date()
): RefillCandidate[] {
  const candidates: RefillCandidate[] = [];
  for (const m of medicines) {
    if (m.active === false) continue;
    const { date, source } = expectedEndDate({
      startDate: m.startDate,
      endDate: m.endDate ?? null,
      frequency: m.frequency ?? null,
      dosage: m.dosage,
    });
    const remaining = daysUntil(date, now);
    if (remaining <= withinDays) {
      candidates.push({
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency ?? null,
        timing: m.timing ?? null,
        startDate: m.startDate,
        expectedEndDate: date,
        daysRemaining: remaining,
        refillReminder: !!m.refillReminder,
        source,
      });
    }
  }
  candidates.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return candidates;
}

export const REFILL_DEFAULTS = {
  withinDays: 14,
  fallbackDurationDays: FALLBACK_DURATION_DAYS,
};