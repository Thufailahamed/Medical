"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

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
  const { data, isLoading } = useQuery({
    queryKey: ["insurance", "provider", providerId],
    queryFn: () =>
      api<ProviderDetail>(`/insurance-marketplace/providers/${providerId}`),
  });

  const p = data?.provider;
  const plans = data?.plans ?? [];

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Marketplace
        </Link>
      </div>

      {isLoading || !p ? (
        <>
          <section className={PANEL}>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : (
              <EmptyBlock
                icon={<Building2 size={19} />}
                title="Provider not found"
                body="This insurer may no longer be listed on the marketplace."
              />
            )}
          </section>
        </>
      ) : (
        <>
          <PatientHero
            kickerIcon={<Building2 size={13} aria-hidden />}
            kicker="Insurance"
            kickerMeta="Accredited insurer"
            title={
              <>
                <HeroAccent>{p.name}</HeroAccent>
              </>
            }
            description={
              p.tagline ??
              p.description ??
              "Licensed health insurance provider on the marketplace."
            }
            chips={
              <>
                <span className={HERO_CHIP}>
                  <Star size={12} className="fill-amber-300 text-amber-300" />
                  {p.ratingAvg.toFixed(1)} ({p.ratingCount})
                </span>
                {p.claimSettlementRatioPct != null ? (
                  <span className={HERO_CHIP}>
                    <ShieldCheck size={12} className="text-emerald-300" />
                    {p.claimSettlementRatioPct}% claim settlement
                  </span>
                ) : null}
                {p.cashlessHospitalCount != null ? (
                  <span className={HERO_CHIP}>{p.cashlessHospitalCount}+ cashless hospitals</span>
                ) : null}
                {p.regulatorLicense ? (
                  <span className={HERO_CHIP}>License {p.regulatorLicense}</span>
                ) : null}
              </>
            }
            actions={
              <>
                {p.supportPhone ? (
                  <a href={`tel:${p.supportPhone}`} className={HERO_GHOST}>
                    <Phone size={13} /> {p.supportPhone}
                  </a>
                ) : null}
                {p.websiteUrl ? (
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={HERO_GHOST}
                  >
                    <ExternalLink size={13} /> Website
                  </a>
                ) : null}
              </>
            }
          />

          <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={<ShieldCheck size={16} />}
              tone="bg-sky-50 text-sky-600"
              label="Plans"
              value={String(plans.length)}
              sub="Published policies"
            />
            <StatTile
              icon={<Star size={16} />}
              tone="bg-amber-50 text-amber-600"
              label="Rating"
              value={p.ratingAvg.toFixed(1)}
              sub={`${p.ratingCount} reviews`}
            />
            <StatTile
              icon={<TrendingDown size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              label="Settlement"
              value={p.claimSettlementRatioPct != null ? `${p.claimSettlementRatioPct}%` : "—"}
              sub="Claims settled"
            />
            <StatTile
              icon={<Building2 size={16} />}
              tone="bg-violet-50 text-violet-600"
              label="Cashless"
              value={p.cashlessHospitalCount != null ? `${p.cashlessHospitalCount}+` : "—"}
              sub="Network hospitals"
            />
          </HeroOverlap>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex flex-col gap-5 xl:col-span-8">
              {p.description ? (
                <section className={PANEL}>
                  <PanelHeader
                    icon={<Building2 size={16} />}
                    tone="bg-sky-50 text-sky-600"
                    title="About this insurer"
                    caption="Company profile and underwriting details."
                  />
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{p.description}</p>
                </section>
              ) : null}

              <section className={PANEL}>
                <PanelHeader
                  icon={<Shield size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title={`Plans by ${p.name} (${plans.length})`}
                  caption="Tap a plan to see full benefits and enroll."
                />
                {plans.length === 0 ? (
                  <EmptyBlock
                    icon={<Shield size={19} />}
                    title="No published plans yet"
                    body="This insurer has no plans listed right now — check back soon."
                  />
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/patient/insurance/plans/${plan.id}`}
                        className="group flex h-full flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-bold leading-tight text-slate-900 group-hover:text-sky-700">
                            {plan.name}
                          </div>
                          <Badge tone="sky">{TYPE_LABEL[plan.planType] ?? plan.planType}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.isFeatured ? (
                            <Badge tone="amber">
                              <Sparkles size={10} /> Featured
                            </Badge>
                          ) : null}
                          {plan.annualDiscountPct > 0 ? (
                            <Badge tone="emerald">
                              <TrendingDown size={10} /> Save {plan.annualDiscountPct.toFixed(0)}%
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <ShieldCheck size={12} className="text-emerald-600" />
                          Up to {formatLkr(plan.coverageSummaryLkr)} · {plan.copayPct}% co-pay ·{" "}
                          {plan.networkHospitalCount}+ hospitals
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <div>
                            <span className="text-base font-bold text-slate-900">
                              {formatLkr(plan.monthlyPremiumLkr)}
                            </span>
                            <span className="text-xs font-medium text-slate-400"> /mo</span>
                            <div className="text-[11px] text-slate-400">
                              or {formatLkr(plan.annualPremiumLkr)}/yr
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="flex flex-col gap-5 xl:col-span-4">
              <QuickToolsPanel
                id="prov-tools"
                title="Insurance"
                tools={[
                  {
                    icon: ShieldCheck,
                    label: "Policies",
                    hint: "My cover",
                    href: "/patient/insurance",
                    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  },
                  {
                    icon: Building2,
                    label: "Marketplace",
                    hint: "All insurers",
                    href: "/patient/insurance/marketplace",
                    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                  },
                  {
                    icon: Phone,
                    label: "Support",
                    hint: p.supportPhone ?? "Call",
                    href: p.supportPhone ? `tel:${p.supportPhone}` : "/patient/insurance",
                    tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
                  },
                ]}
              />

              <PromoCard
                icon={<ShieldCheck size={21} aria-hidden />}
                kicker="Cashless"
                title="Instant cashless approval"
                body={`${p.cashlessHospitalCount ?? "100"}+ network hospitals settle directly with ${p.name}.`}
                href="/patient/insurance/claims/new"
              />
            </div>
          </div>
        </>
      )}
    </PatientPage>
  );
}
