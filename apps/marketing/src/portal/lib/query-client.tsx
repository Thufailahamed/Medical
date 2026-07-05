/**
 * TanStack Query client + provider wrapper. Server components can render
 * hydrated initial data via prefetch helpers (used in the dashboard).
 *
 * The portal's default policy is conservative — portal screens are data-
 * heavy and we don't want a flood of refetches when the user flips
 * between tabs. 5-minute stale time, 30-minute gc.
 */

"use client";

import {
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, err) => {
          // Don't retry 4xx; retry 5xx up to twice.
          if (err && (err as any).status >= 400 && (err as any).status < 500) return false;
          return failureCount < 2;
        },
      },
      dehydrate: {
        // include pending queries in the SSR payload for smoother hydration
        shouldDehydrateQuery: (q) =>
          defaultShouldDehydrateQuery(q) || q.state.status === "pending",
      },
    },
  });
}

let browserClient: QueryClient | undefined;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => getQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
