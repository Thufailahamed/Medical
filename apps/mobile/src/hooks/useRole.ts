// Caretaker Profiles: tiny helper to read the current user's role
// from the auth store. Re-renders the consumer only when the role
// string changes (object identity is stable across selectors).

import { useAuthStore } from "@/stores/auth";

export type AppRole = "patient" | "caretaker" | "doctor" | string;

export function useRole(): AppRole | null {
  return useAuthStore((s) => s.user?.role ?? null);
}