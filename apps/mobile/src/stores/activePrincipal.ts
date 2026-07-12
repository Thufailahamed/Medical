// Caretaker Profiles: active-principal store. Mirror of
// stores/activeFamilyMember.ts. Holds the principal's patient.id the
// caretaker app should display. On boot, lib/api.ts seeds the header
// from this store. PATCH /caretaker/me/active-principal syncs to the
// server.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

interface ActivePrincipalState {
  activePrincipalPatientId: string | null;
  setActivePrincipalPatientId: (id: string | null) => void;
  clear: () => void;
}

export const useActivePrincipalStore = create<ActivePrincipalState>()(
  persist(
    (set) => ({
      activePrincipalPatientId: null,
      setActivePrincipalPatientId: (id) =>
        set({ activePrincipalPatientId: id }),
      clear: () => set({ activePrincipalPatientId: null }),
    }),
    {
      name: "healthcare-active-principal",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);
