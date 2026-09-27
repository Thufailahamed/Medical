"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Droplets,
  HeartPulse,
  Pill,
  Plus,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { VitalsTrend } from "@/patient/components/dashboard/VitalsTrend";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import {
  useHealthSummary,
  useVitalsAlerts,
  useWellness,
} from "@/patient/hooks";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import { cn } from "@/portal/lib/utils";

export default function HealthPage() {
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(7);
  const wellness = useWellness();

  const alertItems = alerts.data?.items ?? [];
  const alertCount = alerts.data?.count ?? alertItems.length;
  const wellnessScore = wellness.data?.score ?? 64;
  const activeMedsCount = summary.data?.activeMedicines?.length ?? 1;
  const bmiVal = summary.data?.demographics?.bmi != null
    ? Number(summary.data.demographics.bmi).toFixed(1)
    : "23.8";
  const bmiCategory = summary.data?.demographics?.bmiCategory ?? "Healthy";
  const bloodGroup = summary.data?.demographics?.bloodGroup ?? "B+";

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<HeartPulse size={13} />}
        kicker="Vitals Telemetry & Wellness"
        title="My Health & Biometrics"
        description="Consolidated clinical biometric dashboard. Track heart rate, oxygen saturation, blood pressure, active prescriptions, and risk alerts."
        actions={
          <>
            <Link href="/patient/vitals" className={heroSecondaryAction}>
              <Activity size={13} />
              <span>All Vitals History</span>
            </Link>
            <Link href="/patient/vitals" className={heroPrimaryAction}>
              <Plus size={14} />
              <span>Log Vitals Reading</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>Wellness {wellnessScore} · Good</span>
            <span>{alertCount === 0 ? "0 alerts · all clear" : `${alertCount} alerts active`}</span>
            <span>{activeMedsCount} active meds</span>
            <span>BMI {bmiVal} · {bmiCategory}</span>
          </>
        }
      />

      {/* ── 2. Interactive Snapshot Metric Tiles Strip ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/patient/health"
          className="patient-card p-4 hover:shadow-md hover:border-sky-300 transition-all flex items-center gap-3.5 group"
        >
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100 group-hover:scale-105 transition-transform">
            <HeartPulse size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-text-muted block truncate">
              Wellness Index
            </span>
            <span className="text-lg font-black text-text block tracking-tight">
              {wellnessScore}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 block truncate">
              {wellness.data?.level?.label ?? "Good Standing"}
            </span>
          </div>
        </Link>

        <Link
          href="/patient/vitals"
          className="patient-card p-4 hover:shadow-md hover:border-emerald-300 transition-all flex items-center gap-3.5 group"
        >
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border group-hover:scale-105 transition-transform",
              alertCount > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-100",
            )}
          >
            <Activity size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-text-muted block truncate">
              Vitals Alerts (7d)
            </span>
            <span className="text-lg font-black text-text block tracking-tight">
              {alertCount}
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold block truncate",
                alertCount > 0 ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {alertCount === 0 ? "All Clear" : "Attention Needed"}
            </span>
          </div>
        </Link>

        <Link
          href="/patient/medications"
          className="patient-card p-4 hover:shadow-md hover:border-rose-300 transition-all flex items-center gap-3.5 group"
        >
          <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 group-hover:scale-105 transition-transform">
            <Pill size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-text-muted block truncate">
              Active Meds
            </span>
            <span className="text-lg font-black text-text block tracking-tight">
              {activeMedsCount}
            </span>
            <span className="text-[11px] font-semibold text-text-soft block truncate">
              On Current Regimen
            </span>
          </div>
        </Link>

        <Link
          href="/patient/profile"
          className="patient-card p-4 hover:shadow-md hover:border-purple-300 transition-all flex items-center gap-3.5 group"
        >
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100 group-hover:scale-105 transition-transform">
            <Scale size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10.5px] uppercase font-bold text-text-muted block truncate">
              Body Mass (BMI)
            </span>
            <span className="text-lg font-black text-text block tracking-tight">
              {bmiVal}
            </span>
            <span className="text-[11px] font-semibold text-purple-600 block truncate">
              {bmiCategory}
            </span>
          </div>
        </Link>
      </div>

      {/* ── 3. Vitals Trend & Recent Alerts Grid ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <VitalsTrend />
        </div>

        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-xs flex flex-col h-full justify-between gap-4">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                    <AlertTriangle size={14} />
                  </div>
                  <div>
                    <h3 className="font-bold text-text text-sm">Recent Alerts</h3>
                    <p className="text-[10.5px] text-text-muted">Past 7 days monitoring</p>
                  </div>
                </div>

                <Link
                  href="/patient/vitals"
                  className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
                >
                  <span>All vitals</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              <QueryBoundary
                query={alerts}
                isEmpty={(d) => !(d?.items?.length ?? 0)}
                emptyTitle="No Vitals Alerts"
                emptyDescription="Your vitals readings are within clinically healthy target ranges."
                className="mt-4"
                emptyAction={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={13} />
                    <span>Looking Good · Normal Ranges</span>
                  </span>
                }
              >
                {(data) => (
                  <ul className="mt-3 flex flex-col gap-2">
                    {(data?.items ?? []).slice(0, 6).map((a, i) => (
                      <li
                        key={`${a.type}-${a.value}-${i}`}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3 border",
                          a.classification?.toLowerCase().includes("low") ||
                            a.classification?.toLowerCase().includes("critical")
                            ? "bg-rose-50 border-rose-200 text-rose-900"
                            : "bg-amber-50 border-amber-200 text-amber-900",
                        )}
                      >
                        <span
                          className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-rose-600"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-bold">
                            {VITAL_REGISTRY[a.type]?.label ?? a.type}: {a.value}{" "}
                            {VITAL_REGISTRY[a.type]?.unit ?? ""}
                          </p>
                          <p className="text-[11px] font-semibold opacity-80 mt-0.5">
                            {a.classification}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoundary>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-3 text-xs">
              <span className="text-text-soft font-medium">Automatic Wearable Sync</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Patient Clinical Demographics Snapshot ("About You") ─────────── */}
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
              <UserRound size={16} />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm sm:text-base">About You</h3>
              <p className="text-xs text-text-soft">Clinical biometric health profile</p>
            </div>
          </div>

          <Link
            href="/patient/profile"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors flex items-center gap-1"
          >
            <span>Edit Profile</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        <QueryBoundary
          query={summary}
          emptyTitle="No profile summary"
          emptyDescription="Information from your clinical intake will populate here."
        >
          {(data) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                  <UserRound size={12} className="text-text-soft" />
                  Full Name
                </span>
                <p className="text-xs sm:text-sm font-bold text-text truncate">
                  {data.demographics?.name ?? "Thufail"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted">
                  Age
                </span>
                <p className="text-xs sm:text-sm font-bold text-text">
                  {data.demographics?.age ? `${data.demographics.age} yrs` : "28 yrs"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted">
                  Biological Sex
                </span>
                <p className="text-xs sm:text-sm font-bold text-text capitalize">
                  {data.demographics?.sex ?? "Male"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                  <Droplets size={12} className="text-rose-600" />
                  Blood Group
                </span>
                <p className="text-xs sm:text-sm font-bold text-rose-700">
                  Type {bloodGroup}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                  <Scale size={12} className="text-sky-600" />
                  BMI Index
                </span>
                <p className="text-xs sm:text-sm font-bold text-text">
                  {bmiVal} <span className="text-[11px] font-semibold text-emerald-600">({bmiCategory})</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border-0 shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex flex-col gap-1">
                <span className="text-[10.5px] uppercase font-bold text-text-muted flex items-center gap-1">
                  <Pill size={12} className="text-rose-500" />
                  Active Meds
                </span>
                <p className="text-xs sm:text-sm font-bold text-text">
                  {activeMedsCount} Prescribed
                </p>
              </div>
            </div>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
}
