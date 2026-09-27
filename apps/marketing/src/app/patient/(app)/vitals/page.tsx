"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Heart,
  HeartPulse,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Wind,
} from "lucide-react";

import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { AddVitalSheet } from "@/patient/components/vitals/AddVitalSheet";
import { AddSymptomSheet } from "@/patient/components/vitals/AddSymptomSheet";
import { Sparkline } from "@/patient/components/charts/Sparkline";
import {
  useAddSymptom,
  useAddVital,
  useDeleteSymptom,
  useSymptoms,
  useVitalsAlerts,
  useVitalsSeries,
} from "@/patient/hooks";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import type { VitalAlert, VitalType } from "@/patient/types/patient";
import { cn } from "@/portal/lib/utils";

export default function VitalsPage() {
  const series = useVitalsSeries("heart_rate", "week");
  const bpSeries = useVitalsSeries("blood_pressure", "week");
  const spo2Series = useVitalsSeries("spo2", "week");
  const alerts = useVitalsAlerts(30);
  const symptoms = useSymptoms();

  const addVital = useAddVital();
  const addSymptom = useAddSymptom();
  const deleteSymptom = useDeleteSymptom();

  const [vitalSheetOpen, setVitalSheetOpen] = useState(false);
  const [initialVitalType, setInitialVitalType] = useState<VitalType>("heart_rate");
  const [symptomSheetOpen, setSymptomSheetOpen] = useState(false);

  const alertItems = alerts.data?.items ?? [];
  const symptomsList = symptoms.data?.symptoms ?? [];

  // Parse latest values
  const hrPoints = series.data?.points ?? [];
  const lastHr = hrPoints.length > 0 ? hrPoints[hrPoints.length - 1].value : null;

  const bpPoints = bpSeries.data?.points ?? [];
  const lastBpSys = bpPoints.length > 0 ? bpPoints[bpPoints.length - 1].value : null;
  const lastBpDia = bpPoints.length > 0 ? (bpPoints[bpPoints.length - 1] as any).secondaryValue : null;

  const spo2Points = spo2Series.data?.points ?? [];
  const lastSpo2 = spo2Points.length > 0 ? spo2Points[spo2Points.length - 1].value : null;

  const openAddVital = (type: VitalType) => {
    setInitialVitalType(type);
    setVitalSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<HeartPulse size={13} />}
        kicker="Biometric Telemetry & Vitals"
        title="Clinical Vitals & Symptoms"
        description="Log and monitor heart rate, blood pressure, SpO2 oxygenation, and record daily symptoms for your care team."
        actions={
          <>
            <button
              type="button"
              onClick={() => setSymptomSheetOpen(true)}
              className={heroSecondaryAction}
            >
              <Plus size={13} />
              <span>Log Symptom</span>
            </button>
            <button
              type="button"
              onClick={() => openAddVital("heart_rate")}
              className={heroPrimaryAction}
            >
              <Plus size={14} />
              <span>Add Vitals Reading</span>
            </button>
          </>
        }
        footer={
          <>
            <span>
              Heart rate {lastHr != null ? `${Math.round(lastHr)} BPM` : "target 60–100"}
            </span>
            <span>
              BP {lastBpSys != null ? `${Math.round(lastBpSys)}/${lastBpDia ? Math.round(lastBpDia) : "--"}` : "target <120/80"}
            </span>
            <span>
              SpO2 {lastSpo2 != null ? `${Math.round(lastSpo2)}%` : "target 95–100%"}
            </span>
            <span>
              {alertItems.length === 0 ? "0 alerts · stable" : `${alertItems.length} alerts`}
            </span>
          </>
        }
      />

      {/* ── 2. Primary Biometrics Cards Grid ───────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Heart Rate Card */}
        <article className="patient-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-danger-soft text-danger shrink-0 shadow-2xs" aria-hidden>
                <Heart size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text text-sm">Heart Rate</h3>
                <span className="text-[11px] font-semibold text-text-muted">
                  Target: 60 - 100 bpm
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAddVital("heart_rate")}
              className="pt-btn pt-btn-secondary h-7 px-2.5 text-[11px]"
            >
              <Plus size={11} aria-hidden />
              Record
            </button>
          </div>

          <div className="flex items-baseline justify-between pt-2 border-t border-border">
            <div>
              <span className="pt-metric text-3xl text-text">
                {lastHr != null ? Math.round(lastHr) : "—"}
              </span>
              <span className="ml-1.5 text-xs font-semibold text-text-muted">BPM</span>
            </div>

            <div className="w-24 h-9 flex items-center justify-end">
              {hrPoints.length > 1 ? (
                <Sparkline data={hrPoints.map((p) => p.value)} />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success-soft px-2 py-0.5 rounded-md">
                  Normal Range
                </span>
              )}
            </div>
          </div>
        </article>

        {/* Blood Pressure Card */}
        <article className="patient-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-brand shrink-0 shadow-2xs" aria-hidden>
                <Stethoscope size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text text-sm">Blood Pressure</h3>
                <span className="text-[11px] font-semibold text-text-muted">
                  Target: &lt; 120/80 mmHg
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAddVital("blood_pressure")}
              className="pt-btn pt-btn-secondary h-7 px-2.5 text-[11px]"
            >
              <Plus size={11} aria-hidden />
              Record
            </button>
          </div>

          <div className="flex items-baseline justify-between pt-2 border-t border-border">
            <div>
              <span className="pt-metric text-3xl text-text">
                {lastBpSys != null ? Math.round(lastBpSys) : "—"}
                <span className="text-xl font-bold text-text-muted">
                  /{lastBpDia ? Math.round(lastBpDia) : "—"}
                </span>
              </span>
              <span className="ml-1.5 text-xs font-semibold text-text-muted">mmHg</span>
            </div>

            <div className="w-24 h-9 flex items-center justify-end">
              {bpPoints.length > 1 ? (
                <Sparkline data={bpPoints.map((p) => p.value)} />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success-soft px-2 py-0.5 rounded-md">
                  Optimal
                </span>
              )}
            </div>
          </div>
        </article>

        {/* Oxygen Saturation Card */}
        <article className="patient-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-violet-50 text-violet-600 shrink-0 shadow-2xs" aria-hidden>
                <Wind size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text text-sm">Oxygen Saturation</h3>
                <span className="text-[11px] font-semibold text-text-muted">
                  Target: 95% - 100%
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAddVital("spo2")}
              className="pt-btn pt-btn-secondary h-7 px-2.5 text-[11px]"
            >
              <Plus size={11} aria-hidden />
              Record
            </button>
          </div>

          <div className="flex items-baseline justify-between pt-2 border-t border-border">
            <div>
              <span className="pt-metric text-3xl text-text">
                {lastSpo2 != null ? Math.round(lastSpo2) : "—"}
              </span>
              <span className="ml-1.5 text-xs font-semibold text-text-muted">% SpO2</span>
            </div>

            <div className="w-24 h-9 flex items-center justify-end">
              {spo2Points.length > 1 ? (
                <Sparkline data={spo2Points.map((p) => p.value)} />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success-soft px-2 py-0.5 rounded-md">
                  Good Oxygen
                </span>
              )}
            </div>
          </div>
        </article>
      </section>

      {/* ── 3. Clinical Alerts Monitor (Last 30 Days) ────────────────────────── */}
      <section className="patient-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-warn-soft text-warn" aria-hidden>
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm sm:text-base">
                Clinical Threshold Alerts (Past 30 Days)
              </h3>
              <p className="text-xs text-text-soft">
                Automatic safety detection for blood pressure spikes or bradycardia
              </p>
            </div>
          </div>

          <span
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider",
              alertItems.length === 0
                ? "bg-success-soft text-success"
                : "bg-warn-soft text-warn",
            )}
          >
            {alertItems.length === 0 ? "0 Alerts · Stable" : `${alertItems.length} Warnings`}
          </span>
        </div>

        {alerts.isLoading ? (
          <div className="h-16 rounded-xl patient-shimmer" />
        ) : alertItems.length === 0 ? (
          <div className="p-6 rounded-xl bg-success-soft/40 border border-success/25 flex items-start gap-3 text-success">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" aria-hidden />
            <div>
              <h4 className="font-bold text-xs sm:text-sm">
                All Vitals Within Target Reference Range
              </h4>
              <p className="text-xs mt-0.5 leading-relaxed opacity-80">
                No out-of-range systolic excursions, bradycardia, or hypoxia events were recorded in your 30-day telemetry log.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {alertItems.map((a, idx) => (
              <div
                key={`${a.type}-${a.recordedAt}-${idx}`}
                className="p-3.5 rounded-xl shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-danger shrink-0" aria-hidden />
                  <div>
                    <p className="font-bold text-text text-xs sm:text-sm">
                      {VITAL_REGISTRY[a.type]?.label ?? a.type}: {a.value}
                    </p>
                    {a.message && (
                      <p className="text-xs text-text-soft mt-0.5">{a.message}</p>
                    )}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-warn-soft text-warn">
                  {a.classification}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 4. Symptom Diary & Patient Observations ─────────────────────────── */}
      <section className="patient-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-violet-50 text-violet-600" aria-hidden>
              <Activity size={16} />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm sm:text-base">Symptom Diary</h3>
              <p className="text-xs text-text-soft">
                Log subjective sensations and side effects for your doctor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSymptomSheetOpen(true)}
            className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
          >
            <Plus size={13} aria-hidden />
            Log Symptom
          </button>
        </div>

        {symptoms.isLoading ? (
          <div className="h-20 rounded-xl patient-shimmer" />
        ) : symptomsList.length === 0 ? (
          <div className="p-8 rounded-xl bg-surface-2 border border-border text-center flex flex-col items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-surface-2 border border-border text-text-muted flex items-center justify-center shadow-2xs">
              <Activity size={20} />
            </div>
            <div className="max-w-md">
              <h4 className="font-bold text-text text-sm">No Symptoms Logged</h4>
              <p className="text-xs text-text-soft mt-1 leading-relaxed">
                Log daily observations like headaches, nausea, fever, fatigue, or chest tightness to give your attending physician full context during follow-up consultations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSymptomSheetOpen(true)}
              className="pt-btn pt-btn-secondary mt-1 h-8 px-3.5 text-xs"
            >
              <Plus size={12} aria-hidden />
              Record First Symptom
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {symptomsList.map((row) => (
              <div
                key={row.id}
                className="p-4 rounded-xl border-inset shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)] flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-text text-sm truncate">
                      {row.symptom}
                    </h4>
                    <span
                      className={cn(
                        "px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase",
                        row.severity === "severe"
                          ? "bg-danger-soft text-danger"
                          : row.severity === "moderate"
                            ? "bg-warn-soft text-warn"
                            : "bg-brand-soft text-brand",
                      )}
                    >
                      {row.severity}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted mt-1">
                    Started: {new Date(row.startedAt).toLocaleDateString()}
                  </p>

                  {row.notes && (
                    <p className="text-xs text-text-soft mt-1.5 font-medium leading-relaxed">
                      {row.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => deleteSymptom.mutate(row.id)}
                  className="text-text-muted hover:text-danger transition-colors p-1"
                  aria-label="Delete symptom"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Slide-Over Drawers ───────────────────────────────────────────── */}
      <AddVitalSheet
        open={vitalSheetOpen}
        initialType={initialVitalType}
        onClose={() => setVitalSheetOpen(false)}
        onSubmit={async (input) => {
          await addVital.mutateAsync(input);
        }}
      />

      <AddSymptomSheet
        open={symptomSheetOpen}
        onClose={() => setSymptomSheetOpen(false)}
        onSubmit={async (input) => {
          await addSymptom.mutateAsync(input);
        }}
      />
    </div>
  );
}
