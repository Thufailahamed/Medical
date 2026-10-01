"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "@/portal/components/ui/Toast";

function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        // Mutations with their own onError already surface a tailored message.
        if (mutation.options.onError) return;
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error("Action failed", msg);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, err) => {
          // Don't retry 4xx; retry 5xx up to twice.
          const status = err && typeof err === "object" && "status" in err
            ? Number((err as { status: unknown }).status)
            : NaN;
          if (status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      dehydrate: {
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