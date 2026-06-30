import en from "../i18n/en.json";
import si from "../i18n/si.json";
import ta from "../i18n/ta.json";

export type Locale = "en" | "si" | "ta";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "si", "ta"] as const;

export const LOCALE_TABLES: Record<Locale, Record<string, any>> = {
  en,
  si,
  ta,
};

/**
 * Parse an Accept-Language header (e.g. "si-LK,si;q=0.9,en;q=0.8")
 * and return the highest-priority supported locale. Falls back to "en".
 */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "en";
  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";");
      const qPart = rest.find((r) => r.trim().startsWith("q="));
      const q = qPart ? parseFloat(qPart.split("=")[1]) : 1;
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    const primary = tag.split("-")[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
      return primary as Locale;
    }
  }
  return "en";
}

/**
 * Look up a dotted key (e.g. "validation.specializationRequired") in the
 * active locale's table. Returns the raw English string when the key is
 * missing — never throws on missing keys.
 */
export function translate(
  locale: Locale,
  key: string,
  fallback: string,
): string {
  const parts = key.split(".");
  let cur: any = LOCALE_TABLES[locale];
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return fallback;
  }
  return typeof cur === "string" ? cur : fallback;
}