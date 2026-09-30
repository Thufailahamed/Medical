"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  HeartPulse,
  Hospital,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroTile,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  StatTile,
  Segmented,
} from "@/patient/components/workspace";

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
      <PatientPage>
        <div className="h-44 animate-pulse rounded-[20px] bg-slate-100" />
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100 lg:col-span-8" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100 lg:col-span-4" />
        </div>
      </PatientPage>
    );
  }

  if (!data?.plan) {
    return (
      <PatientPage>
        <section className={PANEL}>
          <EmptyBlock
            icon={<Building2 size={19} />}
            title="Insurance plan not found"
            body="The requested policy may have expired or is no longer listed in the marketplace."
            actions={
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                <ChevronLeft size={14} /> Back to marketplace
              </Link>
            }
          />
        </section>
      </PatientPage>
    );
  }

  const plan = data.plan;
  const premium =
    cycle === "monthly" ? plan.monthlyPremiumLkr : plan.annualPremiumLkr;
  const cycleLabel = cycle === "monthly" ? "/month" : "/year";
  const planImage = PLAN_TYPE_IMAGE[plan.planType];

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<Building2 size={13} aria-hidden />}
        kicker="Insurance marketplace"
        kickerMeta={plan.providerName ?? "Accredited insurer"}
        leading={
          planImage ? (
            <span className="relative block h-[76px] w-[76px] overflow-hidden rounded-[20px] ring-1 ring-inset ring-white/25">
              <Image src={planImage} alt={plan.name} fill sizes="76px" className="object-cover" />
            </span>
          ) : (
            <HeroTile>
              <Building2 size={30} />
            </HeroTile>
          )
        }
        title={
          <>
            {plan.name.split(" ")[0]}{" "}
            <HeroAccent>{plan.name.split(" ").slice(1).join(" ") || "Plan"}</HeroAccent>
          </>
        }
        description={`Comprehensive ${TYPE_LABEL[plan.planType] ?? "health"} plan offering up to ${formatLkr(plan.coverageSummaryLkr)} in cashless hospital benefits across ${plan.networkHospitalCount}+ accredited medical centers.`}
        chips={
          <>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              {formatLkr(plan.coverageSummaryLkr)} cover
            </span>
            <span className={HERO_CHIP}>
              <HeartPulse size={12} className="text-rose-300" />
              {plan.copayPct}% co-pay
            </span>
            <span className={HERO_CHIP}>
              <Hospital size={12} className="text-amber-300" />
              {plan.networkHospitalCount}+ hospitals
            </span>
            {plan.isFeatured ? <span className={HERO_CHIP}>Featured plan</span> : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/insurance/marketplace" className={HERO_GHOST}>
              <ChevronLeft size={13} /> Marketplace
            </Link>
            <Link
              href={`/patient/insurance/quote?planId=${plan.id}&cycle=${cycle}`}
              className={HERO_PRIMARY}
            >
              <Zap size={14} className="text-sky-600" /> Get quote
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Sum insured"
          value={formatLkr(plan.coverageSummaryLkr)}
          sub="Annual hospitalization limit"
        />
        <StatTile
          icon={<HeartPulse size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Co-payment"
          value={`${plan.copayPct}%`}
          sub={plan.copayPct === 0 ? "Zero co-pay" : "Per approved claim"}
        />
        <StatTile
          icon={<Hospital size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Cashless network"
          value={`${plan.networkHospitalCount}+`}
          sub="Direct billing hospitals"
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Policy term"
          value={`${plan.termMonths} mo`}
          sub={`Waiting ${plan.waitingPeriodDays}d · pre-existing ${plan.preExistingWaitingDays}d`}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Coverage & policy benefits"
              caption="Core financial limits, deductibles, waiting windows, and inpatient terms."
              action={
                <Badge tone="emerald" className="hidden sm:inline-flex">
                  Cashless verified
                </Badge>
              }
            />
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <BenefitTile icon={<ShieldCheck size={16} />} tile="bg-emerald-50 text-emerald-600" label="Max annual cover" value={formatLkr(plan.coverageSummaryLkr)} sub="Hospitalization limit" />
              <BenefitTile icon={<HeartPulse size={16} />} tile="bg-rose-50 text-rose-600" label="Patient co-pay" value={`${plan.copayPct}%`} sub={plan.copayPct === 0 ? "Zero co-pay required" : "Per approved claim"} />
              <BenefitTile icon={<Wallet size={16} />} tile="bg-amber-50 text-amber-600" label="Deductible" value={plan.deductibleLkr > 0 ? formatLkr(plan.deductibleLkr) : "None"} sub="Paid before cover activates" />
              <BenefitTile icon={<Wallet size={16} />} tile="bg-sky-50 text-sky-600" label="Co-pay cap" value={plan.coPaymentCapLkr > 0 ? formatLkr(plan.coPaymentCapLkr) : "Unlimited"} sub="Max out-of-pocket ceiling" />
              <BenefitTile icon={<Clock size={16} />} tile="bg-violet-50 text-violet-600" label="Waiting period" value={`${plan.waitingPeriodDays} days`} sub="Accidents covered immediately" />
              <BenefitTile icon={<Clock size={16} />} tile="bg-indigo-50 text-indigo-600" label="Pre-existing wait" value={`${plan.preExistingWaitingDays} days`} sub="Prior medical history term" />
              <BenefitTile icon={<Hospital size={16} />} tile="bg-teal-50 text-teal-600" label="Network hospitals" value={`${plan.networkHospitalCount}+`} sub="Cashless direct billing" />
              <BenefitTile icon={<Zap size={16} />} tile="bg-amber-50 text-amber-600" label="Claim SLA" value="Fast e-discharge" sub="Under 45 min on admission" />
              <BenefitTile icon={<BadgeCheck size={16} />} tile="bg-emerald-50 text-emerald-600" label="Certification" value="IRCSL approved" sub="Licensed Sri Lanka provider" />
            </div>
          </section>

          {plan.keyFeatures && plan.keyFeatures.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<CheckCircle2 size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="What's included"
                caption="Key plan highlights."
              />
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {plan.keyFeatures.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-slate-700"
                  >
                    <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span className="leading-snug">{f}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {plan.exclusions && plan.exclusions.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<X size={16} />}
                tone="bg-rose-50 text-rose-600"
                title="Exclusions & waiting limitations"
                caption="Conditions not covered by this policy."
              />
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {plan.exclusions.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs text-slate-700"
                  >
                    <X size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <span className="leading-snug">{e}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={cn(PANEL, "border-2 border-sky-100")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Indicative premium
              </span>
              <Badge tone="sky">Direct e-enroll</Badge>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  {formatLkr(premium)}
                </span>
                <span className="text-sm font-semibold text-slate-500">{cycleLabel}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-emerald-600">
                {cycle === "annual" && plan.annualDiscountPct > 0
                  ? `Includes ${plan.annualDiscountPct.toFixed(0)}% annual billing discount`
                  : cycle === "monthly"
                    ? `Switch to annual to save ${plan.annualDiscountPct.toFixed(0)}%`
                    : "No hidden administrative fees"}
              </p>
            </div>

            <div className="mt-4">
              <Segmented
                ariaLabel="Billing cycle"
                options={[
                  { value: "monthly", label: "Monthly" },
                  {
                    value: "annual",
                    label: `Annual${plan.annualDiscountPct > 0 ? ` −${plan.annualDiscountPct.toFixed(0)}%` : ""}`,
                  },
                ]}
                value={cycle}
                onChange={(v) => setCycle(v as "monthly" | "annual")}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href={`/patient/insurance/quote?planId=${plan.id}&cycle=${cycle}`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 sm:text-sm"
              >
                Get personalised quote <ArrowRight size={15} />
              </Link>
              <Link
                href={`/patient/insurance/enroll/${plan.id}?cycle=${cycle}`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200 sm:text-sm"
              >
                Enrol directly online <ArrowRight size={14} />
              </Link>
            </div>

            <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
              <BadgeCheck size={13} className="mt-0.5 shrink-0 text-slate-400" />
              Premiums are indicative — final rates reflect age, members, and disclosed conditions.
            </p>
          </section>

          {plan.providerSlug ? (
            <Link
              href={`/patient/insurance/marketplace/${plan.providerSlug}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-slate-200 hover:shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10.5px] font-bold uppercase text-slate-400">
                    Underwriting partner
                  </span>
                  <span className="block truncate text-xs font-bold text-slate-900 group-hover:text-sky-700 sm:text-sm">
                    {plan.providerName}
                  </span>
                </div>
              </div>
              <ChevronLeft size={16} className="rotate-180 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
            </Link>
          ) : null}

          <PromoCard
            icon={<Sparkles size={21} aria-hidden />}
            kicker="Claim-ready"
            title="Instant cashless admission"
            body="Present your e-card at any network hospital — the insurer settles directly, no upfront payment."
            href="/patient/insurance"
          />
        </aside>
      </div>
    </PatientPage>
  );
}

function BenefitTile({
  icon,
  tile,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tile: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tile)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium leading-tight text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-xs font-bold text-slate-900 sm:text-sm">{value}</div>
        <div className="mt-0.5 truncate text-[10px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}
