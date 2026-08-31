"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ShieldCheck,
  Clock,
  Wallet,
  Check,
  X,
  HeartPulse,
  Sparkles,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Calculator,
  Zap,
  BadgeCheck,
  ArrowRight,
  Hospital,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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
  individual: "Individual Health",
  family_floater: "Family Floater",
  senior: "Senior Citizen",
  critical_illness: "Critical Illness",
  cancer: "Cancer Oncology Care",
  dental: "Dental & Vision",
  maternity: "Maternity & Newborn",
};

const PLAN_TYPE_IMAGE: Record<string, string> = {
  individual: "/assets/insurance/plan-types/insurance-individual.jpg?v=2",
  family_floater: "/assets/insurance/plan-types/insurance-family.jpg?v=2",
  senior: "/assets/insurance/plan-types/insurance-senior.jpg?v=2",
  critical_illness: "/assets/insurance/plan-types/insurance-critical-illness.jpg?v=2",
  cancer: "/assets/insurance/plan-types/insurance-cancer.jpg?v=2",
  dental: "/assets/insurance/plan-types/insurance-dental.jpg?v=2",
  maternity: "/assets/insurance/plan-types/insurance-maternity.jpg?v=2",
};

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");

  const { data, isLoading } = useQuery({
    queryKey: ["insurance", "plan", planId],
    queryFn: () =>
      api<PlanDetailResponse>(`/insurance-marketplace/plans/${planId}`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-16 animate-pulse">
        <div className="h-44 rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 rounded-2xl bg-slate-100" />
          <div className="lg:col-span-4 h-80 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-slate-200 bg-white">
        <Building2 size={36} className="text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Insurance Plan Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          The requested insurance policy may have expired or is no longer listed in the marketplace.
        </p>
        <Link
          href="/patient/insurance/marketplace"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
        >
          <ChevronLeft size={14} />
          <span>Back to Insurance Marketplace</span>
        </Link>
      </div>
    );
  }

  const plan = data.plan;
  const premium =
    cycle === "monthly" ? plan.monthlyPremiumLkr : plan.annualPremiumLkr;
  const cycleLabel = cycle === "monthly" ? "/month" : "/year";

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="relative rounded-3xl p-6 md:p-8 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #082F49 0%, #0369A1 45%, #0284C7 80%, #0EA5E9 100%)",
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
            <div className="flex items-start gap-4 min-w-0 max-w-xl">
              {PLAN_TYPE_IMAGE[plan.planType] ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/20 bg-white/10 shrink-0 shadow-md">
                  <img
                    src={PLAN_TYPE_IMAGE[plan.planType]}
                    alt={plan.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                  <Building2 size={12} className="text-sky-300" />
                  {plan.providerName ?? "Accredited Health Insurer"}
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {plan.name}
                </h1>
                <p className="text-sm text-white/80 mt-1 leading-relaxed">
                  Comprehensive {TYPE_LABEL[plan.planType] ?? "Health"} plan offering up to {formatLkr(plan.coverageSummaryLkr)} in cashless hospital benefits across {plan.networkHospitalCount}+ accredited medical centers.
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ChevronLeft size={13} />
                <span>Marketplace</span>
              </Link>
              <Link
                href={`/patient/insurance/quote?planId=${plan.id}&cycle=${cycle}`}
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <Zap size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Get Personalised Quote</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Sum Insured
                </p>
                <p className="text-base font-extrabold text-white">
                  {formatLkr(plan.coverageSummaryLkr)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <HeartPulse size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Co-Payment
                </p>
                <p className="text-base font-extrabold text-white">
                  {plan.copayPct}% Co-pay
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Hospital size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Cashless Network
                </p>
                <p className="text-base font-extrabold text-white">
                  {plan.networkHospitalCount}+ Hospitals
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Policy Term
                </p>
                <p className="text-base font-extrabold text-white">
                  {plan.termMonths} Months
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Two-Column Plan Details & Purchase Stage ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Plan In-Depth Coverage */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Plan Meta Banner Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 shrink-0 shadow-2xs">
                <Building2 size={24} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">
                  {plan.providerName ?? "Accredited Insurer"}
                </div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {plan.name}
                </h2>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                {TYPE_LABEL[plan.planType] ?? plan.planType}
              </span>
              {plan.isFeatured && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Sparkles size={11} />
                  Featured Plan
                </span>
              )}
              {plan.annualDiscountPct > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <TrendingDown size={11} />
                  Save {plan.annualDiscountPct.toFixed(0)}% annually
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {plan.termMonths}-Month Contract
              </span>
            </div>
          </section>

          {/* Coverage & Benefits Grid Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-5">
            <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-sky-600" />
                  <span>Coverage &amp; Policy Benefits</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Core financial limits, deductibles, waiting windows, and inpatient terms.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hidden sm:inline-block">
                Cashless Claiming Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <BenefitTile
                icon={<ShieldCheck size={16} className="text-emerald-600" />}
                iconBg="bg-emerald-50 border-emerald-200"
                label="Maximum Annual Cover"
                value={formatLkr(plan.coverageSummaryLkr)}
                sub="Hospitalization limit"
              />
              <BenefitTile
                icon={<HeartPulse size={16} className="text-rose-600" />}
                iconBg="bg-rose-50 border-rose-200"
                label="Patient Co-Payment"
                value={`${plan.copayPct}%`}
                sub={plan.copayPct === 0 ? "Zero co-pay required" : "Per approved claim"}
              />
              <BenefitTile
                icon={<Wallet size={16} className="text-amber-600" />}
                iconBg="bg-amber-50 border-amber-200"
                label="Policy Deductible"
                value={plan.deductibleLkr > 0 ? formatLkr(plan.deductibleLkr) : "None (LKR 0)"}
                sub="Paid before insurance activates"
              />
              <BenefitTile
                icon={<Wallet size={16} className="text-sky-600" />}
                iconBg="bg-sky-50 border-sky-200"
                label="Co-Payment Cap"
                value={plan.coPaymentCapLkr > 0 ? formatLkr(plan.coPaymentCapLkr) : "Unlimited Protection"}
                sub="Max out-of-pocket ceiling"
              />
              <BenefitTile
                icon={<Clock size={16} className="text-purple-600" />}
                iconBg="bg-purple-50 border-purple-200"
                label="Initial Waiting Period"
                value={`${plan.waitingPeriodDays} Days`}
                sub="Accidental covered immediately"
              />
              <BenefitTile
                icon={<Clock size={16} className="text-indigo-600" />}
                iconBg="bg-indigo-50 border-indigo-200"
                label="Pre-Existing Condition Wait"
                value={`${plan.preExistingWaitingDays} Days`}
                sub="Prior medical history term"
              />
              <BenefitTile
                icon={<Hospital size={16} className="text-teal-600" />}
                iconBg="bg-teal-50 border-teal-200"
                label="Network Hospitals"
                value={`${plan.networkHospitalCount}+ Centers`}
                sub="Cashless direct billing"
              />
              <BenefitTile
                icon={<Zap size={16} className="text-amber-600" />}
                iconBg="bg-amber-50 border-amber-200"
                label="Claim Settlement SLA"
                value="Fast E-Discharge"
                sub="Under 45 minutes on admission"
              />
              <BenefitTile
                icon={<BadgeCheck size={16} className="text-emerald-600" />}
                iconBg="bg-emerald-50 border-emerald-200"
                label="Regulatory Certification"
                value="IRCSL Approved"
                sub="Licensed Sri Lanka provider"
              />
            </div>
          </section>

          {/* Key Features List */}
          {plan.keyFeatures && plan.keyFeatures.length > 0 && (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>What is Included &amp; Key Plan Highlights</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {plan.keyFeatures.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200/60 flex items-start gap-2.5 text-xs text-slate-800"
                  >
                    <Check size={14} className="text-emerald-600 shrink-0 mt-0.5 font-bold" />
                    <span className="leading-snug">{f}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Policy Exclusions List */}
          {plan.exclusions && plan.exclusions.length > 0 && (
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <X size={18} className="text-rose-600" />
                <span>Policy Exclusions &amp; Waiting Limitations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {plan.exclusions.map((e, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-rose-50/40 border border-rose-200/60 flex items-start gap-2.5 text-xs text-slate-700"
                  >
                    <X size={14} className="text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{e}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Sticky Pricing & Enrollment Hub */}
        <aside className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start flex flex-col gap-4">
          <section className="rounded-2xl border-2 border-sky-500/30 bg-white p-5 sm:p-6 shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                Indicative Premium
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                Direct E-Enroll
              </span>
            </div>

            {/* Price Display */}
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {formatLkr(premium)}
                </span>
                <span className="text-sm font-semibold text-slate-500">{cycleLabel}</span>
              </div>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {cycle === "annual" && plan.annualDiscountPct > 0
                  ? `Includes ${plan.annualDiscountPct.toFixed(0)}% annual billing discount`
                  : cycle === "monthly"
                    ? `Switch to annual to save ${plan.annualDiscountPct.toFixed(0)}%`
                    : "No hidden administrative fees"}
              </p>
            </div>

            {/* Billing Cycle Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                style={{
                  backgroundColor: cycle === "monthly" ? "#ffffff" : "transparent",
                  color: cycle === "monthly" ? "#0c4a6e" : "#64748b",
                  boxShadow: cycle === "monthly" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
                className="text-xs font-bold py-2 rounded-lg transition-all cursor-pointer text-center"
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setCycle("annual")}
                style={{
                  backgroundColor: cycle === "annual" ? "#ffffff" : "transparent",
                  color: cycle === "annual" ? "#0c4a6e" : "#64748b",
                  boxShadow: cycle === "annual" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
                className="text-xs font-bold py-2 rounded-lg transition-all cursor-pointer text-center"
              >
                Annual (Save {plan.annualDiscountPct.toFixed(0)}%)
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
              <Link
                href={`/patient/insurance/quote?planId=${plan.id}&cycle=${cycle}`}
                className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <span>Get Personalised Quote</span>
                <ChevronRight size={15} />
              </Link>

              <Link
                href={`/patient/insurance/enroll/${plan.id}?cycle=${cycle}`}
                className="w-full h-11 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Enrol Directly Online</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2 leading-relaxed">
              <Calculator size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <span>
                Premiums displayed are indicative. Final rates reflect your age, family member count, and pre-existing medical declaration.
              </span>
            </div>
          </section>

          {/* Insurer Profile Card */}
          {plan.providerSlug && (
            <Link
              href={`/patient/insurance/marketplace?provider=${plan.providerSlug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">
                    Underwriting Partner
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block group-hover:text-sky-700 transition-colors">
                    {plan.providerName}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-sky-600 transition-colors shrink-0" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function BenefitTile({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3 shadow-2xs">
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-500 font-medium leading-tight">
          {label}
        </div>
        <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 truncate">
          {value}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</div>
      </div>
    </div>
  );
}