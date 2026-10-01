"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast, ToastHost } from "@/portal/components/ui/Toast";
import "./globals.css";

export default function InsuranceOperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            // Mutations with their own onError already surface a tailored message.
            if (mutation.options.onError) return;
            const msg = err instanceof Error ? err.message : "Something went wrong";
            toast.error("Action failed", msg);
          },
        }),
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div data-app="insurance-operator" className="min-h-screen bg-[#F0F9FF]">
        {children}
        <ToastHost />
      </div>
    </QueryClientProvider>
  );
}