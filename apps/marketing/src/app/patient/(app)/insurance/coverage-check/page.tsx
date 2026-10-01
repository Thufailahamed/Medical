"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  FileCheck,
  Hospital,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
} from "@/patient/components/workspace";

interface CoverageResult {
  enrolled: boolean;
  planName: string | null;
  coverageType: string | null;
  covered: boolean;
  copayPct: number;
  estimatedOutOfPocketLkr: number;
  deductibleLkr: number;
  notes: string[];
  providerName?: string | null;
  remainingAnnualLimitLkr?: number | null;
  waitingPeriods?: Array<{ condition: string; remainingDays: number }>;
  exclusions?: string[];
}

const TREATMENTS = [
  { value: "hospitalization", label: "Hospitalization", icon: Hospital },
  { value: "day_care", label: "Day Care Surgery", icon: Clock },
  { value: "opd", label: "Outpatient (OPD)", icon: Stethoscope },
  { value: "diagnostic", label: "Diagnostic Scans", icon: Activity },
  { value: "dental", label: "Dental Care", icon: FileCheck },
  { value: "maternity", label: "Maternity", icon: Sparkles },
] as const;

const COST_PRESETS = [50000, 100000, 250000, 500000, 1000000];

export default function CoverageCheckPage() {
  const [enrollmentId, setEnrollmentId] = useState("");
  const [treatmentType, setTreatmentType] = useState("hospitalization");
  const [facility, setFacility] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("250000");

  const enrollmentsQ = useQuery({
    queryKey: ["insurance-marketplace", "enrollments", "me"],
    queryFn: () =>
      api<{
        enrollments: Array<{
          id: string;
          policyNumber: string | null;
          status: string;
          planName?: string;
          providerName?: string;
        }>;
      }>("/insurance-marketplace/enrollments/me"),
  });

  const activeEnrollments =
    enrollmentsQ.data?.enrollments?.filter((e) => e.status === "active") ?? [];

  const effectiveEnrollmentId = enrollmentId || activeEnrollments[0]?.id || "";

  const checkMut = useMutation({
    mutationFn: () =>
      api<CoverageResult>("/insurance-marketplace/coverage-check", {
        method: "POST",
        json: {
          enrollmentId: effectiveEnrollmentId,
          treatmentType,
          estimatedAmountLkr: Number(estimatedCost) || 0,
          hospitalName: facility.trim() || undefined,
        },
      }),
  });

  const runCheck = (e: React.FormEvent) => {
    e.preventDefault();
    checkMut.mutate();
  };

  const result = checkMut.data;
  const costNum = Number(estimatedCost) || 0;
  const isEligible = !!result && result.enrolled && result.covered;
  const coveredAmount = result ? Math.max(0, costNum - result.estimatedOutOfPocketLkr) : 0;
  const patientOop = result?.estimatedOutOfPocketLkr ?? 0;

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Insurance hub
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<Activity size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Eligibility check"
        title={
          <>
            Check my <HeroAccent>coverage</HeroAccent>
          </>
        }
        description="Verify what your policy covers — treatments, procedures, and cashless eligibility — before you book."
        chips={
          <>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              {activeEnrollments.length} active {activeEnrollments.length === 1 ? "policy" : "policies"}
            </span>
            <span className={HERO_CHIP}>Instant payer lookup</span>
            <span className={HERO_CHIP}>Cashless eligibility</span>
          </>
        }
        actions={
          <Link href="/patient/insurance/claims" className={HERO_GHOST}>
            <Receipt size={13} /> My claims
          </Link>
        }
      />

      {enrollmentsQ.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      ) : activeEnrollments.length === 0 ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<ShieldAlert size={19} />}
            title="No active policy"
            body="Coverage checks need an active policy. Enrol on the marketplace first — it takes minutes."
            actions={
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                Browse plans <ArrowRight size={13} />
              </Link>
            }
          />
        </section>
      ) : (
        <form onSubmit={runCheck}>
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-7">
              <section className={PANEL}>
                <PanelHeader
                  icon={<ShieldCheck size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Policy"
                  caption="Which policy should we check?"
                />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {activeEnrollments.map((e) => {
                    const active = e.id === effectiveEnrollmentId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEnrollmentId(e.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                          active
                            ? "border-sky-500 bg-sky-50/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
                            : "border-slate-100 bg-white hover:border-slate-200",
                        )}
                      >
                        <div
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                            active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          <ShieldCheck size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {e.planName ?? e.policyNumber ?? "Policy"}
                          </div>
                          <div className="truncate text-[11px] text-slate-400">
                            {e.providerName}
                          </div>
                        </div>
                        {active ? <CheckCircle2 size={16} className="shrink-0 text-sky-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<Stethoscope size={16} />}
                  tone="bg-violet-50 text-violet-600"
                  title="Treatment"
                  caption="What kind of care are you planning?"
                />
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TREATMENTS.map((t) => {
                    const active = treatmentType === t.value;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTreatmentType(t.value)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                          active
                            ? "border-sky-500 bg-sky-50/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
                            : "border-slate-100 bg-white hover:border-slate-200",
                        )}
                      >
                        <div
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-lg",
                            active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          <Icon size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<Calculator size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Estimate"
                  caption="Facility, procedure and expected bill size."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={FIELD_LABEL}>Facility / hospital</label>
                    <input
                      className={FIELD_INPUT}
                      value={facility}
                      onChange={(e) => setFacility(e.target.value)}
                      placeholder="e.g. Asiri Surgical Hospital"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Diagnosis / procedure</label>
                    <input
                      className={FIELD_INPUT}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Laparoscopic appendectomy"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Estimated cost (LKR)</label>
                    <input
                      type="number"
                      min={0}
                      className={FIELD_INPUT}
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      placeholder="250000"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COST_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEstimatedCost(String(preset))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                            costNum === preset
                              ? "border-sky-500 bg-sky-50 text-sky-700"
                              : "border-slate-200 text-slate-500 hover:border-slate-300",
                          )}
                        >
                          {formatLkr(preset)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={checkMut.isPending || !effectiveEnrollmentId}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-6 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {checkMut.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Checking…
                      </>
                    ) : (
                      <>
                        Check coverage <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
                {checkMut.isError ? (
                  <p className="mt-2 text-xs font-semibold text-rose-600">
                    Could not complete the check. Please retry.
                  </p>
                ) : null}
              </section>
            </div>

            <aside className="flex flex-col gap-5 xl:col-span-5">
              {result ? (
                <section
                  className={cn(
                    PANEL,
                    isEligible
                      ? "border-2 border-emerald-200"
                      : "border-2 border-rose-200",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                        isEligible
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-rose-100 text-rose-600",
                      )}
                    >
                      {isEligible ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 sm:text-base">
                        {isEligible ? "Covered by your plan" : "Not covered"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {result.planName ?? "Policy"}
                        {result.providerName ? ` · ${result.providerName}` : ""}
                        {result.coverageType ? ` · ${result.coverageType}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Insurer pays
                      </div>
                      <div className="mt-1 text-lg font-bold text-emerald-700">
                        {formatLkr(coveredAmount)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        You pay (est.)
                      </div>
                      <div className="mt-1 text-lg font-bold text-slate-900">
                        {formatLkr(patientOop)}
                      </div>
                    </div>
                  </div>

                  {costNum > 0 ? (
                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>Coverage share</span>
                        <span>
                          {Math.round((coveredAmount / costNum) * 100)}% of {formatLkr(costNum)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{
                            width: `${Math.min(100, Math.max(0, (coveredAmount / costNum) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Co-pay</span>
                      <span className="font-medium text-slate-900">{result.copayPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Deductible</span>
                      <span className="font-medium text-slate-900">
                        {result.deductibleLkr > 0 ? formatLkr(result.deductibleLkr) : "None"}
                      </span>
                    </div>
                    {result.remainingAnnualLimitLkr != null ? (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Remaining annual limit</span>
                        <span className="font-medium text-slate-900">
                          {formatLkr(result.remainingAnnualLimitLkr)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {result.notes?.length ? (
                    <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                      {result.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {result.waitingPeriods && result.waitingPeriods.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <Clock size={13} /> Waiting periods apply
                      </div>
                      <ul className="mt-2 space-y-1">
                        {result.waitingPeriods.map((w, i) => (
                          <li key={i} className="flex justify-between text-xs text-amber-800">
                            <span className="capitalize">{w.condition.replace(/_/g, " ")}</span>
                            <span className="font-semibold">{w.remainingDays}d left</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.exclusions && result.exclusions.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                        <AlertTriangle size={13} /> Related exclusions
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-rose-800">
                        {result.exclusions.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {isEligible ? (
                    <Link
                      href="/patient/insurance/claims/new"
                      className="mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-500"
                    >
                      File a claim <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </section>
              ) : (
                <section className={PANEL}>
                  <PanelHeader
                    icon={<Wallet size={16} />}
                    tone="bg-sky-50 text-sky-600"
                    title="Coverage verdict"
                    caption="Run a check to see the breakdown."
                  />
                  <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                    <Calculator size={22} className="text-slate-300" />
                    <p className="mt-2.5 text-xs font-semibold text-slate-500">
                      Pick a policy and treatment, then check coverage
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      You&apos;ll see the insurer&apos;s share, your co-pay, waiting
                      periods and exclusions.
                    </p>
                  </div>
                </section>
              )}

              <PromoCard
                icon={<Receipt size={21} aria-hidden />}
                kicker="Out of pocket?"
                title="Claim it back"
                body="Paid cash for covered care? File a reimbursement claim — settled straight to your bank."
                href="/patient/insurance/claims/new"
              />

              <QuickToolsPanel
                id="cov-tools"
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
                    icon: Receipt,
                    label: "Claims",
                    hint: "File & track",
                    href: "/patient/insurance/claims",
                    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
                  },
                  {
                    icon: Hospital,
                    label: "Marketplace",
                    hint: "All plans",
                    href: "/patient/insurance/marketplace",
                    tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
                  },
                ]}
              />
            </aside>
          </div>
        </form>
      )}
    </PatientPage>
  );
}
