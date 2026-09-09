"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";

interface EnrollmentsResponse {
  enrollments: Array<{
    id: string;
    status: string;
    policyNumber: string | null;
    planName?: string | null;
    providerName?: string | null;
  }>;
}

export default function InsurancePaymentReturnPage() {
  return (
    <Suspense fallback={<Card><div className="h-48 animate-pulse" /></Card>}>
      <ReturnInner />
    </Suspense>
  );
}

function ReturnInner() {
  const search = useSearchParams();
  const order = search.get("order") ?? "";

  const q = useQuery({
    queryKey: ["insurance", "payment-return", order],
    queryFn: () =>
      api<EnrollmentsResponse>("/insurance-marketplace/enrollments/me"),
    refetchInterval: (query) => {
      const list = query.state.data?.enrollments ?? [];
      const hasActive = list.some((e) => e.status === "active");
      return hasActive ? false : 5_000;
    },
  });

  const enrollments = q.data?.enrollments ?? [];
  const active = enrollments.filter((e) => e.status === "active");
  const pending = enrollments.filter((e) => e.status === "payment_pending");
  const failed = enrollments.filter((e) =>
    ["grace", "lapsed", "cancelled"].includes(e.status),
  );

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        href="/patient/insurance"
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to Insurance
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">Payment return</h1>
            <p className="text-sm text-text-soft mt-0.5">
              {order ? `Order ${order}` : "Order status"}
            </p>
          </div>
          {q.isLoading ? (
            <Pill tone="neutral">Checking…</Pill>
          ) : active.length > 0 ? (
            <Pill tone="success">Success</Pill>
          ) : pending.length > 0 ? (
            <Pill tone="warn">Pending</Pill>
          ) : failed.length > 0 ? (
            <Pill tone="danger">Failed</Pill>
          ) : (
            <Pill tone="neutral">Unknown</Pill>
          )}
        </div>

        {q.isLoading ? (
          <p className="text-sm text-text-soft mt-4 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Verifying payment with the insurer…
          </p>
        ) : active.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-emerald-700 font-semibold inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              Premium received — policy active.
            </p>
            {active.slice(0, 3).map((e) => (
              <Link
                key={e.id}
                href={`/patient/insurance/policy/${e.id}`}
                className="block text-sm text-brand hover:text-brand-strong font-semibold"
              >
                {e.planName ?? e.policyNumber ?? e.id.slice(0, 8)} — view policy
              </Link>
            ))}
          </div>
        ) : pending.length > 0 ? (
          <p className="text-sm text-text-soft mt-4">
            Payment is still pending. This page auto-refreshes every 5 seconds.
          </p>
        ) : (
          <p className="text-sm text-text-soft mt-4 inline-flex items-center gap-1.5">
            <XCircle size={14} />
            No active policy found yet. If you completed payment, wait a moment
            or contact support.
          </p>
        )}

        {q.isError ? (
          <p className="text-sm text-red-600 mt-3">
            Could not verify status. Please retry.
          </p>
        ) : null}
      </Card>

      <p className="text-[11px] text-text-muted text-center">
        Status auto-refreshes every 5 seconds while pending.
      </p>
    </div>
  );
}
