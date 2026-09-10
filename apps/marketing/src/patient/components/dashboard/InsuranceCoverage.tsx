"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileCheck2,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { useInsurance, type InsuranceStatus } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const STATUS_TONE: Record<InsuranceStatus, string> = {
  active: "text-emerald-700 bg-emerald-50 border-emerald-200/70",
  pending: "text-amber-700 bg-amber-50 border-amber-200/70",
  lapsed: "text-rose-700 bg-rose-50 border-rose-200/70",
  expired: "text-rose-700 bg-rose-50 border-rose-200/70",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil(
    (new Date(iso).getTime() - new Date(new Date().toDateString()).getTime()) /
      86_400_000,
  );
}

export function InsuranceCoverage({ className }: { className?: string }) {
  const q = useInsurance();
  const loading = q.isLoading;
  const policy = q.data?.policy ?? null;
  const claimsOpen = q.data?.claimsOpen ?? 0;
  const days = daysUntil(policy?.renewsAt ?? null);

  const renewalTone =
    days != null && days <= 30
      ? "text-amber-700 bg-amber-50 border-amber-200/70"
      : days != null
        ? "text-sky-700 bg-sky-50 border-sky-200/70"
        : "text-slate-600 bg-slate-100 border-slate-200/70";

  return (
    <section
      aria-labelledby="ins-heading"
      className={cn(
        "anim-rise anim-rise-delay-2 flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-card transition-all",
        className,
      )}
    >
      <div>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-2xs"
              aria-hidden
            >
              <Shield size={16} />
            </div>
            <div>
              <h2 id="ins-heading" className="text-sm font-bold text-slate-900 tracking-tight">
                Insurance
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                Coverage &amp; active policy
              </p>
            </div>
          </div>
          <Link
            href="/patient/insurance"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
          >
            <span>Manage</span>
            <ArrowRight size={12} aria-hidden />
          </Link>
        </header>

        {/* ── Content States ─────────────────────────────────────────── */}
        {loading ? (
          <div data-testid="insurance-skeleton" className="space-y-2.5 my-2">
            <div className="h-16 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
            <div className="h-10 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
          </div>
        ) : !policy ? (
          <div className="my-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-5 text-center shadow-2xs">
            <div
              className="mb-2.5 grid h-10 w-10 place-items-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600 shadow-2xs"
              aria-hidden
            >
              <CreditCard size={18} />
            </div>
            <p className="text-xs font-bold text-slate-900">
              No insurance policy linked
            </p>
            <p className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-slate-500">
              Connect your health policy to track claims, check benefits, and access cashless hospital admissions.
            </p>
            <Link
              href="/patient/insurance"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] px-3.5 py-2 text-xs font-semibold text-white shadow-xs shadow-blue-600/25 border border-blue-600 transition-all cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} aria-hidden />
              <span>Link policy</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/70 via-white to-blue-50/20 p-4 shadow-2xs">
            {/* Policy Title & Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Health Plan
                </span>
                <p className="truncate text-sm font-bold text-slate-900">
                  {policy.provider}
                </p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-slate-600">
                  {policy.number}
                </p>
              </div>
              <span
                data-testid="status-pill"
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-2xs",
                  STATUS_TONE[policy.status] ?? STATUS_TONE.active,
                )}
              >
                {policy.status}
              </span>
            </div>

            {/* Renewal & Claims Strip */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
              {days != null ? (
                <span
                  data-testid="renewal-chip"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-2xs",
                    renewalTone,
                  )}
                >
                  <ShieldCheck size={11} />
                  <span>{days <= 0 ? "Renewal due" : `renews in ${days}d`}</span>
                </span>
              ) : null}

              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <FileCheck2 size={13} className="text-blue-600" />
                <span>
                  {claimsOpen === 0
                    ? "No open claims"
                    : `${claimsOpen} open claim${claimsOpen === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Cashless hospitalization eligible</span>
        </span>
        <Link
          href="/patient/insurance"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          View digital card →
        </Link>
      </div>
    </section>
  );
}
