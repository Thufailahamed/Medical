"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/hospital/lib/query-client";
import { ToastHost } from "@/portal/components/ui/Toast";

/**
 * Mirrors `@/portal/components/Providers`. Reuses the portal ToastHost
 * intentionally — toast UI lives in one place.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ToastHost />
    </QueryProvider>
  );
}