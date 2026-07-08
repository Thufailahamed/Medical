/**
 * Auth + tenant + locale state for the hospital/clinic portal.
 *
 * Mirrors `portal/stores/auth.ts` but persists under a distinct
 * localStorage key so a doctor signed into the clinician portal and an
 * admin signed into the hospital portal can coexist in the same browser.
 *
 * Allowed roles (hospital_admin / hospital_staff / pharmacy / laboratory /
 * super_admin) are gated in `(hospital)/layout.tsx`.
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
  status?: "pending" | "active" | "suspended" | "rejected";
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

      setSession: ({ token, user }) => set({ token, user }),
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
      name: "healthcare-hospital-auth",
      storage: createJSONStorage(() => localStorage),
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

/** Roles allowed inside the hospital portal surface. */
export const HOSPITAL_ROLES: UserRole[] = [
  "hospital_admin",
  "hospital_staff",
  "pharmacy",
  "laboratory",
  "super_admin",
];

/** Subset of UserRole accepted on the hospital portal surface. */
export type HospitalRole = Extract<
  UserRole,
  "hospital_admin" | "hospital_staff" | "pharmacy" | "laboratory" | "super_admin"
>;

export function hasRole(
  user: AuthUser | null | undefined,
  ...allowed: UserRole[]
): boolean {
  if (!user) return false;
  return allowed.includes(user.role as UserRole);
}

/** Alias of hasRole restricted to hospital-portal roles. */
export function hasHospitalRole(
  user: AuthUser | null | undefined,
  ...allowed: HospitalRole[]
): boolean {
  return hasRole(user, ...(allowed as UserRole[]));
}

/** True if the user can manage the hospital end-to-end. */
export const isHospitalAdmin = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "hospital_admin", "super_admin");

/** True if the user is pharmacy staff. */
export const isPharmacy = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "pharmacy", "super_admin");

/** True if the user is laboratory staff. */
export const isLab = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "laboratory", "super_admin");

/** Alias matching the plan's HOS-1 naming. */
export const isLaboratory = isLab;

/** True if the user is super admin (cross-tenant support). */
export const isSuperAdmin = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "super_admin");