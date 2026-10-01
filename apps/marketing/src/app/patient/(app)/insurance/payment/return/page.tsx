"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
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
    providerName?: string | null;
  }>;
}

export default function InsurancePaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <PatientPage>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </PatientPage>
      }
    >
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

  const state = q.isLoading
    ? "checking"
    : active.length > 0
      ? "success"
      : pending.length > 0
        ? "pending"
        : failed.length > 0
          ? "failed"
          : "unknown";

  const toneBadge =
    state === "success"
      ? "bg-emerald-50 text-emerald-700"
      : state === "failed"
        ? "bg-rose-50 text-rose-700"
        : state === "pending" || state === "checking"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";

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
        kickerMeta="Payment verification"
        title={
          <>
            Payment <HeroAccent>{state === "success" ? "received" : "status"}</HeroAccent>
          </>
        }
        description={order ? `Verifying order ${order} with the insurer.` : "Verifying your payment with the insurer."}
        chips={
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" />
            payments.lk verified return
          </span>
        }
      />

      <div className="mx-auto w-full max-w-2xl">
        <section className={cn(PANEL, "py-8 text-center")}>
          <div
            className={cn(
              "mx-auto grid h-14 w-14 place-items-center rounded-2xl",
              state === "success"
                ? "bg-emerald-100 text-emerald-600"
                : state === "failed"
                  ? "bg-rose-100 text-rose-600"
                  : "bg-amber-100 text-amber-600",
            )}
          >
            {state === "success" ? (
              <CheckCircle2 size={26} />
            ) : state === "failed" ? (
              <XCircle size={26} />
            ) : (
              <Loader2 size={26} className="animate-spin" />
            )}
          </div>

          <span
            className={cn(
              "mt-4 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
              toneBadge,
            )}
          >
            {state === "checking"
              ? "Checking…"
              : state === "success"
                ? "Success"
                : state === "pending"
                  ? "Pending"
                  : state === "failed"
                    ? "Failed"
                    : "Unknown"}
          </span>

          {state === "checking" ? (
            <p className="mt-4 text-sm text-slate-500">
              Verifying payment with the insurer…
            </p>
          ) : state === "success" ? (
            <div className="mt-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={15} /> Premium received — policy active.
              </p>
              <div className="mt-4 space-y-2">
                {active.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`/patient/insurance/policy/${e.id}`}
                    className="group mx-auto flex max-w-sm items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-sky-200 hover:bg-sky-50/60"
                  >
                    <span className="truncate">
                      {e.planName ?? e.policyNumber ?? e.id.slice(0, 8)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700">
                      View policy <ArrowRight size={12} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : state === "pending" ? (
            <p className="mt-4 text-sm text-slate-500">
              Payment is still pending. This page auto-refreshes every 5 seconds.
            </p>
          ) : (
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <XCircle size={14} /> No active policy found yet. If you completed
              payment, wait a moment or contact support.
            </p>
          )}

          {q.isError ? (
            <p className="mt-3 text-sm font-semibold text-rose-600">
              Could not verify status. Please retry.
            </p>
          ) : null}

          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/patient/insurance"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white transition hover:bg-sky-500"
            >
              Back to Insurance
            </Link>
            {pending[0] ? (
              <Link
                href={`/patient/insurance/payment/${pending[0].id}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Open checkout
              </Link>
            ) : null}
          </div>

          <p className="mt-5 text-[11px] text-slate-400">
            Status auto-refreshes every 5 seconds while pending.
          </p>
        </section>
      </div>
    </PatientPage>
  );
}
