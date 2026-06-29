import * as SecureStore from "expo-secure-store";

// SecureStore adapter for zustand persist. Storage only stores strings;
// zustand wraps/JSON-encodes values around this primitive.
//
// Lifted from apps/mobile/src/stores/theme.ts so multiple persisted
// stores (theme, recordsPrefs, future ones) share one adapter.

export const secureStorage = {
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