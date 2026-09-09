"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, XCircle } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";

interface EnrollmentsResponse {
  enrollments: Array<{
    id: string;
    status: string;
    policyNumber: string | null;
    planName?: string | null;
  }>;
}

export default function InsurancePaymentCancelPage() {
  return (
    <Suspense fallback={<Card><div className="h-48 animate-pulse" /></Card>}>
      <CancelInner />
    </Suspense>
  );
}

function CancelInner() {
  const search = useSearchParams();
  const order = search.get("order") ?? "";

  const q = useQuery({
    queryKey: ["insurance", "payment-cancel", order],
    queryFn: () =>
      api<EnrollmentsResponse>("/insurance-marketplace/enrollments/me"),
    refetchInterval: false,
  });

  const pending = (q.data?.enrollments ?? []).filter(
    (e) => e.status === "payment_pending",
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

      <Card className="text-center py-10">
        <XCircle size={28} className="mx-auto text-text-muted" />
        <h1 className="text-xl font-bold text-text mt-3">Payment cancelled</h1>
        <p className="text-sm text-text-soft mt-1">
          {order
            ? `Order ${order} was cancelled before completion. No amount was charged.`
            : "Payment was cancelled before completion. No amount was charged."}
        </p>
        {pending.length > 0 && pending[0] ? (
          <div className="mt-5">
            <Link href={`/patient/insurance/payment/${pending[0].id}`}>
              <Button>Retry payment</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <Link href="/patient/insurance">
              <Button variant="secondary">Back to Insurance Hub</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
