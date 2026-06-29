import { create } from "zustand";
import type { User, Patient } from "@healthcare/shared";

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  patient: null,
  isLoading: true,
  isAuthenticated: false,
  authFailureCount: 0,
  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false, authFailureCount: 0 }),
  setPatient: (patient) => set({ patient }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      patient: null,
      isAuthenticated: false,
      isLoading: false,
      authFailureCount: 0,
    }),
  onAuthError: () =>
    set((state) => ({ authFailureCount: state.authFailureCount + 1 })),
}));