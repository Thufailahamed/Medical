"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Hospital,
  Info,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wallet,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface CoverageResult {
  coverage: {
    eligible: boolean;
    coveredAmountLkr: number;
    patientResponsibilityLkr: number;
    notes: string[];
    policyId?: string;
    planName?: string;
    providerName?: string;
    remainingAnnualLimitLkr?: number;
    waitingPeriods?: Array<{ condition: string; remainingDays: number }>;
    exclusions?: string[];
  };
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
  const [facility, setFacility] = useState("Asiri Surgical Hospital");
  const [diagnosis, setDiagnosis] = useState("Laparoscopic Appendectomy");
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

  useEffect(() => {
    if (activeEnrollments.length > 0 && !enrollmentId) {
      setEnrollmentId(activeEnrollments[0].id);
    }
  }, [activeEnrollments, enrollmentId]);

  const checkMut = useMutation({
    mutationFn: () =>
      api<CoverageResult>("/insurance-marketplace/coverage-check", {
        method: "POST",
        json: {
          enrollmentId: enrollmentId || undefined,
          treatmentType,
          incurringFacility: facility.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          estimatedCostLkr: Number(estimatedCost) || undefined,
        },
      }),
  });

  const runCheck = (e: React.FormEvent) => {
    e.preventDefault();
    checkMut.mutate();
  };

  const result = checkMut.data?.coverage;
  const costNum = Number(estimatedCost) || 0;

  return (
    <div className="flex flex-col gap-6 pb-16 max-w-4xl mx-auto">
      {/* ── 1. Back Link ───────────────────────────────────────────────────── */}
      <Link
        href="/patient/insurance"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-700 transition-colors self-start"
      >
        <ArrowLeft size={14} />
        <span>Back to Insurance Hub</span>
      </Link>

      {/* ── 2. Oceanic Signature Hero Header ───────────────────────────────── */}
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
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Calculator size={12} className="text-sky-300" />
                Pre-Treatment Estimator
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Treatment Coverage &amp; Cost Check
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Estimate what your insurance covers before surgery, hospital admission, or clinical procedures. Avoid unexpected out-of-pocket costs.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <ShieldCheck size={14} className="text-sky-700" />
                <span>Explore Plans</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Cashless Network
                </p>
                <p className="text-base font-extrabold text-white">100+ Hospitals</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Coins size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Co-Pay Estimator
                </p>
                <p className="text-base font-extrabold text-white">Real-Time Split</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <FileCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Pre-Approval
                </p>
                <p className="text-base font-extrabold text-white">Instant Status</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Claim Speed
                </p>
                <p className="text-base font-extrabold text-white">Direct Settle</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 3. Estimator Form Card ─────────────────────────────────────────── */}
      <form
        onSubmit={runCheck}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Procedure &amp; Hospital Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in your upcoming medical event to calculate your insurance payout.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Cashless Check
          </span>
        </div>

        {/* 1. Policy Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Select Active Health Policy
          </label>

          {enrollmentsQ.isLoading ? (
            <div className="h-14 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
          ) : activeEnrollments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeEnrollments.map((e) => {
                const isSelected = enrollmentId === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEnrollmentId(e.id)}
                    className={cn(
                      "text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer",
                      isSelected
                        ? "bg-sky-50 border-sky-300 ring-2 ring-sky-500/20 shadow-xs"
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70",
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        isSelected
                          ? "bg-sky-600 text-white"
                          : "bg-slate-200 text-slate-600",
                      )}
                    >
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {e.planName || "Comprehensive Health Plan"}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {e.providerName} · {e.policyNumber ?? `Policy #${e.id.slice(0, 8)}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    No active policy detected on your account
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    You can still run an estimation with standard insurer rates, or enroll in a policy now.
                  </p>
                </div>
              </div>
              <Link
                href="/patient/insurance/marketplace"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-200 text-amber-950 hover:bg-amber-300 transition-colors shrink-0"
              >
                Browse Plans
              </Link>
            </div>
          )}
        </div>

        {/* 2. Treatment Type Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Treatment Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TREATMENTS.map((t) => {
              const Icon = t.icon;
              const isSelected = treatmentType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTreatmentType(t.value)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                    isSelected
                      ? "bg-sky-50 border-sky-300 text-sky-900 ring-2 ring-sky-500/20 shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100/70",
                  )}
                >
                  <Icon
                    size={15}
                    className={isSelected ? "text-sky-600" : "text-slate-400"}
                  />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Hospital / Facility Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 size={13} className="text-sky-600" />
            Hospital or Clinical Facility
          </label>
          <input
            type="text"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="e.g. Asiri Surgical Hospital, Lanka Hospitals, Nawaloka..."
            className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            required
          />
        </div>

        {/* 4. Diagnosis / Procedure Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Stethoscope size={13} className="text-sky-600" />
            Diagnosis or Planned Surgical Procedure
          </label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Laparoscopic Appendectomy, Total Knee Replacement, Maternity Delivery..."
            className="w-full h-11 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            required
          />
        </div>

        {/* 5. Estimated Total Cost Input & Preset Chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Receipt size={13} className="text-sky-600" />
              Estimated Medical Hospital Bill (LKR)
            </label>
            <span className="text-xs font-bold text-sky-800">
              {formatLkr(costNum)}
            </span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              LKR
            </span>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="250000"
              className="w-full h-11 pl-12 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              required
            />
          </div>

          {/* Preset cost buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">
              Quick Presets:
            </span>
            {COST_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setEstimatedCost(String(amount))}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  Number(estimatedCost) === amount
                    ? "bg-sky-600 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {formatLkr(amount)}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Info size={13} />
            Calculations reflect official insurer underwriting guidelines
          </span>

          <button
            type="submit"
            disabled={checkMut.isPending || !estimatedCost}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
            style={{
              background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            }}
          >
            {checkMut.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Underwriting Assessment…</span>
              </>
            ) : (
              <>
                <Calculator size={14} />
                <span>Calculate My Coverage</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── 4. Calculation Error State ─────────────────────────────────────── */}
      {checkMut.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-900">Coverage check request failed</p>
            <p className="mt-0.5">
              {checkMut.error instanceof Error
                ? checkMut.error.message
                : "Unable to verify policy rates. Please verify your hospital and procedure details."}
            </p>
          </div>
        </div>
      ) : null}

      {/* ── 5. Rich Coverage Results Breakdown ─────────────────────────────── */}
      {result ? (
        <section className="flex flex-col gap-4 animate-in fade-in duration-300">
          {/* Eligibility Banner */}
          <div
            className={cn(
              "rounded-2xl border p-5 flex items-start gap-4 shadow-xs",
              result.eligible
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-white"
                : "border-amber-200 bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-white",
            )}
          >
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs",
                result.eligible
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              {result.eligible ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={cn(
                    "text-lg font-black",
                    result.eligible ? "text-emerald-950" : "text-amber-950",
                  )}
                >
                  {result.eligible
                    ? "Procedure is Eligible for Coverage"
                    : "Limited or Conditional Coverage"}
                </h3>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                    result.eligible
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-amber-100 text-amber-800 border-amber-300",
                  )}
                >
                  {result.eligible ? "Cashless Approved" : "Review Exclusions"}
                </span>
              </div>

              <p
                className={cn(
                  "text-xs font-medium mt-1 leading-relaxed",
                  result.eligible ? "text-emerald-800" : "text-amber-800",
                )}
              >
                {result.planName ? `${result.planName} · ` : ""}
                {result.providerName ?? "Certified Underwriter"}
                {" · "}Hospital: <span className="font-bold">{facility}</span>
                {" · "}Procedure: <span className="font-bold">{diagnosis}</span>
              </p>
            </div>
          </div>

          {/* Split Tiles (Insurer Pays vs Patient Responsibility) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Insurer Responsibility */}
            <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Covered by Insurer
                  </span>
                  <span className="bg-emerald-50 px-2 py-0.5 rounded-full">
                    {costNum > 0
                      ? `${Math.round((result.coveredAmountLkr / costNum) * 100)}% Covered`
                      : "Direct Payout"}
                  </span>
                </div>
                <div className="text-3xl font-black text-emerald-800 mt-2">
                  {formatLkr(result.coveredAmountLkr)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Direct cashless settlement submitted to {facility}.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>Zero hospital deposit required</span>
              </div>
            </div>

            {/* Patient Responsibility */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Wallet size={14} className="text-sky-600" />
                    Your Out-of-Pocket
                  </span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">
                    Co-Pay / Deductible
                  </span>
                </div>
                <div className="text-3xl font-black text-slate-900 mt-2">
                  {formatLkr(result.patientResponsibilityLkr)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Remaining balance payable at hospital discharge.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <Coins size={12} className="text-amber-500" />
                <span>Payable via HealthHub Wallet or card</span>
              </div>
            </div>
          </div>

          {/* Remaining Limit Progress Bar */}
          {result.remainingAnnualLimitLkr != null ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity size={14} className="text-sky-600" />
                  Remaining Annual Policy Limit
                </span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {formatLkr(result.remainingAnnualLimitLkr)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        15,
                        (result.coveredAmountLkr /
                          (result.remainingAnnualLimitLkr + result.coveredAmountLkr)) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                After this claim, you will have approximately{" "}
                {formatLkr(
                  Math.max(0, result.remainingAnnualLimitLkr - result.coveredAmountLkr),
                )}{" "}
                in remaining coverage for this policy cycle.
              </p>
            </div>
          ) : null}

          {/* Waiting Periods Check */}
          {result.waitingPeriods && result.waitingPeriods.length > 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600" />
                Waiting Periods &amp; Pre-Existing Condition Clauses
              </h4>
              <div className="flex flex-col gap-2">
                {result.waitingPeriods.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs font-medium"
                  >
                    <span className="text-slate-800 font-bold capitalize">
                      {w.condition.replace(/_/g, " ")}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                        w.remainingDays > 0
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200",
                      )}
                    >
                      {w.remainingDays > 0
                        ? `${w.remainingDays} days remaining`
                        : "Waiting Period Cleared"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Exclusions Notice */}
          {result.exclusions && result.exclusions.length > 0 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs flex flex-col gap-2 text-xs">
              <span className="font-bold text-rose-900 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-rose-600" />
                Specific Policy Exclusions Apply
              </span>
              <ul className="space-y-1 text-rose-800 list-disc list-inside">
                {result.exclusions.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Underwriter Notes */}
          {result.notes && result.notes.length > 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs text-xs text-slate-600 flex flex-col gap-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText size={13} className="text-sky-600" />
                Underwriting &amp; Pre-Authorization Notes
              </span>
              <ul className="space-y-1 text-slate-500 list-disc list-inside">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}