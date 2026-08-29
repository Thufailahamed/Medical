"use client";

// Phase 2.3: active-family-member store. Mirrors the mobile store at
// apps/mobile/src/stores/activeFamilyMember.ts so the web portal and
// the Expo app share one concept.
//
// Persists `activeFamilyMemberId: string | null` to localStorage so the
// choice survives page reloads. The store holds the local view; the
// server column `users.activeFamilyMemberId` is the cross-device
// durable source of truth — PATCH /family/active syncs both.
//
// The web portal is patient-only (no caretaker flows yet), so this
// store does not include `activePrincipalPatientId`. If a caretaker
// surface is added later, give it a sibling store at
// `apps/marketing/src/portal/stores/activePrincipal.ts` and forward
// `x-active-principal-patient-id` from `portal/lib/api.ts` — do NOT
// overload this one.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
