"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useInsurance, type InsuranceStatus } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const STATUS_TONE: Record<InsuranceStatus, string> = {
  active: "text-emerald-700 bg-emerald-50",
  pending: "text-amber-700 bg-amber-50",
  lapsed: "text-rose-700 bg-rose-50",
  expired: "text-rose-700 bg-rose-50",
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
  const loading = q.isLoading || !q.data;
  const policy = q.data?.policy ?? null;
  const claimsOpen = q.data?.claimsOpen ?? 0;
  const days = daysUntil(policy?.renewsAt ?? null);
  const renewalTone =
    days != null && days <= 30
      ? "text-amber-700 bg-amber-50"
      : days != null
        ? "text-sky-700 bg-sky-50"
        : "text-text-muted bg-slate-50";

  return (
    <section aria-labelledby="ins-heading" className={cn("anim-rise anim-rise-delay-2 rounded-2xl border border-border bg-white p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-text-muted" aria-hidden />
          <h2 id="ins-heading" className="t-card-title">Insurance</h2>
        </div>
        <Link href="/patient/insurance" className="text-xs font-bold text-brand hover:underline">Manage →</Link>
      </header>

      {loading || !policy ? (
        <div data-testid="insurance-skeleton" className="space-y-2">
          <div className="h-12 rounded-lg bg-slate-50 animate-pulse" />
          <div className="h-8 rounded-lg bg-slate-50 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-text">{policy.provider}</div>
              <div className="font-mono text-[11px] text-text-muted truncate">{policy.number}</div>
            </div>
            <span
              data-testid="status-pill"
              className={cn("shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_TONE[policy.status] ?? STATUS_TONE.active)}
            >
              {policy.status}
            </span>
          </div>

          {days != null ? (
            <span
              data-testid="renewal-chip"
              className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", renewalTone)}
            >
              {days <= 0 ? "Renewal due" : `renews in ${days}d`}
            </span>
          ) : null}

          <div className="text-[12px] text-text-muted">
            {claimsOpen === 0 ? "No open claims" : `${claimsOpen} open claim${claimsOpen === 1 ? "" : "s"}`}
          </div>
        </div>
      )}
    </section>
  );
}
