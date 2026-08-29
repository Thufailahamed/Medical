"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Star,
  ShieldCheck,
  Phone,
  ExternalLink,
  ChevronRight,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";

interface ProviderDetail {
  provider: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    regulatorLicense: string | null;
    claimSettlementRatioPct: number | null;
    cashlessHospitalCount: number | null;
    websiteUrl: string | null;
    supportPhone: string | null;
    ratingAvg: number;
    ratingCount: number;
  };
  plans: Array<{
    id: string;
    name: string;
    planType: string;
    coverageSummaryLkr: number;
    monthlyPremiumLkr: number;
    annualPremiumLkr: number;
    annualDiscountPct: number;
    copayPct: number;
    networkHospitalCount: number;
    isFeatured: boolean;
  }>;
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

export default function ProviderDetailPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = use(params);
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["insurance", "provider", providerId],
    queryFn: () =>
      api<ProviderDetail>(`/insurance-marketplace/providers/${providerId}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data?.provider) {
    return (
      <Card className="text-center py-12">
        <Building2 size={28} className="mx-auto text-text-muted" />
        <p className="text-sm text-text-soft mt-2">Provider not found</p>
        <Link
          href="/portal/me/insurance/marketplace"
          className="text-xs text-brand hover:text-brand-strong font-semibold mt-3 inline-block"
        >
          ← Back to marketplace
        </Link>
      </Card>
    );
  }

  const p = data.provider;
  const plans = data.plans ?? [];

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

      <Card>
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text">{p.name}</h1>
            {p.tagline ? (
              <p className="text-sm text-text-soft mt-1">{p.tagline}</p>
            ) : null}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Pill tone="brand" className="inline-flex items-center gap-1">
                <Star size={10} className="text-amber-500" fill="currentColor" />
                {p.ratingAvg.toFixed(1)} ({p.ratingCount})
              </Pill>
              {p.claimSettlementRatioPct != null ? (
                <Pill tone="success">{p.claimSettlementRatioPct}% claim settlement</Pill>
              ) : null}
              {p.cashlessHospitalCount != null ? (
                <Pill tone="info">
                  {p.cashlessHospitalCount}+ cashless hospitals
                </Pill>
              ) : null}
              {p.regulatorLicense ? (
                <Pill tone="neutral">License: {p.regulatorLicense}</Pill>
              ) : null}
            </div>
          </div>
        </div>
        {p.description ? (
          <p className="text-sm text-text mt-4 pt-4 border-t border-border/60">
            {p.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/60">
          {p.supportPhone ? (
            <a
              href={`tel:${p.supportPhone}`}
              className="portal-btn portal-btn-secondary portal-btn-sm"
            >
              <Phone size={12} />
              {p.supportPhone}
            </a>
          ) : null}
          {p.websiteUrl ? (
            <a
              href={p.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-btn portal-btn-ghost portal-btn-sm"
            >
              <ExternalLink size={12} />
              Website
            </a>
          ) : null}
        </div>
      </Card>

      <section>
        <h2 className="text-base font-bold text-text mb-3">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </h2>
        {plans.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm text-text-soft">No published plans yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/portal/me/insurance/plans/${plan.id}`}
              >
                <Card className="h-full flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-text leading-tight">
                      {plan.name}
                    </div>
                    <Pill tone="neutral">
                      {TYPE_LABEL[plan.planType] ?? plan.planType}
                    </Pill>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {plan.isFeatured ? (
                      <Pill tone="brand">
                        <Sparkles size={10} />
                        Featured
                      </Pill>
                    ) : null}
                    {plan.annualDiscountPct > 0 ? (
                      <Pill tone="success">
                        <TrendingDown size={10} />
                        Save {plan.annualDiscountPct.toFixed(0)}%
                      </Pill>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-soft">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    Up to {formatLkr(plan.coverageSummaryLkr)}
                  </div>
                  <div className="mt-auto pt-3 border-t border-border/60">
                    <div className="text-xl font-bold text-brand-strong">
                      {formatLkr(plan.monthlyPremiumLkr)}
                      <span className="text-xs text-text-muted font-medium">
                        {" "}
                        /mo
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      or {formatLkr(plan.annualPremiumLkr)}/yr
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}