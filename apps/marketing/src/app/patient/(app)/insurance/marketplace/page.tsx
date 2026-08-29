"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Sparkles,
  ShieldCheck,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  Star,
  TrendingDown,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Input } from "@/portal/components/ui/Form";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";

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
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
] as const;

const SORT_OPTIONS: Array<{ value: "rating" | "premium" | "premium-desc"; label: string }> = [
  { value: "rating", label: "Top rated" },
  { value: "premium", label: "Lowest premium" },
  { value: "premium-desc", label: "Highest premium" },
];

const TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  family_floater: "Family Floater",
  senior: "Senior",
  critical_illness: "Critical Illness",
  cancer: "Cancer Care",
  dental: "Dental",
  maternity: "Maternity",
};

export default function PatientMarketplace() {
  const t = useT();
  const [planType, setPlanType] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "premium" | "premium-desc">(
    "rating",
  );

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
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-text">Marketplace</h1>
        <p className="text-sm text-text-soft mt-0.5">
          {data
            ? `${providers.length} providers · ${plans.length} plans`
            : "Loading…"}
        </p>
      </header>

      <Card padding={false} className="bg-gradient-to-br from-brand to-brand-strong text-white border-0">
        <div className="p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/70 font-bold">
            <Sparkles size={12} />
            Find your perfect plan
          </div>
          <h2 className="text-xl font-bold mt-1">
            {providers.length} providers · {plans.length} plans
          </h2>
          <p className="text-sm text-white/80 mt-1">
            Compare plans from top insurers. Buy in 3 minutes.
          </p>
          <div className="mt-4 relative max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search insurers, plans, features"
              className="pl-9 !bg-white !text-text"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold mb-2">
              Plan type
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label={`All (${plans.length})`}
                active={!planType}
                onClick={() => setPlanType("")}
              />
              {PLAN_TYPES.map((pt) => (
                <FilterChip
                  key={pt}
                  label={`${TYPE_LABEL[pt]} (${countsByType[pt] ?? 0})`}
                  active={planType === pt}
                  onClick={() => setPlanType(planType === pt ? "" : pt)}
                />
              ))}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold mb-2">
              Sort by
            </div>
            <div className="flex flex-col gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                    sort === opt.value
                      ? "bg-brand-soft text-brand-strong font-semibold"
                      : "text-text-soft hover:bg-surface-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold mb-2">
              Top insurers
            </div>
            <div className="space-y-2">
              {providers.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/portal/me/insurance/marketplace/${p.slug}`}
                  className="flex items-center gap-2 text-sm hover:text-brand"
                >
                  <Building2 size={14} className="text-text-muted" />
                  <span className="flex-1 truncate text-text-soft">{p.name}</span>
                  <ChevronRight size={12} className="text-text-muted" />
                </Link>
              ))}
            </div>
          </Card>
        </aside>

        {/* Plans */}
        <div className="space-y-5 min-w-0">
          {featured.length > 0 ? (
            <section>
              <SectionHeading title="Top picks this week" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {featured.map((plan) => (
                  <FeaturedPlanCard
                    key={plan.id}
                    plan={plan}
                    providerName={providerById[plan.providerId]?.name ?? "Insurer"}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionHeading title="All available plans" />
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <Card className="text-center py-12">
                <Search size={28} className="mx-auto text-text-muted" />
                <p className="text-sm text-text-soft mt-2">
                  No plans match your search
                </p>
                <button
                  onClick={() => {
                    setQ("");
                    setPlanType("");
                  }}
                  className="text-xs text-brand hover:text-brand-strong font-semibold mt-2"
                >
                  Clear filters
                </button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    providerName={providerById[plan.providerId]?.name ?? "Insurer"}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, providerName }: { plan: Plan; providerName: string }) {
  const hasDiscount = plan.annualDiscountPct > 0;
  return (
    <Link href={`/portal/me/insurance/plans/${plan.id}`}>
      <Card className="h-full flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center text-xs font-bold shrink-0">
            {providerName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-text-soft truncate">{providerName}</div>
            <Pill tone="neutral" className="!text-[10px]">
              {TYPE_LABEL[plan.planType] ?? plan.planType}
            </Pill>
          </div>
        </div>
        <div className="font-semibold text-text leading-tight">{plan.name}</div>
        <div className="flex flex-wrap gap-1">
          {plan.isFeatured ? (
            <Pill tone="brand">
              <Sparkles size={10} />
              Featured
            </Pill>
          ) : null}
          {hasDiscount ? (
            <Pill tone="success">
              <TrendingDown size={10} />
              Save {plan.annualDiscountPct.toFixed(0)}%
            </Pill>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-soft">
          <ShieldCheck size={12} className="text-emerald-600" />
          Up to {formatLkr(plan.coverageSummaryLkr)} coverage
        </div>
        <div className="mt-auto pt-3 border-t border-border/60 flex items-end justify-between">
          <div>
            <div className="text-xl font-bold text-brand-strong leading-tight">
              {formatLkr(plan.monthlyPremiumLkr)}
              <span className="text-xs text-text-muted font-medium"> /mo</span>
            </div>
            <div className="text-[11px] text-text-muted">
              or {formatLkr(plan.annualPremiumLkr)}/yr
            </div>
          </div>
          <div className="text-right text-[11px] text-text-muted">
            <div>{plan.networkHospitalCount}+ hospitals</div>
            <div>{plan.copayPct}% co-pay</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function FeaturedPlanCard({
  plan,
  providerName,
}: {
  plan: Plan;
  providerName: string;
}) {
  return (
    <Link href={`/portal/me/insurance/plans/${plan.id}`}>
      <Card className="h-full border-2 border-brand/30 bg-brand-soft/30 flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <Pill tone="brand">
            <Sparkles size={10} />
            Top Pick
          </Pill>
          {plan.annualDiscountPct > 0 ? (
            <Pill tone="success">
              <TrendingDown size={10} />
              {plan.annualDiscountPct.toFixed(0)}% off
            </Pill>
          ) : null}
        </div>
        <div className="font-bold text-text">{plan.name}</div>
        <div className="text-xs text-text-soft">by {providerName}</div>
        <div className="text-xl font-bold text-brand-strong">
          {formatLkr(plan.monthlyPremiumLkr)}
          <span className="text-xs text-text-muted font-medium"> /mo</span>
        </div>
      </Card>
    </Link>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-brand text-white border-brand font-semibold"
          : "bg-surface-1 text-text-soft border-border/60 hover:border-border"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-base font-bold text-text flex items-center gap-2">
      {title}
    </h2>
  );
}