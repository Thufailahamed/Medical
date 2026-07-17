import { create } from "zustand";
import { persist } from "zustand/middleware";

type InsuranceOperatorUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  operatorOrgId?: string;
};

type InsuranceOperatorAuthState = {
  token: string | null;
  user: InsuranceOperatorUser | null;
  setAuth: (token: string, user: InsuranceOperatorUser) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
};

export const useInsuranceOperatorAuthStore =
  create<InsuranceOperatorAuthState>()(
    persist(
      (set, get) => ({
        token: null,
        user: null,
        setAuth: (token, user) => set({ token, user }),
        clearAuth: () => set({ token: null, user: null }),
        isAuthenticated: () => !!get().token,
      }),
      { name: "healthcare-insurance-operator-auth" },
    ),
  );