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

  const todayTaken = stats.data?.todayTaken ?? 0;
  const todayCount = stats.data?.todayCount ?? 0;
  const streak = stats.data?.streakDays ?? 0;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : fallback);
    }
  }

  return (
    <Card accent="sky" className={cn("anim-rise anim-rise-delay-2", className)}>
      <CardHeader
        title="Today's plan"
        caption="Your doses and schedule for today"
        icon={<PillIcon size={16} aria-hidden />}
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
            <div className="mt-5 flex flex-col gap-5">
              {selected ? (
                <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                  {/* ── Day summary ─────────────────────────────────────── */}
                  <div className="flex items-center gap-4 rounded-xl bg-surface-2 p-4 md:flex-col md:justify-center md:text-center">
                    <RadialGauge
                      value={todayTaken}
                      max={Math.max(1, todayCount)}
                      size={96}
                      tone={todayCount > 0 && todayTaken >= todayCount ? "success" : "brand"}
                      display={`${todayTaken}/${todayCount}`}
                      label="doses"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">
                        {todayCount === 0
                          ? "No fixed doses today"
                          : todayTaken >= todayCount
                            ? "All doses taken"
                            : `${todayCount - todayTaken} dose${todayCount - todayTaken === 1 ? "" : "s"} left`}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <Flame size={12} className="fill-amber-400 text-amber-500" aria-hidden />
                        {streak}-day streak
                      </p>
                    </div>
                  </div>

                  {/* ── Selected medicine ───────────────────────────────── */}
                  <div className="flex flex-col justify-between gap-4 rounded-xl border border-border p-4">
                    <div>
                      {meds.length > 1 && (
                        <div className="-mx-1 mb-3 flex items-center gap-1 overflow-x-auto px-1 pb-1">
                          {meds.map((m) => {
                            const on = m.id === selected.id;
                            const pendingCount = (doseByMedicine.get(m.id) ?? []).filter(
                              (d) => !d.takenAt && !d.skipped,
                            ).length;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelectedId(m.id)}
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                  on
                                    ? "bg-ink text-white"
                                    : "bg-surface-2 text-text-soft hover:bg-surface-3 hover:text-text",
                                )}
                              >
                                {m.name}
                                {pendingCount > 0 ? (
                                  <span
                                    className={cn(
                                      "rounded px-1 text-[10px] font-bold",
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

                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text">
                          {selected.name}
                        </h3>
                        <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-soft">
                          {totalForMed === 0 ? "As needed" : "Scheduled"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {selected.dosage ? (
                          <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                            {selected.dosage}
                          </span>
                        ) : null}
                        {selected.timing ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-soft">
                            <Utensils size={11} aria-hidden />
                            {selected.timing}
                          </span>
                        ) : null}
                        {selected.frequency ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-soft">
                            <Clock size={11} aria-hidden />
                            {selected.frequency}
                          </span>
                        ) : null}
                        {takenForMed > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 size={11} aria-hidden />
                            {takenForMed} taken today
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {pending ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={markTaken.isPending}
                          onClick={() =>
                            run(() => markTaken.mutateAsync({ id: pending.id }), "Could not mark dose taken.")
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={14} strokeWidth={2.5} aria-hidden />
                          {markTaken.isPending ? "Saving…" : "Take dose"}
                        </button>
                        <button
                          type="button"
                          disabled={skip.isPending}
                          onClick={() =>
                            run(() => skip.mutateAsync({ id: pending.id }), "Could not skip dose.")
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-3.5 text-xs font-semibold text-text transition-colors hover:bg-surface-3 disabled:opacity-50"
                        >
                          <SkipForward size={14} className="text-text-muted" aria-hidden />
                          Skip
                        </button>
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-text-muted">
                          <Clock size={12} className="text-amber-500" aria-hidden />
                          Dose due
                        </span>
                      </div>
                    ) : totalForMed > 0 && pendingForMed === 0 ? (
                      <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-emerald-800">
                        <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden />
                        All doses logged for this medicine today
                      </p>
                    ) : (
                      <p className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-soft">
                        <span className="inline-flex items-center gap-2">
                          <Info size={14} className="shrink-0 text-brand" aria-hidden />
                          No doses due today · take as needed
                        </span>
                        <Link
                          href="/patient/medications"
                          className="shrink-0 font-semibold text-brand hover:underline"
                        >
                          Manage
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* ── Schedule list ──────────────────────────────────────── */}
              {meds.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-muted">Medication schedule</p>
                  <ul className="divide-y divide-border" data-testid="med-dose-list">
                    {meds.map((m) => {
                      const isRowSelected = m.id === selected?.id;
                      const list = doseByMedicine.get(m.id) ?? [];
                      const taken = list.filter((d) => d.takenAt).length;
                      const skipped = list.filter((d) => d.skipped).length;
                      const pendingCount = list.filter(
                        (d) => !d.takenAt && !d.skipped,
                      ).length;
                      const total = list.length;

                      const tone =
                        total === 0
                          ? "text-text-soft bg-surface-2"
                          : pendingCount === 0
                            ? "text-success bg-success-soft"
                            : "text-warn bg-warn-soft";

                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(m.id)}
                            aria-pressed={isRowSelected}
                            className={cn(
                              "-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                              isRowSelected ? "bg-brand-soft/50" : "hover:bg-surface-2",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className={cn(
                                  "grid h-8 w-8 shrink-0 place-items-center rounded-[10px]",
                                  isRowSelected ? "bg-brand text-white" : "bg-surface-2 text-text-soft",
                                )}
                              >
                                <PillIcon size={14} aria-hidden />
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-baseline gap-1.5 text-sm">
                                  <span className="truncate font-semibold text-text">{m.name}</span>
                                  {m.dosage ? (
                                    <span className="shrink-0 text-xs text-text-muted">{m.dosage}</span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-text-muted">
                                  {m.timing ?? "Standard timing"}
                                  {m.frequency ? ` · ${m.frequency}` : ""}
                                </span>
                              </span>
                            </span>

                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                                tone,
                              )}
                            >
                              {total === 0 ? (
                                <>
                                  <Info size={11} aria-hidden />
                                  As needed
                                </>
                              ) : pendingCount === 0 ? (
                                <>
                                  <Check size={11} strokeWidth={2.5} aria-hidden />
                                  {taken} taken
                                </>
                              ) : (
                                <>
                                  <Clock size={11} aria-hidden />
                                  {pendingCount} pending
                                </>
                              )}
                              {skipped > 0 ? ` · ${skipped} skipped` : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {actionError ? (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger"
                >
                  <AlertCircle size={14} className="shrink-0" aria-hidden />
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
