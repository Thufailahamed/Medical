import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export type ThemeScheme = "light" | "dark" | "system";

interface ThemeState {
  scheme: ThemeScheme;
  setScheme: (scheme: ThemeScheme) => void;
  toggle: () => void;
}

// Adapter is shared via ./secureStorage so other persisted stores
// (recordsPrefs, etc.) reuse the same SecureStore-backed primitive.

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      scheme: "system",
      setScheme: (scheme) => set({ scheme }),
      toggle: () =>
        set({
          scheme: get().scheme === "dark" ? "light" : "dark",
        }),
    }),
    {
      name: "healthcare-theme",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);
