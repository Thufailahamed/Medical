/**
 * Auth + tenant + locale state.
 *
 * Persisted to localStorage so a refresh keeps the session. The store is
 * the single source of truth for:
 *   - the JWT access token (used by lib/api.ts)
 *   - the long-lived refresh token used when the access token 401s
 *   - the user identity (id, role, name, email, phone, photo)
 *   - the active tenant (hospital_id OR clinic_id) for tenant-scoped reads
 *   - the active locale (en | si | ta) for the Accept-Language header
 *
 * The store is intentionally browser-only. Server components don't import
 * this — they read the cookie via the API or fall back to the JWT the
 * client sent up via cookie.
 *
 * Phase 1.1: a refresh_token is now persisted alongside the access token
 * so `lib/api.ts` can recover from a single expired JWT without forcing a
 * logout. Stored in localStorage (still XSS-readable) — Phase 1.3 will
 * move both tokens to httpOnly cookies once the backend emits Set-Cookie.
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
  // Phase ADM-1: account lifecycle. Defaults to "active" for legacy
  // portal users (the field is only surfaced on the admin surface).
  status?: "pending" | "active" | "suspended" | "rejected";
}

interface AuthState {
  token: string | null;
  /**
   * Long-lived refresh token used by lib/api.ts when the access token
   * returns 401. Persisted alongside `token` to localStorage. Still
   * XSS-readable but the JWT lifetime is short and the refresh pulls
   * the heavy lifting server-side. A future move to httpOnly cookies
   * (Phase 1.3) will lift this caveat.
   */
  refreshToken: string | null;
  user: AuthUser | null;
  activeTenant: ActiveTenant;
  activeHospitalId: string | null;
  activeClinicId: string | null;
  locale: Locale;
  hydrated: boolean;

  setSession: (input: {
    token: string;
    user: AuthUser;
    refreshToken?: string | null;
  }) => void;
  setUser: (user: AuthUser | null) => void;
  setRefreshToken: (rt: string | null) => void;
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
      refreshToken: null,
      user: null,
      activeTenant: null,
      activeHospitalId: null,
      activeClinicId: null,
      locale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) || "en",
      hydrated: false,

      setSession: ({ token, user, refreshToken }) =>
        set({
          token,
          user,
          refreshToken: refreshToken ?? null,
          activeHospitalId: user.role === "doctor" ? null : null,
          activeClinicId: null,
        }),

      setUser: (user) => set({ user }),

      setRefreshToken: (rt) => set({ refreshToken: rt }),

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
          refreshToken: null,
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
        refreshToken: s.refreshToken,
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

/** Phase ADM-1: convenience selectors. */
export const isAdmin = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "super_admin");
export const isClinician = (user: AuthUser | null | undefined): boolean =>
  hasRole(user, "doctor", "pharmacy");
