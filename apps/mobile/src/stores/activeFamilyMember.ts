// Phase 2.3: active-family-member store. Mirrors stores/locale.ts.
// Persists `activeFamilyMemberId: string | null` to secureStorage so
// the choice survives app restarts. On boot, useApi.ts seeds the header
// from this store.
//
// The store holds the local view; the server is the durable source of
// truth (users.activeFamilyMemberId). PATCH /family/active syncs both.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

interface ActiveFamilyMemberState {
  activeFamilyMemberId: string | null;
  setActiveFamilyMemberId: (id: string | null) => void;
  clear: () => void;
}

export const useActiveFamilyMemberStore = create<ActiveFamilyMemberState>()(
  persist(
    (set) => ({
      activeFamilyMemberId: null,
      setActiveFamilyMemberId: (id) => set({ activeFamilyMemberId: id }),
      clear: () => set({ activeFamilyMemberId: null }),
    }),
    {
      name: "healthcare-active-family-member",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);
