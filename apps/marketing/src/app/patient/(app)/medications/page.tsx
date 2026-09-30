"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  History,
  Info,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  SkipForward,
  X,
} from "lucide-react";

import { Sheet } from "@/patient/components/primitives/Sheet";
import {
  useMarkDoseTaken,
  useMedications,
  useMedicationStats,
  useRefillDue,
  useSkipDose,
  useTodayDoses,
  useUntakeDose,
} from "@/patient/hooks";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  GROUP_LABEL,
  HERO_ATTENTION_CHIP,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LiveDot,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PrimaryLink,
  ROW_LINK,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

function cleanScheduleString(val: string | null | undefined): string {
  if (!val) return "";
  const cleaned = val.replace(/_/g, " ").trim();
  const lower = cleaned.toLowerCase();
  if (lower === "three times daily") return "3 times daily";
  if (lower === "twice daily") return "2 times daily";
  if (lower === "once daily") return "Once daily";
  if (lower === "as needed") return "As needed";
  if (lower === "after food") return "After meals";
  if (lower === "before food") return "Before meals";
  return humanize(cleaned);
}

type Filter = "all" | "active" | "paused";

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
  const [filter, setFilter] = useState<Filter>("all");

  const statData = stats.data;
  const medicines = list.data?.medicines ?? [];
  const todayDoses = doses.data?.doses ?? [];
  const refillCandidates = refills.data?.refills ?? [];
  const refillCount = refills.data?.count ?? refillCandidates.length;
  const activeCount = medicines.filter((m) => m.active).length;
  const pausedCount = medicines.length - activeCount;
  const taken = statData?.todayTaken ?? 0;
  const due = statData?.todayCount ?? 0;
  const streak = statData?.streakDays ?? 0;
  const pct = due > 0 ? Math.round((taken / due) * 100) : null;
  const last7 = statData?.last7Days ?? [];

  const busy = markTaken.isPending || skipDose.isPending || untakeDose.isPending;

  const filteredMedicines = useMemo(() => {
    const sorted = [...medicines].sort((a, b) => Number(b.active) - Number(a.active));
    if (filter === "active") return sorted.filter((m) => m.active);
    if (filter === "paused") return sorted.filter((m) => !m.active);
    return sorted;
  }, [medicines, filter]);

  const onErr = (fallback: string) => (err: unknown) =>
    setDoseError(err instanceof Error ? err.message : fallback);

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Pill size={13} aria-hidden />}
          kicker="Medications"
          kickerMeta={`${activeCount} active${streak > 0 ? ` · ${streak}-day streak` : ""}`}
          title={
            <>
              Your daily <HeroAccent>medicines</HeroAccent>
            </>
          }
          description={
            due > 0
              ? taken >= due
                ? "Every dose for today is logged — nice work."
                : `${due - taken} dose${due - taken === 1 ? "" : "s"} still to take today. Log each one as you go.`
              : "Track what you take, log doses, and get a heads-up before anything runs out."
          }
          chips={
            <>
              {due > 0 ? (
                <span className={HERO_CHIP}>
                  <LiveDot tone={taken >= due ? "emerald" : "sky"} />
                  {taken} of {due} doses today
                </span>
              ) : null}
              {refillCount > 0 ? (
                <button type="button" onClick={() => setRefillOpen(true)} className={HERO_ATTENTION_CHIP}>
                  <ShoppingBag size={12} aria-hidden />
                  {refillCount} refill{refillCount === 1 ? "" : "s"} due
                </button>
              ) : null}
              {streak > 0 ? (
                <span className={HERO_CHIP}>
                  <Flame size={12} className="text-orange-300" aria-hidden />
                  {streak}-day streak
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/patient/prescriptions" className={HERO_GHOST}>
                <ShieldCheck size={15} aria-hidden />
                Prescriptions
              </Link>
              <Link href="/patient/medications/new" className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Add medicine
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Doses today"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={due > 0 ? `${taken}/${due}` : "—"}
            sub={due === 0 ? "No fixed doses today" : taken >= due ? "All taken" : `${due - taken} still due`}
            progress={pct}
            badge={pct != null ? { text: `${pct}%`, tone: pct >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" } : undefined}
          />
          <StatTile
            label="Active"
            icon={<Pill size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(activeCount)}
            sub={pausedCount > 0 ? `${pausedCount} paused` : "On your plan"}
            active={filter === "active"}
            onClick={() => setFilter(filter === "active" ? "all" : "active")}
          />
          <StatTile
            label="Streak"
            icon={<Flame size={16} />}
            tone="bg-orange-50 text-orange-500"
            value={String(streak)}
            unit={streak === 1 ? "day" : "days"}
            sub="Days with every dose taken"
          />
          <StatTile
            label="Refills due"
            icon={<ShoppingBag size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(refillCount)}
            sub={refillCount > 0 ? "Within 14 days" : "Well stocked"}
            pulse={refillCount > 0}
            badge={refillCount > 0 ? { text: "Review", tone: "bg-amber-50 text-amber-700" } : undefined}
            onClick={() => setRefillOpen(true)}
          />
        </HeroOverlap>
      </div>

      {refillCount > 0 ? (
        <button
          type="button"
          onClick={() => setRefillOpen(true)}
          className="group relative flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(15,23,42,0.07)]"
        >
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-amber-400" aria-hidden />
          <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-amber-50 text-amber-600" aria-hidden>
            <AlertTriangle size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              {refillCount} medicine{refillCount === 1 ? "" : "s"} will need refill soon
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">
              {refillCandidates.map((r) => r.name).join(" · ") || "Running low within 14 days"}
            </span>
          </span>
          <span className={ROW_LINK}>
            Review
            <ArrowRight size={13} aria-hidden />
          </span>
        </button>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Medicine list ──────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="md-list">
          <PanelHeader
            id="md-list"
            icon={<Pill size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title="Your medicine list"
            caption={list.isLoading ? "Loading…" : `${filteredMedicines.length} shown · tap a dose to log it`}
            href="/patient/medications/history"
            linkLabel="History"
          />

          <div className="mt-5">
            <Segmented<Filter>
              ariaLabel="Medication filters"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: medicines.length },
                { value: "active", label: "Active", count: activeCount },
                { value: "paused", label: "Paused", count: pausedCount },
              ]}
            />
          </div>

          {doseError ? (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertTriangle size={14} className="shrink-0" aria-hidden />
              {doseError}
            </div>
          ) : null}

          {list.isLoading ? (
            <PanelSkeleton rows={4} />
          ) : filteredMedicines.length === 0 ? (
            <EmptyBlock
              icon={<Pill size={19} />}
              title="No medicines on this list"
              body={
                filter === "paused"
                  ? "Nothing is paused — every medicine on your plan is active."
                  : "Add a medicine you take, or it'll appear automatically when your doctor signs a prescription."
              }
              actions={
                <PrimaryLink href="/patient/medications/new" icon={<Plus size={13} />}>
                  Add medicine
                </PrimaryLink>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filteredMedicines.map((m) => {
                const dose = todayDoses.find((item) => item.medicineId === m.id);
                const freq = cleanScheduleString(m.frequency);
                const timing = cleanScheduleString(m.timing);
                const state = !m.active ? "paused" : dose ? (dose.takenAt ? "taken" : dose.skipped ? "skipped" : "due") : "prn";
                const rail =
                  state === "due" ? "bg-amber-400" : state === "taken" ? "bg-emerald-500" : state === "skipped" ? "bg-slate-300" : state === "prn" ? "bg-sky-500" : "bg-transparent";
                const tile =
                  state === "due"
                    ? "bg-amber-50 text-amber-600"
                    : state === "taken"
                      ? "bg-emerald-50 text-emerald-600"
                      : state === "paused"
                        ? "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]"
                        : "bg-sky-50 text-sky-600";

                return (
                  <li
                    key={m.id}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-xl p-3.5 transition-all sm:flex-row sm:items-center",
                      m.active
                        ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                        : "bg-slate-50/70",
                    )}
                  >
                    <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", rail)} aria-hidden />
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <span className={cn("ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", tile)} aria-hidden>
                        <Pill size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className={cn("truncate text-sm font-semibold", m.active ? "text-slate-900" : "text-slate-500")}>{m.name}</h3>
                          <Badge tone="sky">{m.dosage}</Badge>
                          {!m.active ? <Badge tone="slate">Paused</Badge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {[freq, timing].filter(Boolean).join(" · ") || "As prescribed"}
                          {m.startDate ? ` · since ${formatDayLabel(m.startDate)}` : ""}
                        </p>
                        {m.notes ? <p className="mt-0.5 truncate text-xs italic text-slate-400">{m.notes}</p> : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                      {dose ? (
                        dose.takenAt ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDoseError(null);
                              untakeDose.mutate(dose.id, { onError: onErr("Could not undo dose.") });
                            }}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <Check size={13} strokeWidth={2.75} aria-hidden />
                            Taken · Undo
                          </button>
                        ) : dose.skipped ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDoseError(null);
                              untakeDose.mutate(dose.id, { onError: onErr("Could not reset dose.") });
                            }}
                            disabled={busy}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
                          >
                            <RotateCcw size={12} aria-hidden />
                            Skipped · Reset
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDoseError(null);
                                skipDose.mutate({ id: dose.id }, { onError: onErr("Could not skip dose.") });
                              }}
                              disabled={busy}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-slate-900 disabled:opacity-50"
                            >
                              <SkipForward size={12} aria-hidden />
                              Skip
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDoseError(null);
                                markTaken.mutate({ id: dose.id }, { onError: onErr("Could not mark dose.") });
                              }}
                              disabled={busy}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Check size={13} strokeWidth={2.75} aria-hidden />
                              Take dose
                            </button>
                          </>
                        )
                      ) : m.active ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                          <Info size={11} aria-hidden />
                          {freq || "As prescribed"}
                        </span>
                      ) : null}
                      <Link
                        href={`/patient/medications/${m.id}/edit`}
                        aria-label={`Edit ${m.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Pencil size={14} aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Rail ───────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Adherence">
          <section className={PANEL} aria-labelledby="md-week">
            <PanelHeader
              id="md-week"
              icon={<Clock size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Last 7 days"
              caption={
                last7.length
                  ? `${Math.round(last7.reduce((s, d) => s + d.pct, 0) / last7.length)}% average adherence`
                  : "Adherence builds as you log doses"
              }
            />
            {last7.length === 0 ? (
              <EmptyBlock icon={<Clock size={19} />} title="No history yet" body="Log today's doses to start your adherence chart." />
            ) : (
              <div className="mt-5 flex h-32 items-end gap-2">
                {last7.map((d, i) => {
                  const isToday = i === last7.length - 1;
                  const day = new Date(d.date);
                  return (
                    <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${d.taken}/${d.total} taken`}>
                      <span className="text-[10px] font-semibold tabular-nums text-slate-400">{d.total > 0 ? `${d.pct}%` : "–"}</span>
                      <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-slate-100">
                        <div
                          className={cn(
                            "w-full rounded-md transition-all",
                            d.total === 0 ? "bg-transparent" : isToday ? "bg-gradient-to-t from-sky-500 to-teal-400" : d.pct >= 100 ? "bg-emerald-400" : d.pct >= 50 ? "bg-amber-300" : "bg-rose-300",
                          )}
                          style={{ height: `${Math.max(d.total > 0 ? 8 : 0, d.pct)}%` }}
                        />
                      </div>
                      <span className={cn("text-[10.5px] font-semibold", isToday ? "text-sky-700" : "text-slate-400")}>
                        {Number.isNaN(day.getTime()) ? "" : day.toLocaleDateString("en-US", { weekday: "narrow" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={PANEL} aria-labelledby="md-tools">
            <div className="flex items-center justify-between gap-3">
              <h2 id="md-tools" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                Shortcuts
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">One click</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { href: "/patient/medications/new", label: "Add", hint: "New medicine", icon: Plus, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
                { href: "/patient/ai/ocr", label: "Scan", hint: "Rx or box", icon: ScanLine, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
                { href: "/patient/medications/history", label: "History", hint: "Past meds", icon: History, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105", t.tone)}>
                      <Icon size={19} aria-hidden />
                    </span>
                    <span className="w-full min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{t.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{t.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {/* ── Refills drawer ─────────────────────────────────────────── */}
      <Sheet open={refillOpen} onClose={() => setRefillOpen(false)} ariaLabel="Refills due">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-amber-50 text-amber-600" aria-hidden>
              <ShoppingBag size={16} />
            </span>
            <div>
              <p className={GROUP_LABEL}>Pharmacy</p>
              <h2 className="text-[15.5px] font-semibold text-slate-900">Refills due</h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setRefillOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {refillCandidates.length === 0 ? (
          <EmptyBlock icon={<CheckCircle2 size={19} />} title="All well stocked" body="Nothing is due for refill in the next 14 days." />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {refillCandidates.map((m) => {
              const urgent = m.daysRemaining <= 3;
              return (
                <li key={m.id} className="relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                  <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", urgent ? "bg-rose-500" : "bg-amber-400")} aria-hidden />
                  <span className={cn("ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", urgent ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")} aria-hidden>
                    <Pill size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{m.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {m.dosage} · runs out {new Date(m.expectedEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </span>
                  <Badge tone={urgent ? "rose" : "amber"}>{m.daysRemaining <= 0 ? "Past due" : `${m.daysRemaining}d left`}</Badge>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Link
            href="/patient/prescriptions"
            onClick={() => setRefillOpen(false)}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#07233a] text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            Order from prescriptions
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </Sheet>
    </PatientPage>
  );
}
