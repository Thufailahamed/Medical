"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/hospital/stores/auth";
import { fetchMe } from "@/hospital/lib/auth";

/**
 * Hydrates the hospital auth store on first mount: if a token exists
 * in localStorage, call /auth/me to refresh the user row.
 */
export function AuthBoot({ children }: { children: React.ReactNode }) {
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