import type { Locale } from "@/stores/locale";

/**
 * Locale-aware formatters for Intl.DateTimeFormat, Intl.NumberFormat, etc.
 *
 * Uses the active app locale from `useLocaleStore`. Browser/device locale
 * is intentionally ignored — the user picks their preferred language in
 * the Appearance screen, and that drives everything date/number/relative.
 *
 * Sinhala (si) and Tamil (ta) are supported by Hermes/Intl on modern
 * devices; falls back gracefully on older runtimes.
 */

export type DateStyle = "short" | "medium" | "long" | "full";

const LOCALE_MAP: Record<Locale, string> = {
  en: "en-LK",
  si: "si-LK",
  ta: "ta-LK",
};

/**
 * Map our app locale to a BCP-47 tag for Intl. en-LK ensures 24h time and
 * DD/MM/YYYY date ordering (Sri Lanka convention) without losing English.
 * For si/ta, use the country-tagged form so Intl picks correct numerals.
 */
export function intlLocale(locale: Locale): string {
  return LOCALE_MAP[locale];
}

/** Short date: 30/06/2026 or localized equivalent. */
export function fmtDate(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Date + time: 30/06/2026, 14:30. */
export function fmtDateTime(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Time only: 14:30. */
export function fmtTime(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Month + year label: June 2026 / ජුනි 2026 / ஜூன் 2026. */
export function fmtMonthYear(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Weekday short, uppercase: MON / සඳු. Use for compact calendar headers. */
export function fmtWeekdayShort(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
  }).format(d);
}

/** Month short, uppercase: JUN / ජුනි. */
export function fmtMonthShort(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
  }).format(d);
}

/** Long form: 30 Jun 2026 / 30 ජුනි 2026. */
export function fmtDateLong(input: Date | string | number, locale: Locale): string {
  const d = toDate(input);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Format LKR currency. en-LK uses LKR prefix; si-LK/ta-LK localize digits. */
export function fmtLKR(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Plain number with locale grouping. */
export function fmtNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}

// ─── Phase 1.2: NIC + DOB helpers (client-side) ──────────
// Mirrors `apps/api/src/lib/nic.ts`. Stays in lockstep so the register
// form can surface the encoded DOB and reject mismatches before a
// network round-trip. The check-digit algorithm is intentionally NOT
// shipped (DRP does not publish it); structural + DOB consistency is
// the strongest cheap check.

/** SL NIC: old (9 digits + V/X) or new (12 digits). */
export const NIC_REGEX = /^(\d{9}[VvXx]|\d{12})$/;

const OLD_REGEX = /^\d{9}[VvXx]$/;
const NEW_REGEX = /^\d{12}$/;

/** Canonicalise a NIC string (uppercase, trimmed). */
export function normalizeNic(nic: string): string {
  return nic.trim().toUpperCase();
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function dayOfYearToMonthDay(
  year: number,
  doy: number,
): { month: number; day: number } {
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (daysInYear(year) === 366) monthDays[1] = 29;
  let remaining = doy;
  for (let i = 0; i < 12; i++) {
    if (remaining <= monthDays[i]) return { month: i + 1, day: remaining };
    remaining -= monthDays[i];
  }
  throw new Error("day-of-year out of range");
}

export type NicFormat = "OLD" | "NEW";

export interface ParsedNic {
  format: NicFormat;
  year: number;
  month: number;
  day: number;
  serial: string;
}

/** Parse a structurally valid NIC. Returns null on any failure. */
export function parseNic(raw: string): ParsedNic | null {
  const nic = normalizeNic(raw);
  if (!NIC_REGEX.test(nic)) return null;

  if (NEW_REGEX.test(nic)) {
    const year = +nic.slice(0, 4);
    let daysRaw = +nic.slice(4, 7);
    const serial = nic.slice(7, 11);
    const max = daysInYear(year);
    if (daysRaw > max) daysRaw -= 500;
    if (year < 1900 || year > 9999) return null;
    if (daysRaw < 1 || daysRaw > max) return null;
    const { month, day } = dayOfYearToMonthDay(year, daysRaw);
    return { format: "NEW", year, month, day, serial };
  }

  const yy = +nic.slice(0, 2);
  let daysRaw = +nic.slice(2, 5);
  const serial = nic.slice(5, 8);
  const year = 1900 + yy;
  const max = daysInYear(year);
  if (daysRaw > max) daysRaw -= 500;
  if (daysRaw < 1 || daysRaw > max) return null;
  const { month, day } = dayOfYearToMonthDay(year, daysRaw);
  return { format: "OLD", year, month, day, serial };
}

/** Structural validity. Year must be 1900..currentYear-15. */
export function isStructurallyValidNic(raw: string): boolean {
  const p = parseNic(raw);
  if (!p) return false;
  return p.year >= 1900 && p.year <= new Date().getFullYear() - 15;
}

/** Extract the DOB encoded in the NIC as YYYY-MM-DD. Null on parse failure. */
export function nicEncodedDob(raw: string): string | null {
  const p = parseNic(raw);
  if (!p) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Does the encoded DOB in the NIC match the user-supplied DOB? */
export function nicMatchesDob(raw: string, dob: string): boolean {
  const encoded = nicEncodedDob(raw);
  if (!encoded) return false;
  return encoded === dob.trim();
}

/**
 * Validate YYYY-MM-DD as a real past date (age 0..120).
 * Mirrors server `parseDob` so client rejects before round-trip.
 */
export function parseDob(dob: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const yr = +m[1], moIdx = +m[2] - 1, day = +m[3];
  if (moIdx < 0 || moIdx > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(yr, moIdx, day);
  if (
    date.getFullYear() !== yr ||
    date.getMonth() !== moIdx ||
    date.getDate() !== day
  ) {
    return null;
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) return null;
  const ageYears = (now.getTime() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears > 120) return null;
  return date;
}

/** Mask a NIC for display: "200*******678" (last 3 + 4 prefix). */
export function maskNic(nic: string): string {
  const s = normalizeNic(nic);
  if (s.length <= 4) return "****";
  return s.slice(0, 3) + "****" + s.slice(-3);
}

/** Mask an email or phone target: "thi****@gm**.com" / "+94****4567". */
export function maskTarget(target: string): string {
  if (!target) return "****";
  if (target.includes("@")) {
    const [local, domain] = target.split("@");
    const localMasked =
      local.length <= 2 ? local[0] + "*" : local.slice(0, 3) + "****";
    const dotIdx = domain.lastIndexOf(".");
    const tld = dotIdx >= 0 ? domain.slice(dotIdx) : "";
    const d = dotIdx >= 0 ? domain.slice(0, dotIdx) : domain;
    const domainMasked =
      d.length <= 2 ? d[0] + "*" + tld : d.slice(0, 2) + "**" + tld;
    return `${localMasked}@${domainMasked}`;
  }
  if (target.length <= 6) return "****";
  return target.slice(0, 3) + "****" + target.slice(-2);
}