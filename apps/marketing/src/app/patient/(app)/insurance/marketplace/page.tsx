"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  Filter,
  Percent,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroPulse,
  PANEL,
  PanelHeader,
  PanelSearch,
  PatientHero,
  PatientPage,
  PromoCard,
  StatTile,
} from "@/patient/components/workspace";

interface Provider {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  claimSettlementRatioPct: number | null;
  cashlessHospitalCount: number | null;
  ratingAvg: number;
  ratingCount: number;
  planCount?: number;
}

interface Plan {
  id: string;
  providerId: string;
  slug: string;
  name: string;
  planType: string;
  coverageSummaryLkr: number;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct: number;
  copayPct: number;
  networkHospitalCount: number;
  waitingPeriodDays: number;
  isFeatured: boolean;
}

const PLAN_TYPES = [
  { id: "individual", label: "Individual" },
  { id: "family_floater", label: "Family Floater" },
  { id: "senior", label: "Senior Citizen" },
  { id: "critical_illness", label: "Critical Illness" },
  { id: "cancer", label: "Cancer Care" },
  { id: "dental", label: "Dental Care" },
  { id: "maternity", label: "Maternity" },
] as const;

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "premium", label: "Lowest Premium" },
  { value: "premium-desc", label: "Highest Coverage" },
] as const;

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  family_floater: "Family Floater",
  senior: "Senior Citizen",
  critical_illness: "Critical Illness",
  cancer: "Cancer Care",
  dental: "Dental",
  maternity: "Maternity",
};

// Map plan type → on-brand illustration used in hero & plan cards.
const PLAN_TYPE_IMAGE: Record<string, string> = {
  individual: "/assets/insurance/plan-types/insurance-individual.jpg",
  family_floater: "/assets/insurance/plan-types/insurance-family.jpg",
  senior: "/assets/insurance/plan-types/insurance-senior.jpg",
  critical_illness: "/assets/insurance/plan-types/insurance-critical-illness.jpg",
  cancer: "/assets/insurance/plan-types/insurance-cancer.jpg",
  dental: "/assets/insurance/plan-types/insurance-dental.jpg",
  maternity: "/assets/insurance/plan-types/insurance-maternity.jpg",
};

function planImageFor(planType: string): string | undefined {
  return PLAN_TYPE_IMAGE[planType];
}

