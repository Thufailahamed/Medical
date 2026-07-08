/**
 * Role-based access helpers for the hospital portal.
 *
 * `useRbac` returns `{ allowed, user, role }` so call sites can render
 * fallback UI or hide nav items without leaving the component body.
 */

"use client";

import { hasRole, useAuthStore, type UserRole } from "@/hospital/stores/auth";

export function useRbac(...allowed: UserRole[]) {
  const user = useAuthStore((s) => s.user);
  return {
    allowed: hasRole(user, ...allowed),
    user,
    role: user?.role as UserRole | undefined,
  };
}