"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronRight,
  Filter,
  Percent,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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
  { value: "premium-desc", label: "Highest Coverage / Premium" },
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

  const providers = data?.providers ?? [];
  const plans = data?.plans ?? [];
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
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Sparkles size={12} className="text-sky-300" />
                Insurance Marketplace · Certified Coverage
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Compare &amp; Buy Health Insurance Plans
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Discover comprehensive individual, family floater, and critical illness plans from Sri Lanka&apos;s leading insurers. Cashless hospital admissions and instant digital policy issuance.
              </p>
            </div>

            {/* Quick Link to Policy Hub */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/insurance"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ShieldCheck size={13} />
                <span>My Policies</span>
              </Link>
              <Link
                href="/patient/insurance/coverage-check"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Activity size={14} className="text-sky-700" />
                <span>Coverage Estimator</span>
              </Link>
            </div>
          </div>

          {/* Integrated Search Bar inside Hero */}
          <div className="relative max-w-xl mt-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search insurers, plan names, or benefits (e.g. Ceylinco, Maternity, Cancer)..."
              className="w-full h-11 pl-10 pr-9 text-xs sm:text-sm bg-white text-slate-900 placeholder:text-slate-400 rounded-xl font-medium shadow-md border-0 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Insurers
                </p>
                <p className="text-base font-extrabold text-white">
                  {providers.length} Partners
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Available Plans
                </p>
                <p className="text-base font-extrabold text-white">
                  {plans.length} Health Plans
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Cashless Network
                </p>
                <p className="text-base font-extrabold text-white">100+ Hospitals</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Percent size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Max Coverage
                </p>
                <p className="text-base font-extrabold text-white">LKR 10,000,000</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Marketplace Content Grid (Sidebar + Main) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
        {/* Left Filters Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          {/* Plan Type Filter */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter size={12} className="text-sky-600" />
                Plan Category
              </span>
              {planType ? (
                <button
                  type="button"
                  onClick={() => setPlanType("")}
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-800"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setPlanType("")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer",
                  !planType
                    ? "bg-sky-50 text-sky-900 font-bold border border-sky-200/80 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>All Categories</span>
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
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer",
                      isSelected
                        ? "bg-sky-50 text-sky-900 font-bold border border-sky-200/80 shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <span>{pt.label}</span>
                    <span className="text-[11px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort By Filter */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Sort By
            </span>
            <div className="flex flex-col gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSort(opt.value)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer",
                    sort === opt.value
                      ? "bg-slate-100 text-slate-900 font-bold"
                      : "text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accredited Insurers List */}
          <div className="pt-3 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Top Insurers
            </span>
            <div className="flex flex-col gap-1.5">
              {providers.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs py-1 text-slate-600"
                >
                  <span className="font-medium truncate pr-2">{p.name}</span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    <span>{p.ratingAvg.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Plans Column */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* ── Featured Top Picks ────────────────────────────────────────── */}
          {featured.length > 0 && !planType && !q ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  <span>Top Picks This Week</span>
                </h2>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Hand-picked plans with best claim settlement
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {featured.map((plan) => {
                  const provider = providerById[plan.providerId];
                  return (
                    <FeaturedPlanCard
                      key={plan.id}
                      plan={plan}
                      providerName={provider?.name ?? "Ceylinco Insurance"}
                      settlementRatio={provider?.claimSettlementRatioPct}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ── All Available Plans ──────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>All Available Plans</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                  {plans.length}
                </span>
              </h2>

              {planType || q ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlanType("");
                    setQ("");
                  }}
                  className="text-xs font-bold text-sky-700 hover:text-sky-800"
                >
                  Clear all filters
                </button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    No insurance plans match your criteria
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                    {q
                      ? `No plans found for "${q}". Try clearing search or choosing another category.`
                      : "Try selecting a different plan category to browse options."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlanType("");
                    setQ("");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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

  return (
    <div className="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50/50 via-white to-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              <Sparkles size={11} className="text-amber-600" />
              Top Pick
            </span>
            {hasDiscount ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <TrendingDown size={11} />
                {plan.annualDiscountPct.toFixed(0)}% Off
              </span>
            ) : null}
          </div>

          {settlementRatio ? (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {settlementRatio}% Settlement
            </span>
          ) : null}
        </div>

        {/* Title and Provider */}
        <h3 className="text-base font-extrabold text-slate-900 leading-snug">
          {plan.name}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          by {providerName}
        </p>

        {/* Coverage & Features Strip */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col gap-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Up to {formatLkr(plan.coverageSummaryLkr)} Sum Insured</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-medium">
            <span>{plan.networkHospitalCount}+ Network Hospitals</span>
            <span>·</span>
            <span>{plan.copayPct}% Co-pay</span>
            <span>·</span>
            <span>{plan.waitingPeriodDays}d Waiting</span>
          </div>
        </div>
      </div>

      {/* Pricing & CTA */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black text-sky-950">
            {formatLkr(plan.monthlyPremiumLkr)}
            <span className="text-xs font-normal text-slate-500"> /mo</span>
          </div>
          <p className="text-[10.5px] text-slate-400">
            or {formatLkr(plan.annualPremiumLkr)} /yr
          </p>
        </div>

        <Link
          href={`/patient/insurance/plans/${plan.id}`}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0"
          style={{
            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
          }}
        >
          <span>View Plan</span>
          <ArrowRight size={13} />
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

  return (
    <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between gap-4">
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
              {providerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-600 truncate">
                {providerName}
              </p>
              <span className="text-[10.5px] font-bold text-slate-400">
                {TYPE_LABEL[plan.planType] ?? plan.planType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {plan.isFeatured ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Featured
              </span>
            ) : null}
            {hasDiscount ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {plan.annualDiscountPct.toFixed(0)}% Off
              </span>
            ) : null}
          </div>
        </div>

        {/* Plan Name */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
          {plan.name}
        </h3>

        {/* Coverage highlight */}
        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Up to {formatLkr(plan.coverageSummaryLkr)} coverage</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span>{plan.networkHospitalCount}+ hospitals</span>
            <span>·</span>
            <span>{plan.copayPct}% co-pay</span>
            {settlementRatio ? (
              <>
                <span>·</span>
                <span className="text-emerald-700 font-semibold">{settlementRatio}% settlement</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pricing & CTA */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-extrabold text-slate-900">
            {formatLkr(plan.monthlyPremiumLkr)}
            <span className="text-xs font-normal text-slate-500"> /mo</span>
          </div>
          <p className="text-[10px] text-slate-400">
            or {formatLkr(plan.annualPremiumLkr)} /yr
          </p>
        </div>

        <Link
          href={`/patient/insurance/plans/${plan.id}`}
          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors"
        >
          <span>View Plan</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}