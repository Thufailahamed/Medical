"use client";

import { useMemo, useState } from "react";
import { Check, Pill as PillIcon, SkipForward } from "lucide-react";

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
 * Today's meds with adherence gauge + take/skip on the next pending dose.
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
    <Card accent="rose" className={cn("anim-rise anim-rise-delay-2", className)}>
      <CardHeader
        title="Today's plan"
        caption="Medications"
        icon={<PillIcon size={15} />}
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
          const selected = meds.find((m) => m.id === activeId);
          const pending =
            (doseByMedicine.get(activeId ?? "") ?? []).find(
              (d) => !d.takenAt && !d.skipped,
            ) ?? null;
          const takenForMed = (doseByMedicine.get(activeId ?? "") ?? []).filter(
            (d) => d.takenAt,
          ).length;

          return (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {meds.map((m) => {
                  const on = m.id === activeId;
                  const pendingCount = (
                    doseByMedicine.get(m.id) ?? []
                  ).filter((d) => !d.takenAt && !d.skipped).length;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "max-w-full truncate px-3 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "bg-brand text-white shadow-sm"
                          : "bg-surface-2 text-text-soft hover:bg-surface-3",
                      )}
                      style={{ borderRadius: "var(--radius-pill)" }}
                    >
                      {m.name}
                      {m.dosage ? ` ${m.dosage}` : ""}
                      {pendingCount > 0 ? ` · ${pendingCount}` : ""}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4">
                <RadialGauge
                  value={stats.data?.todayTaken ?? 0}
                  max={Math.max(1, stats.data?.todayCount ?? 1)}
                  size={96}
                  tone="brand"
                  display={`${stats.data?.todayTaken ?? 0}/${stats.data?.todayCount ?? 0}`}
                  label="doses"
                />
                <div className="min-w-0 flex-1">
                  {selected ? (
                    <>
                      <p className="truncate text-sm font-semibold text-text">
                        {selected.name}
                      </p>
                      <p className="t-micro mt-0.5">
                        {selected.dosage}
                        {selected.timing ? ` · ${selected.timing}` : ""}
                        {selected.frequency ? ` · ${selected.frequency}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-text-soft">
                        Streak{" "}
                        <span className="font-semibold text-text">
                          {stats.data?.streakDays ?? 0}d
                        </span>
                        {takenForMed > 0 ? (
                          <span>
                            {" "}
                            · {takenForMed} taken today
                          </span>
                        ) : null}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>

              {selected ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!pending || markTaken.isPending}
                    onClick={async () => {
                      if (!pending) return;
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
                    className="inline-flex items-center gap-1.5 rounded-pill bg-success px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    <Check size={14} aria-hidden />
                    {markTaken.isPending ? "Saving…" : "Take dose"}
                  </button>
                  <button
                    type="button"
                    disabled={!pending || skip.isPending}
                    onClick={async () => {
                      if (!pending) return;
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
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text-soft disabled:opacity-50"
                  >
                    <SkipForward size={14} aria-hidden />
                    Skip
                  </button>
                  {!pending ? (
                    <span className="self-center text-xs text-text-muted">
                      All doses logged for this medicine
                    </span>
                  ) : null}
                </div>
              ) : null}
              {actionError ? (
                <p role="alert" className="text-xs text-danger">
                  {actionError}
                </p>
              ) : null}
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}
