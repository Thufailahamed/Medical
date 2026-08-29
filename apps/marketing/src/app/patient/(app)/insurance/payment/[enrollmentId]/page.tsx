"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ArrowLeft, RefreshCw } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Pill } from "@/portal/components/ui/Pill";
import { formatLkr } from "@/portal/lib/format";

interface EnrollmentDetail {
  enrollment: {
    id: string;
    status: string;
    policyNumber: string | null;
    premiumAmountLkr: number;
    coverageAmountLkr: number;
    billingCycle: string;
  };
}

export default function PaymentPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = use(params);

  const q = useQuery({
    queryKey: ["insurance", "enrollment", enrollmentId],
    queryFn: () =>
      api<EnrollmentDetail>(
        `/insurance-marketplace/enrollments/${enrollmentId}`,
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.enrollment.status;
      // poll while still pending payment
      return status === "payment_pending" ? 5_000 : false;
    },
  });

  const [payTrigger, setPayTrigger] = usePayTrigger(enrollmentId);

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const e = q.data?.enrollment;
  if (!e) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">Policy not found.</p>
      </Card>
    );
  }

  const isPending = e.status === "payment_pending";

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        href="/portal/me/insurance"
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">Pay premium</h1>
            <p className="text-sm text-text-soft mt-0.5">
              Policy {e.policyNumber ?? e.id.slice(0, 8)}
            </p>
          </div>
          <Pill tone={isPending ? "warn" : "success"}>
            {isPending ? "Payment pending" : "Active"}
          </Pill>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-surface-2">
          <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold">
            Amount due ({e.billingCycle})
          </div>
          <div className="text-4xl font-bold text-brand-strong mt-1">
            {formatLkr(e.premiumAmountLkr)}
          </div>
          <div className="text-xs text-text-soft mt-0.5">
            Coverage up to {formatLkr(e.coverageAmountLkr)}
          </div>
        </div>

        {payTrigger.checkoutUrl ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-text-soft">
              Opening PayHere secure checkout. You&apos;ll be redirected back to
              your policy page once payment clears.
            </p>
            <a
              href={payTrigger.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button block size="lg">
                <ExternalLink size={14} />
                Open PayHere checkout
              </Button>
            </a>
            <div className="flex justify-end">
              <button
                onClick={() => payTrigger.refetch()}
                className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
              >
                <RefreshCw size={12} />
                I&apos;ve paid — verify
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => payTrigger.refetch()}
              loading={payTrigger.isFetching}
            >
              <RefreshCw size={14} />
              Generate checkout
            </Button>
          </div>
        )}
      </Card>

      {isPending ? (
        <p className="text-[11px] text-text-muted text-center">
          Status auto-refreshes every 5 seconds.
        </p>
      ) : null}
    </div>
  );
}

function usePayTrigger(enrollmentId: string) {
  const q = useQuery({
    queryKey: ["insurance", "pay", enrollmentId],
    queryFn: () =>
      api<{ checkoutUrl?: string; status?: string }>(
        `/insurance-marketplace/enrollments/${enrollmentId}/pay`,
        { method: "POST", json: {} },
      ),
    enabled: false,
    retry: false,
  });
  return {
    checkoutUrl: q.data?.checkoutUrl,
    refetch: q.refetch,
    isFetching: q.isFetching,
  };
}