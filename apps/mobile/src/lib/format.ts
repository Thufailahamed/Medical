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