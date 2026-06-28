import { create } from "zustand";
import type { User, Patient } from "@healthcare/shared";

interface AuthState {
  user: User | null;
  patient: Patient | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setPatient: (patient: Patient | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  patient: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),
  setPatient: (patient) => set({ patient }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({ user: null, patient: null, isAuthenticated: false, isLoading: false }),
}));
