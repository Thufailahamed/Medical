import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export type Locale = "en" | "si" | "ta";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// Mirrors stores/theme.ts. Persists user-selected app locale to SecureStore.
// i18next reads from this store on boot via useLocaleStore.getState().locale.
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "healthcare-locale",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);