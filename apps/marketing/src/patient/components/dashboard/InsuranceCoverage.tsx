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
import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";

const STATUS_TONE: Record<InsuranceStatus, string> = {
  active: "text-success bg-success-soft",
  pending: "text-warn bg-warn-soft",
  lapsed: "text-danger bg-danger-soft",
  expired: "text-danger bg-danger-soft",
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
      ? "text-warn bg-warn-soft"
      : days != null
        ? "text-brand bg-brand-soft"
        : "text-text-soft bg-surface-2";

  return (
    <Card
      as="section"
      className={cn("anim-rise anim-rise-delay-2 flex h-full flex-col", className)}
    >
      <div>
        <CardHeader
          title="Insurance"
          caption="Coverage & active policy"
          icon={<Shield size={16} aria-hidden />}
          href="/patient/insurance"
          linkLabel="Manage"
        />

        {loading ? (
          <div data-testid="insurance-skeleton" className="mt-4 space-y-2.5">
            <div className="h-24 rounded-xl patient-shimmer" />
            <div className="h-8 rounded-lg patient-shimmer" />
          </div>
        ) : !policy ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-surface-2 p-4">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface text-brand shadow-card"
              aria-hidden
            >
              <CreditCard size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">No policy linked</p>
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                Connect your plan to track claims and check benefits.
              </p>
              <Link
                href="/patient/insurance"
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                <Plus size={13} strokeWidth={2.5} aria-hidden />
                Link policy
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {/* Digital card */}
            <Link
              href="/patient/insurance"
              className="relative block overflow-hidden rounded-xl bg-gradient-to-br from-[#1a3a8f] via-[#2a58d9] to-[#3b82f6] p-4 text-white shadow-brand transition-transform hover:-translate-y-0.5"
            >
              <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
              <span className="pointer-events-none absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-white/5" aria-hidden />
              <span className="relative flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[10.5px] font-medium uppercase tracking-wider text-white/60">
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
              <span className="inline-flex items-center gap-1.5 text-text-soft">
                <FileCheck2 size={13} className="text-brand" aria-hidden />
                {claimsOpen === 0
                  ? "No open claims"
                  : `${claimsOpen} open claim${claimsOpen === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
