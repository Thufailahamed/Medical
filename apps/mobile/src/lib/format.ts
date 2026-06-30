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
// Mirrors the server validators so the form rejects garbage before round-trip.

/** SL NIC: old (9 digits + V/X) or new (12 digits). */
export const NIC_REGEX = /^(\d{9}[VvXx]|\d{12})$/;

/** Canonicalise a NIC string (uppercase, trimmed). */
export function normalizeNic(nic: string): string {
  return nic.trim().toUpperCase();
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