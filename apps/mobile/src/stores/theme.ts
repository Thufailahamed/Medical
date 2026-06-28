import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

export type ThemeScheme = "light" | "dark" | "system";

interface ThemeState {
  scheme: ThemeScheme;
  setScheme: (scheme: ThemeScheme) => void;
  toggle: () => void;
}

// SecureStore adapter for zustand persist (storage only stores strings).
const secureStorage = {
  getItem: async (name: string) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // no-op
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // no-op
    }
  },
};

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
