import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "@/portal/stores/auth";

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

// The legacy lab-portal login page now redirects to the unified
// /login surface, which persists its session in the main portal
// store ("healthcare-portal-auth"). The lab portal therefore treats
// the main session as authoritative and keeps its own store only as
// a legacy fallback — otherwise labs loop login → wrong portal.
function mainSession(): { token: string | null; user: any | null } {
  try {
    const s = useAuthStore.getState() as any;
    return { token: s?.token ?? null, user: s?.user ?? null };
  } catch {
    return { token: null, user: null };
  }
}

export function getLabSessionUser(): LabUser | null {
  try {
    const lab = useLabAuthStore.getState();
    if (lab.user) return lab.user;
  } catch {
    /* fall through to main session */
  }
  const main = mainSession();
  return (main.user as LabUser | null) ?? null;
}

export const useLabAuthStore = create<LabAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      clearAuth: () => {
        set({ token: null, user: null });
        try {
          (useAuthStore.getState() as any)?.logout?.();
        } catch {
          /* main session already gone */
        }
      },

      isAuthenticated: () => !!get().token || !!mainSession().token,
    }),
    {
      name: "healthcare-lab-auth",
    }
  )
);
