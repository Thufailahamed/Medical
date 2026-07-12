// apps/api/src/lib/timezone.ts
// Timezone-safe date helpers. Server runs in UTC by convention for
// Cloudflare Workers; user-facing "today" semantics must follow the
// user's wall-clock day, not UTC.
//
// Pairs well with the existing `Date.toISOString()` storage: dose
// timestamps stay in UTC, but query bounds + dedup keys are computed
// against the LOCAL day.
//
// All helpers accept an optional `offsetMinutes` parameter (the
// user's UTC offset in minutes, e.g. 330 for Asia/Colombo UTC+5:30).
// When omitted, falls back to the server's local time (current behavior).

/**
 * Today's date in the user's timezone (YYYY-MM-DD).
 * Pass `offsetMinutes` from the user's profile for correct results
 * on UTC servers. Falls back to server local time if omitted.
 */
export function localToday(offsetMinutes?: number): string {
  if (offsetMinutes != null) {
    // Compute local date by applying offset to current UTC time
    const now = Date.now();
    const localMs = now + offsetMinutes * 60_000;
    const d = new Date(localMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
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
 * When `offsetMinutes` is provided, the range is computed relative to
 * the user's timezone. Otherwise, uses the server's local time.
 *
 * Example (offsetMinutes=330, user expects SL UTC+5:30 wall clock):
 *   localDayToUtcRange("2026-07-01", 330)
 *     => { startUtc: "2026-06-30T18:30:00.000Z",
 *          endUtc:   "2026-07-01T18:29:59.999Z" }
 *
 * A dose stored as "09:00 SL local on 2026-07-01" (= 03:30 UTC on
 * 2026-07-01) falls inside that range — matching user expectation.
 */
export function localDayToUtcRange(
  dateStr: string,
  offsetMinutes?: number
): { startUtc: string; endUtc: string } {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d || parts.length !== 3) {
    throw new Error(`Invalid YYYY-MM-DD date string: ${dateStr}`);
  }

  if (offsetMinutes != null) {
    // Build UTC timestamps for the user's local midnight and end-of-day
    // by subtracting the offset from the local date components.
    // UTC = local - offset, so startUtc = Date.UTC(y,m,d,0,0,0) - offset
    const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMinutes * 60_000;
    const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMinutes * 60_000;
    return {
      startUtc: new Date(startUtcMs).toISOString(),
      endUtc: new Date(endUtcMs).toISOString(),
    };
  }

  // Fallback: server local time (original behavior)
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    startUtc: startLocal.toISOString(),
    endUtc: endLocal.toISOString(),
  };
}

/**
 * Convert a local YYYY-MM-DD date and HH:MM time in the user's timezone
 * to an ISO UTC timestamp.
 */
export function localTimeToUtc(
  dateStr: string,
  timeStr: string,
  offsetMinutes?: number
): string {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  const timeParts = timeStr.split(":").map(Number);
  const [hh, mm] = timeParts;

  if (!y || !m || !d || parts.length !== 3 || hh == null || mm == null || timeParts.length !== 2) {
    throw new Error(`Invalid date/time input: ${dateStr} ${timeStr}`);
  }

  if (offsetMinutes != null) {
    const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - offsetMinutes * 60_000;
    return new Date(utcMs).toISOString();
  }

  // Fallback: server local time
  const localDate = new Date(y, m - 1, d, hh, mm, 0, 0);
  return localDate.toISOString();
}

/**
 * Extract "HH:MM" in the user's timezone from an ISO timestamp.
 * Pass `offsetMinutes` for correct results on UTC servers.
 * Use for dedup keys where the slot list ("09:00", "21:00") is in local
 * time — comparing UTC "03:30" against local "09:00" never matches and
 * silently creates duplicate doses.
 */
export function localHHMM(iso: string, offsetMinutes?: number): string {
  if (offsetMinutes != null) {
    const utcMs = new Date(iso).getTime();
    const localMs = utcMs + offsetMinutes * 60_000;
    const d = new Date(localMs);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  // Fallback: server local time (original behavior)
  return new Date(iso).toTimeString().slice(0, 5);
}
