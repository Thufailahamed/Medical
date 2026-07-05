"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/portal/lib/query-client";
import { ToastHost } from "@/portal/components/ui/Toast";

/**
 * Wraps the entire portal app with:
 *  - TanStack Query provider (data fetching / caching)
 *  - The toast host (mounts the toast viewport once)
 *
 * Pure presentation — does not enforce auth. Layout components decide
 * whether to render (and `lib/auth.ts` decides whether to redirect).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ToastHost />
    </QueryProvider>
  );
}