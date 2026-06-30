import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import si from "./locales/si.json";
import ta from "./locales/ta.json";

export const SUPPORTED_LOCALES = ["en", "si", "ta"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// One-time i18next bootstrap. Imported by app/_layout.tsx BEFORE React renders.
// useLocaleStore.getState().locale is the source of truth; this module sets a
// safe default ("en") for first render, then RootLayout calls changeLanguage()
// with the persisted value before/with the I18nextProvider mount.
i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;