export default function PatientMarketplace() {
  const [planType, setPlanType] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "premium" | "premium-desc">("rating");

  const { data, isLoading } = useQuery({
    queryKey: ["insurance", "catalog", { planType, q, sort }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (planType) params.set("plan_type", planType);
      if (q.trim()) params.set("q", q.trim());
      if (sort) params.set("sort", sort);
      return api<{ providers: Provider[]; plans: Plan[] }>(
        `/insurance-marketplace/catalog?${params.toString()}`,
      );
    },
  });

  const providers = useMemo(() => data?.providers ?? [], [data?.providers]);
  const plans = useMemo(() => data?.plans ?? [], [data?.plans]);
  const featured = plans.filter((p) => p.isFeatured).slice(0, 4);

  const providerById = useMemo(() => {
    const m: Record<string, Provider> = {};
    for (const p of providers) m[p.id] = p;
    return m;
  }, [providers]);

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plans) counts[p.planType] = (counts[p.planType] ?? 0) + 1;
    return counts;
  }, [plans]);

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Sparkles size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Certified marketplace"
        title={
          <>
            Compare &amp; buy <HeroAccent>health plans</HeroAccent>
          </>
        }
        description="Discover individual, family floater, and critical illness plans from Sri Lanka's leading insurers — cashless admissions and instant digital issuance."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Building2 size={12} className="text-sky-300" />
              {providers.length} insurers
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              {plans.length} plans listed
            </span>
            <span className={HERO_CHIP}>100+ cashless hospitals</span>
          </>
        }
        aside={
          <HeroPulse
            icon={<Percent size={20} />}
            label="Max cover"
            value="LKR 10M"
            sub="Sum insured available"
          />
        }
        actions={
          <>
            <Link href="/patient/insurance" className={HERO_GHOST}>
              <ShieldCheck size={13} /> My policies
            </Link>
            <Link href="/patient/insurance/coverage-check" className={HERO_PRIMARY}>
              <Activity size={14} className="text-sky-600" /> Coverage estimator
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Insurers"
          value={String(providers.length)}
          sub="Accredited partners"
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Plans"
          value={String(plans.length)}
          sub="Health plans listed"
        />
        <StatTile
          icon={<Zap size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Cashless network"
          value="100+"
          sub="Hospitals islandwide"
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Featured"
          value={String(featured.length)}
          sub="Top picks this week"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* ── Filter rail ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 xl:col-span-3">
          <section className={PANEL}>
            <PanelHeader
              icon={<Filter size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Filters"
              caption={planType || q ? "Filters active" : "All categories"}
              action={
                planType || q ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanType("");
                      setQ("");
                    }}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Reset
                  </button>
                ) : null
              }
            />
            <div className="mt-4">
              <p className={GROUP_LABEL}>Plan category</p>
              <div className="mt-2 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setPlanType("")}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all",
                    !planType
                      ? "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.3)]"
                      : "text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <span>All categories</span>
                  <span className="text-[11px] opacity-70">({plans.length})</span>
                </button>
                {PLAN_TYPES.map((pt) => {
                  const count = countsByType[pt.id] ?? 0;
                  const isSelected = planType === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setPlanType(isSelected ? "" : pt.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-all",
                        isSelected
                          ? "bg-sky-50 font-bold text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.3)]"
                          : "text-slate-500 hover:bg-slate-50",
                      )}
                    >
                      <span>{pt.label}</span>
                      <span className="text-[11px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className={GROUP_LABEL}>Sort by</p>
              <div className="mt-2 flex flex-col gap-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSort(opt.value)}
                    className={cn(
                      "w-full cursor-pointer rounded-xl px-3 py-1.5 text-left text-xs transition-all",
                      sort === opt.value
                        ? "bg-slate-100 font-bold text-slate-900"
                        : "text-slate-500 hover:bg-slate-50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className={GROUP_LABEL}>Top insurers</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {providers.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/patient/insurance/marketplace/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-1 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <span className="truncate pr-2 font-medium">{p.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px]">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      {p.ratingAvg.toFixed(1)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <PromoCard
            icon={<Activity size={21} aria-hidden />}
            kicker="Estimator"
            title="Check coverage first"
            body="Estimate out-of-pocket cost for a treatment before you buy."
            href="/patient/insurance/coverage-check"
          />
        </div>

        {/* ── Plans column ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-9">
          <PanelSearch
            value={q}
            onChange={setQ}
            placeholder="Search insurers, plan names, or benefits (e.g. Ceylinco, Maternity)…"
            ariaLabel="Search insurance plans"
            className="lg:max-w-none"
          />

          {featured.length > 0 && !planType && !q ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Sparkles size={16} />}
                tone="bg-amber-50 text-amber-600"
                title="Top picks this week"
                caption="Hand-picked plans with the best claim settlement."
              />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {featured.map((plan) => {
                  const provider = providerById[plan.providerId];
                  return (
                    <FeaturedPlanCard
                      key={plan.id}
                      plan={plan}
                      providerName={provider?.name ?? "Accredited Insurer"}
                      settlementRatio={provider?.claimSettlementRatioPct}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={`All plans (${plans.length})`}
              caption={isLoading ? "Loading…" : "Tap a card to see full benefits"}
              action={
                planType || q ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanType("");
                      setQ("");
                    }}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
            {isLoading ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <EmptyBlock
                icon={<Shield size={19} />}
                title="No plans match your criteria"
                body={
                  q
                    ? `No plans found for "${q}". Clear the search or choose another category.`
                    : "Try a different plan category to browse options."
                }
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setPlanType("");
                      setQ("");
                    }}
                    className="inline-flex h-9 items-center rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    Reset filters
                  </button>
                }
              />
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {plans.map((plan) => {
                  const provider = providerById[plan.providerId];
                  return (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      providerName={provider?.name ?? "Insurer"}
                      settlementRatio={provider?.claimSettlementRatioPct}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </PatientPage>
  );
}

function PlanImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50", className)}>
      <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
    </div>
  );
}

function FeaturedPlanCard({
  plan,
  providerName,
  settlementRatio,
}: {
  plan: Plan;
  providerName: string;
  settlementRatio?: number | null;
}) {
  const hasDiscount = plan.annualDiscountPct > 0;
  const planImage = planImageFor(plan.planType);

  return (
    <div className="relative flex flex-col justify-between gap-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/50 via-white to-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="amber">
              <Sparkles size={11} /> Top pick
            </Badge>
            {hasDiscount ? (
              <Badge tone="emerald">
                <TrendingDown size={11} /> {plan.annualDiscountPct.toFixed(0)}% off
              </Badge>
            ) : null}
          </div>
          {settlementRatio ? (
            <Badge tone="emerald">{settlementRatio}% settlement</Badge>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{plan.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">by {providerName}</p>
          </div>
          {planImage ? <PlanImage src={planImage} alt={plan.name} className="h-16 w-16" /> : null}
        </div>

        <div className="mt-3.5 flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
            <span>Up to {formatLkr(plan.coverageSummaryLkr)} sum insured</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500">
            <span>{plan.networkHospitalCount}+ network hospitals</span>
            <span>·</span>
            <span>{plan.copayPct}% co-pay</span>
            <span>·</span>
            <span>{plan.waitingPeriodDays}d waiting</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900">
            {formatLkr(plan.monthlyPremiumLkr)}
            <span className="text-xs font-normal text-slate-500"> /mo</span>
          </div>
          <p className="text-[10.5px] text-slate-400">or {formatLkr(plan.annualPremiumLkr)} /yr</p>
        </div>
        <Link
          href={`/patient/insurance/plans/${plan.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500"
        >
          View plan <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  providerName,
  settlementRatio,
}: {
  plan: Plan;
  providerName: string;
  settlementRatio?: number | null;
}) {
  const hasDiscount = plan.annualDiscountPct > 0;
  const planImage = planImageFor(plan.planType);

  return (
    <div className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md">
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-xs font-bold text-sky-700">
              {providerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-500">{providerName}</p>
              <span className="text-[10.5px] font-bold text-slate-400">
                {TYPE_LABEL[plan.planType] ?? plan.planType}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {plan.isFeatured ? <Badge tone="amber">Featured</Badge> : null}
            {hasDiscount ? (
              <Badge tone="emerald">{plan.annualDiscountPct.toFixed(0)}% off</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h3 className="flex-1 text-sm font-bold leading-snug text-slate-900 transition-colors group-hover:text-sky-700 sm:text-base">
            {plan.name}
          </h3>
          {planImage ? <PlanImage src={planImage} alt={plan.name} className="h-14 w-14" /> : null}
        </div>

        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <ShieldCheck size={13} className="shrink-0 text-emerald-600" />
            <span>Up to {formatLkr(plan.coverageSummaryLkr)} coverage</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <span>{plan.networkHospitalCount}+ hospitals</span>
            <span>·</span>
            <span>{plan.copayPct}% co-pay</span>
            {settlementRatio ? (
              <>
                <span>·</span>
                <span className="font-semibold text-emerald-700">{settlementRatio}% settlement</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div>
          <div className="text-base font-bold text-slate-900">
            {formatLkr(plan.monthlyPremiumLkr)}
            <span className="text-xs font-normal text-slate-500"> /mo</span>
          </div>
          <p className="text-[10px] text-slate-400">or {formatLkr(plan.annualPremiumLkr)} /yr</p>
        </div>
        <Link
          href={`/patient/insurance/plans/${plan.id}`}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100"
        >
          View <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
