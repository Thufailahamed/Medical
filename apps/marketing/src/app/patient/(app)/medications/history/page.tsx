"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  History,
  Pause,
  Pencil,
  Pill,
  Play,
  Plus,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDayLabel } from "@/patient/lib/format";
import { useEditMedication, useStopMedication } from "@/patient/hooks/medicines";
import { patientPaths } from "@healthcare/shared/contracts";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  GROUP_LABEL,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  ROW_LINK,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

interface MedicineRow {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

type Scope = "all" | "history";

export default function MedicinesHistoryPage() {
  const [scope, setScope] = useState<Scope>("all");
  const [q, setQ] = useState("");
  const includeActive = scope === "all";
  const history = useQuery<{ medicines: MedicineRow[] }>({
    queryKey: ["patient", "medicines", "history", includeActive],
    queryFn: () => {
      const url = includeActive ? patientPaths.medicines.mine() : `/medicines/me?includeActive=false`;
      return api<{ medicines: MedicineRow[] }>(url);
    },
  });

  const list = history.data?.medicines ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? list.filter((m) => m.name.toLowerCase().includes(term)) : list;
  }, [list, q]);

  const grouped = useMemo(() => {
    const acc: Record<string, MedicineRow[]> = {};
    for (const m of filtered) {
      const year = m.startDate ? new Date(m.startDate).getFullYear().toString() : "Unknown";
      (acc[year] ??= []).push(m);
    }
    return Object.entries(acc).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const active = list.filter((m) => m.active).length;
  const stopped = list.length - active;
  const years = new Set(list.map((m) => (m.startDate ? new Date(m.startDate).getFullYear() : 0))).size;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<History size={13} aria-hidden />}
          kicker="Medications"
          kickerMeta="History"
          title={
            <>
              Medicine <HeroAccent>history</HeroAccent>
            </>
          }
          description="Every medicine you've tracked, including stopped ones. Reactivate one to bring it back to your daily plan."
          actions={
            <>
              <Link href="/patient/medications" className={HERO_GHOST}>
                <ChevronLeft size={15} aria-hidden />
                Back
              </Link>
              <Link href="/patient/medications/new" className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Add medicine
              </Link>
            </>
          }
        />
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Tracked" icon={<Pill size={16} />} tone="bg-sky-50 text-sky-600" value={history.data ? String(list.length) : "…"} sub={scope === "all" ? "All medicines" : "Stopped only"} />
          <StatTile label="Active" icon={<CheckCircle2 size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(active)} sub="On your plan now" />
          <StatTile label="Stopped" icon={<Pause size={16} />} tone="bg-slate-100 text-slate-500" value={String(stopped)} sub="Archived" />
          <StatTile label="Years" icon={<CalendarDays size={16} />} tone="bg-violet-50 text-violet-600" value={String(years)} sub="Of medication history" />
        </HeroOverlap>
      </div>

      <section className={PANEL} aria-labelledby="mh-list">
        <PanelHeader
          id="mh-list"
          icon={<History size={16} />}
          tone="bg-violet-50 text-violet-600"
          title="Timeline"
          caption={history.isLoading ? "Loading…" : `${filtered.length} medicine${filtered.length === 1 ? "" : "s"}`}
        />
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch value={q} onChange={setQ} placeholder="Search medicines…" ariaLabel="Search medicine history" />
          <Segmented<Scope>
            ariaLabel="History scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All medicines" },
              { value: "history", label: "Stopped only" },
            ]}
          />
        </div>

        {history.isLoading ? (
          <PanelSkeleton rows={4} />
        ) : history.isError ? (
          <PanelError onRetry={() => void history.refetch()} />
        ) : grouped.length === 0 ? (
          <EmptyBlock icon={<History size={19} />} title="No history yet" body="Once you stop or finish a medicine, it will appear here." />
        ) : (
          <div className="mt-5 flex flex-col gap-6">
            {grouped.map(([year, meds]) => (
              <div key={year}>
                <div className="flex items-center gap-3">
                  <p className={GROUP_LABEL}>{year}</p>
                  <span className="h-px flex-1 bg-slate-100" aria-hidden />
                  <span className="text-[11px] tabular-nums text-slate-400">{meds.length}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {meds.map((m) => (
                    <HistoryRow key={m.id} medicine={m} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </PatientPage>
  );
}

function HistoryRow({ medicine }: { medicine: MedicineRow }) {
  const editMedication = useEditMedication();
  const stopMedication = useStopMedication();
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    setBusy(true);
    try {
      await editMedication.mutateAsync({ id: medicine.id, active: true, endDate: null });
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!window.confirm("Stop this medicine? It will be archived.")) return;
    setBusy(true);
    try {
      await stopMedication.mutateAsync(medicine.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 rounded-xl p-3.5 transition-all sm:flex-row sm:items-center",
        medicine.active
          ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
          : "bg-slate-50/70",
      )}
    >
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", medicine.active ? "bg-emerald-500" : "bg-slate-300")} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span
          className={cn(
            "ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
            medicine.active ? "bg-emerald-50 text-emerald-600" : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
          )}
          aria-hidden
        >
          <Pill size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-900">{medicine.name}</h3>
            <Badge tone="sky">{medicine.dosage}</Badge>
            <Badge tone={medicine.active ? "emerald" : "slate"}>{medicine.active ? "Active" : "Stopped"}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {formatDayLabel(medicine.startDate)}
            {medicine.endDate ? ` → ${formatDayLabel(medicine.endDate)}` : " · ongoing"}
            {medicine.frequency ? ` · ${medicine.frequency}` : ""}
            {medicine.timing ? ` · ${medicine.timing}` : ""}
          </p>
          {medicine.notes ? <p className="mt-0.5 truncate text-xs italic text-slate-400">{medicine.notes}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
        {medicine.active ? (
          <>
            <Link href={`/patient/medications/${medicine.id}/edit`} className={ROW_LINK}>
              <Pencil size={12} aria-hidden />
              Edit
            </Link>
            <button
              type="button"
              onClick={stop}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
            >
              <Pause size={12} aria-hidden />
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={reactivate}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            <Play size={12} aria-hidden />
            Reactivate
          </button>
        )}
      </div>
    </li>
  );
}
