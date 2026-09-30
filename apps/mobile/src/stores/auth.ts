import { create } from "zustand";
import type { User, Patient } from "@healthcare/shared";
import { useActiveTenantStore } from "./tenant-store";
import { useActiveFamilyMemberStore } from "./activeFamilyMember";
import { useActivePrincipalStore } from "./activePrincipal";

// Tenant / family / principal selections are per-account request
// context, persisted in SecureStore. They must never leak across
// accounts on a shared device: a stale x-active-hospital-id from a
// patient session makes staff (doctor/admin) requests 403 with
// tenant_access_denied — including the login call itself when a stale
// token is still stored. Clear all three whenever the account changes.
function clearRequestContext() {
  try {
    useActiveTenantStore.getState().clear();
  } catch {
    // store not ready; ignore
  }
  try {
    useActiveFamilyMemberStore.getState().clear();
  } catch {
    // store not ready; ignore
  }
  try {
    useActivePrincipalStore.getState().clear();
  } catch {
    // store not ready; ignore
  }
}

interface AuthState {
  user: User | null;
  patient: Patient | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Bumped whenever the token chain reports a 401 we can't recover from.
  // The root layout listens to this and signs the user out.
  authFailureCount: number;
  setUser: (user: User | null) => void;
  setPatient: (patient: Patient | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  onAuthError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  patient: null,
  isLoading: true,
  isAuthenticated: false,
  authFailureCount: 0,
  setUser: (user) => {
    // Account switch (including sign-out via setUser(null)): drop the
    // previous account's tenant/family/principal context. Same-user
    // refreshes (cold-start /auth/me) keep it.
    if (get().user?.id !== user?.id) clearRequestContext();
    set({ user, isAuthenticated: !!user, isLoading: false, authFailureCount: 0 });
  },
  setPatient: (patient) => set({ patient }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    clearRequestContext();
    set({
      user: null,
      patient: null,
      isAuthenticated: false,
      isLoading: false,
      authFailureCount: 0,
    });
  },
  onAuthError: () =>
    set((state) => ({
      user: null,
      patient: null,
      isAuthenticated: false,
      authFailureCount: state.authFailureCount + 1,
    })),
}));