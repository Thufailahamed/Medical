"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, RefreshCw, XCircle } from "lucide-react";

import { api } from "@/portal/lib/api";
import {
  HERO_CHIP,
  HeroAccent,
  PANEL,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

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
    <Suspense
      fallback={
        <PatientPage>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </PatientPage>
      }
    >
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
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Insurance hub
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<CreditCard size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Checkout"
        title={
          <>
            Payment <HeroAccent>cancelled</HeroAccent>
          </>
        }
        description="The checkout was cancelled before completion. No amount was charged."
        chips={<span className={HERO_CHIP}>No charge made</span>}
      />

      <div className="mx-auto w-full max-w-2xl">
        <section className={`${PANEL} py-10 text-center`}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <XCircle size={26} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Payment cancelled</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
            {order
              ? `Order ${order} was cancelled before completion. No amount was charged — you can retry whenever you're ready.`
              : "Payment was cancelled before completion. No amount was charged — you can retry whenever you're ready."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {pending.length > 0 && pending[0] ? (
              <Link
                href={`/patient/insurance/payment/${pending[0].id}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                <RefreshCw size={13} /> Retry payment
              </Link>
            ) : null}
            <Link
              href="/patient/insurance"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              Back to Insurance Hub
            </Link>
          </div>
        </section>
      </div>
    </PatientPage>
  );
}
