"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/portal/stores/auth";
import { fetchMe } from "@/portal/lib/auth";

/**
 * Hydrates the auth store on first mount:
 *  - reads the persisted token + user from localStorage (handled by zustand/persist)
 *  - if a token exists, calls /auth/me to refresh the user row
 *
 * Sits inside Providers so it has access to the QueryClient for the
 * underlying fetch call.
 */
export function AuthBoot({ children }: { children?: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMe().catch(() => {
      // Errors already handled in fetchMe (cleared on 401). Silent here.
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return <>{children}</>;
}