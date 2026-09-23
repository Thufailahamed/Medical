/**
 * Visit lifecycle — single source of truth for "is this doctor visit
 * upcoming / today / missed / …". Pure functions, no I/O.
 *
 * All calendar math is Asia/Colombo (UTC+5:30) to match how the API
 * parses appointment date+time (`${date}T${time}:00+05:30`).
 */

export type VisitBucket =
  | "upcoming"
  | "today"
  | "completed"
  | "missed"
  | "cancelled";

export interface VisitLifecycle {
  /** Epoch ms of the visit start. */
  startsAt: number;
  /** Past the 15-minute post-start grace window. */
  isPast: boolean;
  /** Inside the video join window (start−10min … start+30min). */
  isLive: boolean;
  bucket: VisitBucket;
}

export interface VisitLifecycleInput {
  /** YYYY-MM-DD (Sri Lanka calendar day). */
  date: string;
  /** HH:MM (optional; falls back to 00:00). */
  time?: string | null;
  /** Appointment status enum value. */
  status: string;
  /** Epoch ms override for tests. */
  now?: number;
}

const GRACE_MS = 15 * 60 * 1000;
const JOIN_OPEN_MS = 10 * 60 * 1000;
const JOIN_CLOSE_MS = 30 * 60 * 1000;

/** Parse an appointment's date+time as Asia/Colombo epoch ms. */
export function visitStartsAt(date: string, time?: string | null): number {
  const iso = `${date}T${time || "00:00"}:00+05:30`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function computeVisitLifecycle(
  input: VisitLifecycleInput
): VisitLifecycle {
  const now = input.now ?? Date.now();
  const startsAt = visitStartsAt(input.date, input.time);
  const isPast = now > startsAt + GRACE_MS;
  const status = input.status;
  const isActiveStatus =
    status === "scheduled" || status === "confirmed" || status === "in_progress";
  const isLive =
    isActiveStatus &&
    now >= startsAt - JOIN_OPEN_MS &&
    now <= startsAt + JOIN_CLOSE_MS;

  let bucket: VisitBucket;
  if (status === "completed") {
    bucket = "completed";
  } else if (status === "cancelled") {
    bucket = "cancelled";
  } else if (status === "no_show") {
    bucket = "missed";
  } else if ((status === "scheduled" || status === "confirmed") && isPast) {
    bucket = "missed";
  } else if (slDayDiff(input.date, now) === 0) {
    bucket = "today";
  } else if (now < startsAt) {
    bucket = "upcoming";
  } else {
    bucket = "missed";
  }

  return { startsAt, isPast, isLive, bucket };
}

const slDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Asia/Colombo, as YYYY-MM-DD. */
export function slTodayIso(now: number = Date.now()): string {
  return slDateFormatter.format(new Date(now));
}

/** Whole SL calendar days from today to `date` (negative = past). */
export function slDayDiff(date: string, now: number = Date.now()): number {
  const a = Date.parse(`${slTodayIso(now)}T00:00:00Z`);
  const b = Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Days until the visit starts (for countdown chips); 0 when past. */
export function countdownDays(startsAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((startsAt - now) / 86_400_000));
}
