"use client";

import { useState } from "react";
import { Flame, Pill, CheckCircle2, X, Check, SkipForward } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { StatTile } from "@/patient/components/primitives/StatTile";
import { Sheet } from "@/patient/components/primitives/Sheet";
import {
  useMedications,
  useMedicationStats,
  useRefillDue,
  useTodayDoses,
  useMarkDoseTaken,
  useSkipDose,
  useUntakeDose,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

export default function MedicationsPage() {
  const list = useMedications();
  const stats = useMedicationStats(7);
  const refills = useRefillDue(14);
  const doses = useTodayDoses();
  const markTaken = useMarkDoseTaken();
  const skipDose = useSkipDose();
  const untakeDose = useUntakeDose();
  const [refillOpen, setRefillOpen] = useState(false);
  const [doseError, setDoseError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Daily plan"
        title="Medications"
        description="Active prescriptions and today's adherence."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QueryBoundary
          query={stats}
          loadingCount={1}
          emptyTitle=""
        >
          {(data) => (
            <>
              <StatTile
                label="Active"
                value={String(data.activeCount ?? 0)}
                sublabel="on your plan"
                icon={<Pill size={18} />}
                accent="sky"
                href="/patient/medications"
              />
              <StatTile
                label="Today"
                value={`${data.todayTaken ?? 0}/${data.todayCount ?? 0}`}
                sublabel="doses taken"
                icon={<CheckCircle2 size={18} />}
                accent="green"
              />
              <StatTile
                label="Streak"
                value={`${data.streakDays ?? 0}`}
                unit="d"
                sublabel="consecutive days"
                icon={<Flame size={18} />}
                accent="amber"
              />
            </>
          )}
        </QueryBoundary>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-text-muted">
          Refills due in next 14 days
        </h2>
        <button
          onClick={() => setRefillOpen(true)}
          disabled={refills.isLoading || refills.data?.count === 0}
          className="w-full rounded border border-[color:var(--color-border)] bg-surface-1 p-3 text-left text-sm disabled:opacity-60"
        >
          {refills.isLoading
            ? "Loading…"
            : refills.data?.count
              ? `${refills.data.count} medicine${refills.data.count === 1 ? "" : "s"} need refill`
              : "Nothing due for refill"}
        </button>
      </div>

      <Card accent="brand">
        <QueryBoundary
          query={list}
          isEmpty={(d) => !d || !d.medicines || d.medicines.length === 0}
          loadingCount={3}
          emptyTitle="No medications yet"
          emptyDescription="When your doctor prescribes a medication, it lands here."
        >
          {(data) => {
            const medicines = data?.medicines ?? [];
            const todayDoses = doses.data?.doses ?? [];
            return (
              <div className="flex flex-col gap-3">
                {doseError ? <p role="alert" className="text-sm text-danger">{doseError}</p> : null}
                <ul className="flex flex-col gap-2.5">
                  {medicines.map((m) => {
                    const dose = todayDoses.find((item) => item.medicineId === m.id);
                    const busy = markTaken.isPending || skipDose.isPending || untakeDose.isPending;
                    return (
                      <li
                        key={m.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded-inner border border-[color:var(--color-border)] px-4 py-3",
                          m.active ? "bg-surface-2/80" : "bg-surface-2/40"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">{m.name}</p>
                          <p className="t-micro">
                            {m.dosage} {m.frequency ? `· ${m.frequency}` : ""}
                            {m.timing ? ` · ${m.timing}` : ""}
                          </p>
                        </div>
                        <StatusPill tone={m.active ? "success" : "neutral"}>
                          {m.active ? "Active" : "Paused"}
                        </StatusPill>
                        {dose ? (
                          <div className="flex items-center gap-1.5">
                            {dose.takenAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDoseError(null);
                                  untakeDose.mutate(dose.id, { onError: (error) => setDoseError(error instanceof Error ? error.message : "Could not undo dose.") });
                                }}
                                disabled={busy}
                                className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-3 py-1.5 text-xs font-semibold text-success disabled:opacity-60"
                              >
                                <Check size={13} aria-hidden /> Taken · Undo
                              </button>
                            ) : dose.skipped ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDoseError(null);
                                  untakeDose.mutate(dose.id, { onError: (error) => setDoseError(error instanceof Error ? error.message : "Could not reset dose.") });
                                }}
                                disabled={busy}
                                className="rounded-pill bg-surface-3 px-3 py-1.5 text-xs font-semibold text-text-soft disabled:opacity-60"
                              >
                                Skipped · Reset
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDoseError(null);
                                    markTaken.mutate({ id: dose.id }, { onError: (error) => setDoseError(error instanceof Error ? error.message : "Could not mark dose.") });
                                  }}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                >
                                  <Check size={13} aria-hidden /> Taken
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDoseError(null);
                                    skipDose.mutate({ id: dose.id }, { onError: (error) => setDoseError(error instanceof Error ? error.message : "Could not skip dose.") });
                                  }}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-text-soft disabled:opacity-60"
                                >
                                  <SkipForward size={13} aria-hidden /> Skip
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          }}
        </QueryBoundary>
      </Card>

      <Sheet
        open={refillOpen}
        onClose={() => setRefillOpen(false)}
        ariaLabel="Refills due"
      >
        <div className="flex items-center justify-between">
          <h2 className="t-page text-text">Refills due</h2>
          <button
            aria-label="Close"
            onClick={() => setRefillOpen(false)}
            className="text-text-muted hover:text-text"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          {(refills.data?.refills ?? []).map((m) => (
            <div
              key={m.id}
              className="rounded border border-[color:var(--color-border)] bg-surface-1 p-3"
            >
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-text-muted">{m.dosage}</p>
              <p className="text-xs text-text-muted">
                {m.daysRemaining <= 0
                  ? "Past due"
                  : `Empty in ${m.daysRemaining} day${m.daysRemaining === 1 ? "" : "s"}`}
              </p>
            </div>
          ))}
          {!refills.data?.refills?.length && (
            <p className="text-sm text-text-muted">Nothing due.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}
