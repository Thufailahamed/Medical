"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ShieldCheck,
  Clock,
  Wallet,
  Users,
  Check,
  X,
  HeartPulse,
  Sparkles,
  TrendingDown,
  ChevronRight,
  Calculator,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";

interface PlanDetailResponse {
  plan: {
    id: string;
    name: string;
    planType: string;
    coverageSummaryLkr: number;
    coverageDetailsJson?: Record<string, unknown> | null;
    monthlyPremiumLkr: number;
    annualPremiumLkr: number;
    annualDiscountPct: number;
    deductibleLkr: number;
    copayPct: number;
    coPaymentCapLkr: number;
    waitingPeriodDays: number;
    preExistingWaitingDays: number;
    networkHospitalCount: number;
    keyFeatures: string[] | null;
    exclusions: string[] | null;
    termMonths: number;
    isFeatured: boolean;
    providerName?: string;
    providerSlug?: string;
  };
}

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  family_floater: "Family Floater",
  senior: "Senior",
  critical_illness: "Critical Illness",
  cancer: "Cancer Care",
  dental: "Dental",
  maternity: "Maternity",
};

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const t = useT();
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");

  const { data, isLoading } = useQuery({
    queryKey: ["insurance", "plan", planId],
    queryFn: () =>
      api<PlanDetailResponse>(`/insurance-marketplace/plans/${planId}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">Plan not found.</p>
        <Link
          href="/portal/me/insurance/marketplace"
          className="text-xs text-brand hover:text-brand-strong font-semibold mt-3 inline-block"
        >
          ← Back to marketplace
        </Link>
      </Card>
    );
  }

  const plan = data.plan;
  const premium =
    cycle === "monthly" ? plan.monthlyPremiumLkr : plan.annualPremiumLkr;
  const cycleLabel = cycle === "monthly" ? "/month" : "/year";

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/portal/me/insurance/marketplace"
          className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
        >
          ← Marketplace
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5 min-w-0">
          {/* Header */}
          <Card>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
                <Building2 size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-soft">
                  {plan.providerName ?? "Insurer"}
                </div>
                <h1 className="text-2xl font-bold text-text leading-tight mt-1">
                  {plan.name}
                </h1>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Pill tone="brand">{TYPE_LABEL[plan.planType]}</Pill>
                  {plan.isFeatured ? (
                    <Pill tone="accent">
                      <Sparkles size={10} />
                      Featured
                    </Pill>
                  ) : null}
                  {plan.annualDiscountPct > 0 ? (
                    <Pill tone="success">
                      <TrendingDown size={10} />
                      Save {plan.annualDiscountPct.toFixed(0)}% annually
                    </Pill>
                  ) : null}
                  <Pill tone="neutral">{plan.termMonths}-month term</Pill>
                </div>
              </div>
            </div>
          </Card>

          {/* Coverage details */}
          <Card>
            <h2 className="text-base font-bold text-text mb-3">
              Coverage & benefits
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailRow
                icon={<ShieldCheck size={14} className="text-emerald-600" />}
                label="Coverage up to"
                value={formatLkr(plan.coverageSummaryLkr)}
              />
              <DetailRow
                icon={<HeartPulse size={14} className="text-rose-600" />}
                label="Co-pay"
                value={`${plan.copayPct}%`}
              />
              <DetailRow
                icon={<Wallet size={14} className="text-amber-600" />}
                label="Deductible"
                value={
                  plan.deductibleLkr > 0
                    ? formatLkr(plan.deductibleLkr)
                    : "None"
                }
              />
              <DetailRow
                icon={<Wallet size={14} className="text-amber-600" />}
                label="Co-pay cap"
                value={
                  plan.coPaymentCapLkr > 0
                    ? formatLkr(plan.coPaymentCapLkr)
                    : "Unlimited"
                }
              />
              <DetailRow
                icon={<Clock size={14} className="text-sky-600" />}
                label="Waiting period"
                value={`${plan.waitingPeriodDays} days`}
              />
              <DetailRow
                icon={<Clock size={14} className="text-sky-600" />}
                label="Pre-existing wait"
                value={`${plan.preExistingWaitingDays} days`}
              />
              <DetailRow
                icon={<Users size={14} className="text-violet-600" />}
                label="Network hospitals"
                value={`${plan.networkHospitalCount}+`}
              />
            </div>
          </Card>

          {/* Key features */}
          {plan.keyFeatures && plan.keyFeatures.length > 0 ? (
            <Card>
              <h2 className="text-base font-bold text-text mb-3">
                Key features
              </h2>
              <ul className="space-y-2">
                {plan.keyFeatures.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text"
                  >
                    <Check
                      size={14}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Exclusions */}
          {plan.exclusions && plan.exclusions.length > 0 ? (
            <Card>
              <h2 className="text-base font-bold text-text mb-3">
                Exclusions
              </h2>
              <ul className="space-y-2">
                {plan.exclusions.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-soft"
                  >
                    <X size={14} className="text-red-500 shrink-0 mt-0.5" />
                    {e}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* Sticky buy sidebar */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
          <Card className="border-2 border-brand/20">
            <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold">
              Premium
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="text-3xl font-bold text-brand-strong">
                {formatLkr(premium)}
              </div>
              <div className="text-sm text-text-muted">{cycleLabel}</div>
            </div>
            <div className="text-xs text-text-soft mt-0.5">
              {cycle === "annual" && plan.annualDiscountPct > 0
                ? `Save ${plan.annualDiscountPct.toFixed(0)}% vs monthly`
                : cycle === "monthly"
                  ? `Or ${formatLkr(plan.annualPremiumLkr)}/yr (save ${plan.annualDiscountPct.toFixed(0)}%)`
                  : "—"}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-lg">
              <button
                onClick={() => setCycle("monthly")}
                className={`text-xs font-semibold py-1.5 rounded-md transition-colors ${
                  cycle === "monthly"
                    ? "bg-surface shadow text-brand-strong"
                    : "text-text-soft"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setCycle("annual")}
                className={`text-xs font-semibold py-1.5 rounded-md transition-colors ${
                  cycle === "annual"
                    ? "bg-surface shadow text-brand-strong"
                    : "text-text-soft"
                }`}
              >
                Annual
              </button>
            </div>

            <Link
              href={`/portal/me/insurance/quote?planId=${plan.id}&cycle=${cycle}`}
              className="block w-full mt-4"
            >
              <Button block size="lg">
                Get personalised quote
                <ChevronRight size={14} />
              </Button>
            </Link>
            <Link
              href={`/portal/me/insurance/enroll/${plan.id}?cycle=${cycle}`}
              className="block w-full mt-2"
            >
              <Button block variant="secondary" size="md">
                Enrol directly
              </Button>
            </Link>

            <div className="mt-4 pt-4 border-t border-border/60 text-xs text-text-soft flex items-start gap-2">
              <Calculator size={12} className="mt-0.5 shrink-0" />
              Premiums are indicative. Final price reflects your age, family,
              and any pre-existing conditions.
            </div>
          </Card>

          {plan.providerSlug ? (
            <Link
              href={`/portal/me/insurance/marketplace/${plan.providerSlug}`}
            >
              <Card className="hover:bg-surface-2/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-soft">Insurer</div>
                    <div className="text-sm font-semibold text-text truncate">
                      {plan.providerName}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-text-muted" />
                </div>
              </Card>
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted">{label}</div>
        <div className="text-sm font-semibold text-text truncate">{value}</div>
      </div>
    </div>
  );
}