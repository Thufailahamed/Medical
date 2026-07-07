"use client";

import { hasRole, isAdmin, useAuthStore, type UserRole } from "@/portal/stores/auth";

/**
 * `useRbac` — true if the current user's role matches the allow-list.
 * Returns `{ allowed, user, role }` so call sites can render fallback UI.
 */
export function useRbac(...allowed: UserRole[]) {
  const user = useAuthStore((s) => s.user);
  return { allowed: hasRole(user, ...allowed), user, role: user?.role as UserRole | undefined };
}

/** Phase ADM-1: short-circuit for the admin surface. */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return isAdmin(user);
}
