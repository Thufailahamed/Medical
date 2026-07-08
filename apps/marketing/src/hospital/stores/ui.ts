/**
 * UI-only persistent state for the hospital portal (sidebar collapsed).
 * Mirrors `portal/stores/ui.ts` so the two surfaces can stay in sync.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: "healthcare-hospital-ui",
      storage: createJSONStorage(() => localStorage),
    }
  )
);