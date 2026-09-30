"use client";

import Link from "next/link";
import {
  CreditCard,
  FileCheck2,
  Plus,
  Shield,
  ShieldCheck,
} from "lucide-react";

import { useInsurance, type InsuranceStatus } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { PANEL, PanelHeader, PrimaryLink } from "@/portal/components/doctor/Workspace";

const STATUS_TONE: Record<InsuranceStatus, string> = {
  active: "text-emerald-800 bg-emerald-300/90",
  pending: "text-amber-900 bg-amber-300/90",
  lapsed: "text-rose-900 bg-rose-300/90",
  expired: "text-rose-900 bg-rose-300/90",
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
      ? "text-amber-700 bg-amber-50"
      : days != null
        ? "text-sky-700 bg-sky-50"
        : "text-slate-600 bg-slate-100";

  return (
    <section
      aria-labelledby="pt-insurance"
      className={cn(PANEL, "flex h-full flex-col", className)}
    >
      <div>
        <PanelHeader
          id="pt-insurance"
          icon={<Shield size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Insurance"
          caption="Coverage & active policy"
          href="/patient/insurance"
          linkLabel="Manage"
        />

        {loading ? (
          <div data-testid="insurance-skeleton" className="mt-4 space-y-2.5">
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : !policy ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white text-sky-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]"
              aria-hidden
            >
              <CreditCard size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">No policy linked</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Connect your plan to track claims and check benefits.
              </p>
              <div className="mt-3">
                <PrimaryLink href="/patient/insurance" icon={<Plus size={13} strokeWidth={2.5} />}>
                  Link policy
                </PrimaryLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {/* Digital card */}
            <Link
              href="/patient/insurance"
              className="relative block overflow-hidden rounded-xl p-4 text-white transition-transform hover:-translate-y-0.5"
              style={{
                background:
                  "radial-gradient(320px 160px at 100% 0%, rgba(45,212,191,0.35), transparent 60%), linear-gradient(135deg, #07233a 0%, #0c4a6e 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 16px 32px -16px rgba(7,35,58,0.55)",
              }}
            >
              <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
              <span className="pointer-events-none absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-white/5" aria-hidden />
              <span className="relative flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">
                    Health plan
                  </span>
                  <span className="mt-0.5 block truncate text-[15px] font-semibold">
                    {policy.provider}
                  </span>
                </span>
                <span
                  data-testid="status-pill"
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    STATUS_TONE[policy.status] ?? STATUS_TONE.active,
                  )}
                >
                  {policy.status}
                </span>
              </span>
              <span className="relative mt-5 block font-mono text-sm tracking-[0.12em] text-white/90">
                {policy.number}
              </span>
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {days != null ? (
                <span
                  data-testid="renewal-chip"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
                    renewalTone,
                  )}
                >
                  <ShieldCheck size={12} aria-hidden />
                  {days <= 0 ? "Renewal due" : `renews in ${days}d`}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <FileCheck2 size={13} className="text-sky-600" aria-hidden />
                {claimsOpen === 0
                  ? "No open claims"
                  : `${claimsOpen} open claim${claimsOpen === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
