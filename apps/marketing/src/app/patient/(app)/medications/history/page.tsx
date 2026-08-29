"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pill,
  Calendar,
  Pause,
  Play,
  ChevronLeft,
  History,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";
import { formatDayLabel, humanize } from "@/patient/lib/format";
import { useEditMedication, useStopMedication } from "@/patient/hooks/medicines";
import { patientKeys, patientPaths } from "@healthcare/shared/contracts";

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

export default function MedicinesHistoryPage() {
  const [includeActive, setIncludeActive] = useState(true);
  const history = useQuery<{ medicines: MedicineRow[] }>({
    queryKey: ["patient", "medicines", "history", includeActive],
    queryFn: () => {
      const url = includeActive
        ? patientPaths.medicines.mine()
        : `/medicines/me?includeActive=false`;
      return api<{ medicines: MedicineRow[] }>(url);
    },
  });

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/medications"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to medications
      </Link>

      <SectionHeader
        label="Daily plan"
        title="Medicine history"
        description="Every medicine you've tracked, including stopped and paused ones. Reactivate a medicine to bring it back to your daily plan."
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIncludeActive(true)}
          className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
            includeActive
              ? "bg-brand text-white"
              : "bg-surface-2 text-text-soft hover:bg-surface-3"
          }`}
        >
          All medicines
        </button>
        <button
          type="button"
          onClick={() => setIncludeActive(false)}
          className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
            !includeActive
              ? "bg-brand text-white"
              : "bg-surface-2 text-text-soft hover:bg-surface-3"
          }`}
        >
          History only
        </button>
      </div>

      <Card>
        <QueryBoundary
          query={history}
          loadingCount={4}
          emptyTitle="No history yet"
          emptyDescription="Once you stop or finish a medicine, it will appear here."
        >
          {(data) => {
            const list = data.medicines ?? [];
            if (list.length === 0) {
              return (
                <p className="text-sm text-text-soft">No medicines to show.</p>
              );
            }

            // Group by year
            const grouped = list.reduce<Record<string, MedicineRow[]>>(
              (acc, m) => {
                const year = m.startDate
                  ? new Date(m.startDate).getFullYear().toString()
                  : "Unknown";
                if (!acc[year]) acc[year] = [];
                acc[year].push(m);
                return acc;
              },
              {}
            );

            return (
              <div className="flex flex-col gap-6">
                {Object.keys(grouped)
                  .sort((a, b) => b.localeCompare(a))
                  .map((year) => (
                    <section key={year}>
                      <p className="t-label">{year}</p>
                      <ul className="mt-3 flex flex-col gap-3">
                        {grouped[year].map((m) => (
                          <HistoryRow key={m.id} medicine={m} />
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function HistoryRow({ medicine }: { medicine: MedicineRow }) {
  const editMedication = useEditMedication();
  const stopMedication = useStopMedication();
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    setBusy(true);
    try {
      await editMedication.mutateAsync({
        id: medicine.id,
        active: true,
        endDate: null,
      });
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
    <li className="rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text">{medicine.name}</h3>
          <p className="mt-0.5 text-xs text-text-soft">
            {medicine.dosage}
            {medicine.frequency ? ` · ${medicine.frequency}` : ""}
            {medicine.timing ? ` · ${medicine.timing}` : ""}
          </p>
        </div>
        <StatusPill tone={medicine.active ? "success" : "neutral"}>
          {medicine.active ? "Active" : "Stopped"}
        </StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft">
        <span className="inline-flex items-center gap-1">
          <Calendar size={11} aria-hidden />
          {formatDayLabel(medicine.startDate)}
        </span>
        {medicine.endDate ? (
          <span className="inline-flex items-center gap-1">
            → {formatDayLabel(medicine.endDate)}
          </span>
        ) : null}
      </div>
      {medicine.notes ? (
        <p className="mt-2 text-xs text-text-soft">{medicine.notes}</p>
      ) : null}
      {!medicine.active ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-surface-3 pt-3">
          <button
            type="button"
            onClick={reactivate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            <Play size={12} aria-hidden /> Reactivate
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-surface-3 pt-3">
          <Link
            href={`/patient/medications/${medicine.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-soft"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-pill border border-danger bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
          >
            <Pause size={12} aria-hidden /> Stop
          </button>
        </div>
      )}
    </li>
  );
}
