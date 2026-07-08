/**
 * Date / number / currency formatting helpers for the hospital portal.
 *
 * All formatters are locale-aware and accept an optional Intl locale.
 * Default to `en` so server-side renders don't drift from the first
 * client paint; the topbar <LocaleSwitcher> pushes the user's pick into
 * the store so subsequent renders switch on the fly.
 */

const DEFAULT_LOCALE = "en";

export function formatDate(input: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "2-digit" });
}

export function formatTime(input: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(input: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(input: string | Date | null | undefined, locale = DEFAULT_LOCALE) {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return rtf.format(Math.round(diff / 60_000), "minute");
  if (hours < 24) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (days < 7) return rtf.format(Math.round(diff / 86_400_000), "day");
  return formatDate(d, locale);
}

export function formatLkr(amount: number | null | undefined, locale = DEFAULT_LOCALE) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatNumber(value: number | null | undefined, locale = DEFAULT_LOCALE) {
  if (value === null || value === undefined || isNaN(Number(value))) return "—";
  return new Intl.NumberFormat(locale).format(Number(value));
}

export function ageFrom(dob: string | null | undefined) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function initials(name: string | null | undefined, max = 2) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, max)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}