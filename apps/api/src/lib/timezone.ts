// apps/api/src/lib/timezone.ts
// Timezone-safe date helpers. Server runs in UTC by convention for
// Cloudflare Workers; user-facing "today" semantics must follow the
// user's wall-clock day, not UTC.
//
// Pairs well with the existing `Date.toISOString()` storage: dose
// timestamps stay in UTC, but query bounds + dedup keys are computed
// against the LOCAL day.

/**
 * Today's date in the server's local timezone (YYYY-MM-DD).
 * Use this for "today" semantics, not `new Date().toISOString().slice(0,10)`
 * which gives the UTC date and is wrong for any user not in UTC.
 */
export function localToday(): string {
  const d = new Date();
  return formatLocalDate(d);
}

/**
 * Format a Date (or ISO string) as a YYYY-MM-DD string in local time.
 */
export function formatLocalDate(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * UTC ISO range that covers the LOCAL calendar day for dateStr.
 * Use these as gte/lte bounds for `scheduledFor` columns.
 *
 * Example (server in UTC, user expects SL UTC+5:30 wall clock):
 *   localDayToUtcRange("2026-07-01")
 *     => { startUtc: "2026-06-30T18:30:00.000Z",
 *          endUtc:   "2026-07-01T18:29:59.999Z" }
 *
 * A dose stored as "09:00 SL local on 2026-07-01" (= 03:30 UTC on
 * 2026-07-01) falls inside that range — matching user expectation.
 */
export function localDayToUtcRange(dateStr: string): {
  startUtc: string;
  endUtc: string;
} {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d || parts.length !== 3) {
    throw new Error(`Invalid YYYY-MM-DD date string: ${dateStr}`);
  }
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    startUtc: startLocal.toISOString(),
    endUtc: endLocal.toISOString(),
  };
}

/**
 * Extract "HH:MM" in the server's local timezone from an ISO timestamp.
 * Use for dedup keys where the slot list ("09:00", "21:00") is in local
 * time — comparing UTC "03:30" against local "09:00" never matches and
 * silently creates duplicate doses.
 */
export function localHHMM(iso: string): string {
  // Date#toTimeString returns "HH:MM:SS GMT+...." in local time.
  return new Date(iso).toTimeString().slice(0, 5);
}
