/**
 * Auth + tenant + locale state.
 *
 * Persisted to localStorage so a refresh keeps the session. The store is
 * the single source of truth for:
 *   - the JWT access token (used by lib/api.ts)
 *   - the user identity (id, role, name, email, phone, photo)
 *   - the active tenant (hospital_id OR clinic_id) for tenant-scoped reads
 *   - the active locale (en | si | ta) for the Accept-Language header
 *
 * The store is intentionally browser-only. Server components don't import
 * this — they read the cookie via the API or fall back to the JWT the
 * client sent up via cookie.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole =
  | "patient"
  | "doctor"
  | "hospital_admin"
  | "hospital_staff"
  | "laboratory"
  | "pharmacy"
  | "insurance"
  | "ambulance"
  | "super_admin";

export type Locale = "en" | "si" | "ta";

export type ActiveTenant = { type: "hospital" | "clinic"; id: string } | null;

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: UserRole | string;
  photo?: string | null;
  nic?: string | null;
  verified?: boolean;
  slmcNumber?: string | null;
  specialization?: string | null;
  consultationFee?: number | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  activeTenant: ActiveTenant;
  activeHospitalId: string | null;
  activeClinicId: string | null;
  locale: Locale;
  hydrated: boolean;

  setSession: (input: { token: string; user: AuthUser }) => void;
  setUser: (user: AuthUser | null) => void;
  setActiveTenant: (t: ActiveTenant) => void;
  clearActiveTenant: () => void;
  setLocale: (l: Locale) => void;
  logout: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeTenant: null,
      activeHospitalId: null,
      activeClinicId: null,
      locale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) || "en",
      hydrated: false,

      setSession: ({ token, user }) =>
        set({
          token,
          user,
          activeHospitalId: user.role === "doctor" ? null : null,
          activeClinicId: null,
        }),

      setUser: (user) => set({ user }),

      setActiveTenant: (t) =>
        set({
          activeTenant: t,
          activeHospitalId: t?.type === "hospital" ? t.id : null,
          activeClinicId: t?.type === "clinic" ? t.id : null,
        }),

      clearActiveTenant: () =>
        set({ activeTenant: null, activeHospitalId: null, activeClinicId: null }),

      setLocale: (l) => set({ locale: l }),

      logout: () =>
        set({
          token: null,
          user: null,
          activeTenant: null,
          activeHospitalId: null,
          activeClinicId: null,
        }),

      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "healthcare-portal-auth",
      storage: createJSONStorage(() => localStorage),
      // Only persist the bits we need; the hydrated flag is recomputed.
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        activeTenant: s.activeTenant,
        activeHospitalId: s.activeHospitalId,
        activeClinicId: s.activeClinicId,
        locale: s.locale,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

/** Role helper — true if the user's role is in the allow-list. */
export function hasRole(
  user: AuthUser | null | undefined,
  ...allowed: UserRole[]
): boolean {
  if (!user) return false;
  return allowed.includes(user.role as UserRole);
}
