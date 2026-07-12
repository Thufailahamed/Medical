"use client";

import type { ReactNode } from "react";

import {
  hasRole,
  isAdmin,
  useAuthStore,
  type AuthUser,
  type UserRole,
} from "@/portal/stores/auth";

/**
 * `useRbac` — true if the current user's role matches the allow-list.
 * Returns `{ allowed, user, role }` so call sites can render fallback UI.
 */
export function useRbac(...allowed: UserRole[]) {
  const user = useAuthStore((s) => s.user);
  return {
    allowed: hasRole(user, ...allowed),
    user,
    role: user?.role as UserRole | undefined,
  };
}

/** Phase ADM-1: short-circuit for the admin surface. */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return isAdmin(user);
}

/**
 * `<RoleGate>` — render `children` only when the user's role is in the
 * allow-list. Otherwise render `fallback` (default: nothing).
 *
 * Optimistic guard for the UI. Real authorization lives in the backend
 * `requireRole` middleware — this component just hides admin chrome from
 * non-admins so they don't see links they'd be 403'd on.
 *
 *   <RoleGate allow={["super_admin", "hospital_admin"]}>
 *     <TenantsTable />
 *   </RoleGate>
 */
export function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  return hasRole(user, ...allow) ? <>{children}</> : <>{fallback}</>;
}

/**
 * `<IfRole>` — inverted sugar: render `children` only when the user's
 * role is NOT in the deny list. Useful for hiding patient-only chrome
 * from clinicians, etc.
 */
export function IfRole({
  not,
  children,
  fallback = null,
}: {
  not: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const denied = hasRole(user, ...not);
  return denied ? <>{fallback}</> : <>{children}</>;
}

/**
 * Convenience hook for the common "is the current user one of these
 * roles?" question — same as `useRbac` but returns a flat boolean.
 */
export function useHasRole(...allowed: UserRole[]): boolean {
  const user = useAuthStore((s) => s.user);
  return hasRole(user, ...allowed);
}

/** Returns the current user or null if not yet hydrated / signed in. */
export function useCurrentUser(): AuthUser | null {
  return useAuthStore((s) => s.user);
}