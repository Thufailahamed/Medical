/**
 * Tiny i18n shim — mirrors `@/portal/i18n`. Translates a dot-path key
 * from one of three locale files. Falls back to `en` when a key is
 * missing in the active locale.
 */

import { useAuthStore, type Locale } from "@/hospital/stores/auth";

import en from "./en.json";
import si from "./si.json";
import ta from "./ta.json";

const LOCALES: Record<Locale, Record<string, any>> = { en, si, ta };

export type Dict = typeof en;

export function dict(locale: Locale): Dict {
  return (LOCALES[locale] ?? LOCALES.en) as Dict;
}

/** Deep-get with a dot path. Falls back to en, then to the path string. */
export function tr(
  locale: Locale,
  path: string,
  vars?: Record<string, string | number>
): string {
  const fallback = LOCALES.en;
  const primary = LOCALES[locale] ?? fallback;
  const keys = path.split(".");
  let cur: any = primary;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else {
      cur = fallback;
      for (const k2 of keys) {
        if (cur && typeof cur === "object" && k2 in cur) cur = cur[k2];
        else return path;
      }
      break;
    }
  }
  let str = typeof cur === "string" ? cur : path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    }
  }
  return str;
}

/** React hook — reads the active locale from the store and returns a translator. */
export function useT() {
  const locale = useAuthStore((s) => s.locale);
  return (path: string, vars?: Record<string, string | number>) =>
    tr(locale, path, vars);
}

/** Helper to swap a pluralised suffix on a key. */
export function pluralKey(base: string, n: number) {
  return n === 1 ? base : `${base}_other`;
}

export { LOCALES as i18nLocales };