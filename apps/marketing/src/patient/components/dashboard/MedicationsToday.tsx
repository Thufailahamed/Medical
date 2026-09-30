"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  Pill as PillIcon,
  Plus,
  SkipForward,
} from "lucide-react";

import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import {
  useMarkDoseTaken,
  useMedicationStats,
  useMedicationsToday,
  useSkipDose,
  useTodayDoses,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  PANEL,
  PanelHeader,
  PrimaryLink,
} from "@/portal/components/doctor/Workspace";

/** Small progress ring for the "doses taken" summary tile. */
function DoseRing({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={pct >= 100 ? "#10b981" : "#0284c7"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  );
}

/**
 * Today's plan — a summary row (taken / still due / streak) above one
 * actionable row per medicine, styled like the admin "Needs attention"
 * queue: an accent rail marks rows with a dose due, and Take / Skip sit
 * inline so nothing needs a second click to find.
 */
export function MedicationsToday({ className }: { className?: string }) {
  const query = useMedicationsToday();
  const stats = useMedicationStats(7);
  const doses = useTodayDoses();
  const markTaken = useMarkDoseTaken();
  const skip = useSkipDose();
  const [busyId, setBusyId] = useState<string | null>(null);
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
  const remaining = Math.max(0, todayCount - todayTaken);
  const pct = todayCount > 0 ? Math.round((todayTaken / todayCount) * 100) : 0;

  async function run(doseId: string, action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    setBusyId(doseId);
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={cn(PANEL, className)} aria-labelledby="pt-today-plan">
      <PanelHeader
        id="pt-today-plan"
        icon={<PillIcon size={16} />}
        tone="bg-emerald-50 text-emerald-600"
        title="Today's plan"
        caption={
          todayCount === 0
            ? "Your doses and schedule for today"
            : remaining === 0
              ? `All ${todayCount} doses taken today`
              : `${remaining} dose${remaining === 1 ? "" : "s"} still due · ${todayTaken} of ${todayCount} taken`
        }
        href="/patient/medications"
        linkLabel="View all"
      />

      {/* ── Day summary ─────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-4">
          <DoseRing pct={pct} />
          <span className="min-w-0">
            <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
              {todayTaken}
              <span className="text-sm font-medium text-slate-400">/{todayCount}</span>
            </span>
            <span className="mt-1.5 block truncate text-xs text-slate-400">Doses taken</span>
          </span>
        </div>
        <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-4">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
              remaining > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
            )}
          >
            {remaining > 0 ? <Clock size={17} aria-hidden /> : <CheckCircle2 size={17} aria-hidden />}
          </span>
          <span className="min-w-0">
            <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
              {remaining}
            </span>
            <span className="mt-1.5 block truncate text-xs text-slate-400">
              {todayCount === 0 ? "No fixed doses today" : remaining > 0 ? "Still due" : "All done"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-orange-50 text-orange-500">
            <Flame size={17} className="fill-orange-300" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
              {streak}
              <span className="ml-1 text-sm font-medium text-slate-400">day{streak === 1 ? "" : "s"}</span>
            </span>
            <span className="mt-1.5 block truncate text-xs text-slate-400">Day streak</span>
          </span>
        </div>
      </div>

      {/* ── Medicines ───────────────────────────────────────────────── */}
      <QueryBoundary
        query={query}
        emptyTitle="Nothing scheduled today"
        emptyDescription="You'll see doses here once your doctor issues an active plan."
        className="mt-5"
      >
        {(data) => {
          const meds = data.medicines.slice(0, 6);
          if (meds.length === 0) {
            return (
              <EmptyBlock
                icon={<PillIcon size={19} />}
                title="Nothing scheduled today"
                body="You'll see doses here once your doctor issues an active plan, or add a medicine you already take."
                actions={
                  <PrimaryLink href="/patient/medications" icon={<Plus size={13} />}>
                    Add medicine
                  </PrimaryLink>
                }
              />
            );
          }

          return (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Medication schedule
              </p>
              <ul className="flex flex-col gap-2" data-testid="med-dose-list">
                {meds.map((m) => {
                  const list = doseByMedicine.get(m.id) ?? [];
                  const taken = list.filter((d) => d.takenAt).length;
                  const skipped = list.filter((d) => d.skipped).length;
                  const pending = list.find((d) => !d.takenAt && !d.skipped) ?? null;
                  const pendingCount = list.filter((d) => !d.takenAt && !d.skipped).length;
                  const total = list.length;
                  const state = total === 0 ? "prn" : pendingCount > 0 ? "due" : "done";
                  const busy = pending != null && busyId === pending.id;

                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "relative flex flex-wrap items-center gap-3.5 rounded-xl p-3.5 transition-all sm:flex-nowrap",
                        state === "due"
                          ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                          : "bg-slate-50/70",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                          state === "due" ? "bg-amber-400" : state === "done" ? "bg-emerald-500" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                          state === "due"
                            ? "bg-amber-50 text-amber-600"
                            : state === "done"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
                        )}
                      >
                        <PillIcon size={16} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{m.name}</span>
                          {m.dosage ? (
                            <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
                              {m.dosage}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {m.timing ?? "Standard timing"}
                          {m.frequency ? ` · ${m.frequency}` : ""}
                          {skipped > 0 ? ` · ${skipped} skipped` : ""}
                        </span>
                      </span>

                      {state === "due" && pending ? (
                        <span className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(pending.id, () => skip.mutateAsync({ id: pending.id }), "Could not skip dose.")
                            }
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-slate-900 disabled:opacity-50 sm:flex-none"
                          >
                            <SkipForward size={13} aria-hidden />
                            Skip
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(pending.id, () => markTaken.mutateAsync({ id: pending.id }), "Could not mark dose taken.")
                            }
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:flex-none"
                          >
                            <Check size={14} strokeWidth={2.5} aria-hidden />
                            {busy ? "Saving…" : pendingCount > 1 ? `Take (${pendingCount})` : "Take dose"}
                          </button>
                        </span>
                      ) : state === "done" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 size={12} aria-hidden />
                          {taken} taken
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                          <Info size={12} aria-hidden />
                          As needed
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }}
      </QueryBoundary>

      {actionError ? (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          <span>{actionError}</span>
        </div>
      ) : null}
    </section>
  );
}
