"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  Pill as PillIcon,
  SkipForward,
  Utensils,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { RadialGauge } from "@/patient/components/charts/RadialGauge";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import {
  useMarkDoseTaken,
  useMedicationStats,
  useMedicationsToday,
  useSkipDose,
  useTodayDoses,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Premium Today's Plan (Medications) card with adherence gauge,
 * tabbed medication selector, context-aware action triggers, and status rows.
 */
export function MedicationsToday({ className }: { className?: string }) {
  const query = useMedicationsToday();
  const stats = useMedicationStats(7);
  const doses = useTodayDoses();
  const markTaken = useMarkDoseTaken();
  const skip = useSkipDose();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const doseByMedicine = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; takenAt: string | null; skipped: boolean }>
    >();
    for (const d of doses.data?.doses ?? []) {
      const list = map.get(d.medicineId) ?? [];
      list.push(d);
      map.set(d.medicineId, list);
    }
    return map;
  }, [doses.data?.doses]);

  return (
    <Card accent="sky" className={cn("anim-rise anim-rise-delay-2", className)}>
      <CardHeader
        title="Today's plan"
        caption="Prescription schedule & doses"
        icon={<PillIcon size={16} className="text-brand" aria-hidden />}
        href="/patient/medications"
        linkLabel="View all"
      />

      <QueryBoundary
        query={query}
        emptyTitle="Nothing scheduled today"
        emptyDescription="You'll see doses here once your doctor issues an active plan."
        className="mt-4"
      >
        {(data) => {
          const meds = data.medicines.slice(0, 5);
          const activeId = selectedId ?? meds[0]?.id ?? null;
          const selected = meds.find((m) => m.id === activeId) ?? meds[0] ?? null;

          const activeDoseList = selected ? doseByMedicine.get(selected.id) ?? [] : [];
          const pending =
            activeDoseList.find((d) => !d.takenAt && !d.skipped) ?? null;
          const takenForMed = activeDoseList.filter((d) => d.takenAt).length;
          const totalForMed = activeDoseList.length;
          const pendingForMed = activeDoseList.filter(
            (d) => !d.takenAt && !d.skipped,
          ).length;

          return (
            <div className="mt-4 flex flex-col gap-4">
              {/* ── Medicine Selection Tabs ──────────────────────────────── */}
              {meds.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {meds.map((m) => {
                    const on = m.id === (selected?.id ?? activeId);
                    const mDoses = doseByMedicine.get(m.id) ?? [];
                    const pendingCount = mDoses.filter(
                      (d) => !d.takenAt && !d.skipped,
                    ).length;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border",
                          on
                            ? "bg-ink text-white border-ink shadow-xs"
                            : "bg-surface-2 hover:bg-surface-2 text-text-soft hover:text-text border-border",
                        )}
                      >
                        <span>{m.name}</span>
                        {m.dosage ? (
                          <span className={cn("text-[11px]", on ? "text-white/70" : "text-text-muted")}>
                            {m.dosage}
                          </span>
                        ) : null}
                        {pendingCount > 0 ? (
                          <span
                            className={cn(
                              "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                              on ? "bg-white/20 text-white" : "bg-warn-soft text-warn",
                            )}
                          >
                            {pendingCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Active Medicine Hero Spotlight ────────────────────────── */}
              {selected ? (
                <div className="rounded-xl border border-border bg-surface p-4 md:p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5">
                    {/* Adherence Radial Gauge */}
                    <div className="shrink-0 flex items-center justify-center sm:justify-start">
                      <RadialGauge
                        value={stats.data?.todayTaken ?? 0}
                        max={Math.max(1, stats.data?.todayCount ?? 1)}
                        size={100}
                        tone="brand"
                        display={`${stats.data?.todayTaken ?? 0}/${stats.data?.todayCount ?? 0}`}
                        label="doses today"
                      />
                    </div>

                    {/* Info & Medicine metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-text tracking-tight">
                            {selected.name}
                          </h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {selected.dosage ? (
                              <span className="inline-flex items-center rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                                {selected.dosage}
                              </span>
                            ) : null}
                            {selected.timing ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-soft shadow-2xs">
                                <Utensils size={10} className="text-text-muted" />
                                {selected.timing}
                              </span>
                            ) : null}
                            {selected.frequency ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-soft shadow-2xs">
                                <Clock size={10} className="text-text-muted" />
                                {selected.frequency}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Frequency Tag or PRN badge */}
                        <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-soft shadow-2xs">
                          {totalForMed === 0 ? "As Needed" : "Scheduled"}
                        </span>
                      </div>

                      {/* Streak & Adherence strip */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn-soft px-2.5 py-0.5 text-[11px] font-semibold text-warn">
                          <Flame size={12} className="fill-amber-500 text-amber-500" />
                          <span>{stats.data?.streakDays ?? 0}d streak</span>
                        </div>
                        {takenForMed > 0 ? (
                          <div className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success">
                            <CheckCircle2 size={12} className="text-success" aria-hidden />
                            <span>{takenForMed} taken today</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* ── Sub Action Buttons / Status Area ─────────────────── */}
                  <div className="mt-4 pt-3.5 border-t border-border">
                    {pending ? (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={markTaken.isPending}
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await markTaken.mutateAsync({ id: pending.id });
                            } catch (cause) {
                              setActionError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Could not mark dose taken.",
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-4 py-2.5 text-xs font-semibold text-white shadow-xs shadow-emerald-600/20 border border-emerald-600 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Check size={14} strokeWidth={2.5} aria-hidden />
                          {markTaken.isPending ? "Saving…" : "Take dose"}
                        </button>
                        <button
                          type="button"
                          disabled={skip.isPending}
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await skip.mutateAsync({ id: pending.id });
                            } catch (cause) {
                              setActionError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Could not skip dose.",
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface hover:bg-surface-2 active:scale-[0.98] px-3.5 py-2.5 text-xs font-semibold text-text shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          <SkipForward size={14} className="text-text-muted" aria-hidden />
                          Skip
                        </button>
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-text-soft font-medium">
                          <Clock size={12} className="text-amber-500" />
                          Pending dose scheduled
                        </span>
                      </div>
                    ) : totalForMed > 0 && pendingForMed === 0 ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-success-soft/60 border border-success/25 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-success shrink-0" aria-hidden />
                          <span className="text-xs font-semibold text-emerald-900">
                            All doses logged for this medicine today
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Complete
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50/60 border border-blue-100 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Info size={14} className="text-blue-600 shrink-0" />
                          <span className="text-xs text-text font-medium">
                            No pending doses scheduled for today · Take as needed
                          </span>
                        </div>
                        <Link
                          href="/patient/medications"
                          className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Manage
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* ── Compact All-Medications Dose List ─────────────────────── */}
              {meds.length > 0 ? (
                <div className="mt-1 flex flex-col gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">
                    Medication Schedule
                  </p>
                  <ul className="grid gap-2" data-testid="med-dose-list">
                    {meds.map((m) => {
                      const isRowSelected = m.id === (selected?.id ?? activeId);
                      const list = doseByMedicine.get(m.id) ?? [];
                      const taken = list.filter((d) => d.takenAt).length;
                      const skipped = list.filter((d) => d.skipped).length;
                      const pendingCount = list.filter(
                        (d) => !d.takenAt && !d.skipped,
                      ).length;
                      const total = list.length;

                      const tone =
                        total === 0
                          ? "text-text-soft bg-surface-2 border-border"
                          : pendingCount === 0
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200/80"
                            : "text-amber-700 bg-amber-50 border-amber-200/80";

                      return (
                        <li
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-all cursor-pointer",
                            isRowSelected
                              ? "border-blue-300/90 bg-blue-50/30 shadow-2xs ring-1 ring-blue-400/20"
                              : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/60 shadow-2xs",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                                isRowSelected
                                  ? "bg-blue-100/70 border-blue-200 text-blue-700"
                                  : "bg-surface-2 border-border text-text-soft",
                              )}
                            >
                              <PillIcon size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-bold text-text">
                                  {m.name}
                                </span>
                                {m.dosage ? (
                                  <span className="shrink-0 text-text-soft font-normal">
                                    {m.dosage}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-text-soft">
                                {m.timing ?? "Standard timing"}
                                {m.frequency ? ` · ${m.frequency}` : ""}
                              </p>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                              tone,
                            )}
                          >
                            {total === 0 ? (
                              <>
                                <Info size={11} />
                                As needed
                              </>
                            ) : pendingCount === 0 ? (
                              <>
                                <Check size={11} strokeWidth={2.5} />
                                {taken} taken
                              </>
                            ) : (
                              <>
                                <Clock size={11} />
                                {pendingCount} pending
                              </>
                            )}
                            {skipped > 0 ? ` · ${skipped} skipped` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {actionError ? (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{actionError}</span>
                </div>
              ) : null}
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}
