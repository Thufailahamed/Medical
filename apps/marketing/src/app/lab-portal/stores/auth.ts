import { create } from "zustand";
import { persist } from "zustand/middleware";

type LabUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type LabAuthState = {
  token: string | null;
  user: LabUser | null;
  setAuth: (token: string, user: LabUser) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
};

export const useLabAuthStore = create<LabAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      clearAuth: () => {
        set({ token: null, user: null });
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: "healthcare-lab-auth",
    }
  )
);
