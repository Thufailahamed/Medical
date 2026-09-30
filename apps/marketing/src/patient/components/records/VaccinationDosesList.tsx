"use client";

import { Syringe } from "lucide-react";

import { useRecordVaccinationDoses } from "@/patient/hooks";

export function VaccinationDosesList({ recordId }: { recordId: string }) {
  const q = useRecordVaccinationDoses(recordId);
  const items = (q.data?.items ?? []) as Array<{
    id: string;
    vaccineName: string;
    dose?: string | null;
    date: string;
    lot?: string | null;
    administeredBy?: string | null;
  }>;
  if (!items.length) return <p className="text-xs text-slate-400">No doses recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((d) => (
        <li key={d.id} className="relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-amber-400" aria-hidden />
          <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-amber-50 text-amber-600" aria-hidden>
            <Syringe size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {d.vaccineName}
              {d.dose ? ` · Dose ${d.dose}` : ""}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">
              {new Date(d.date).toLocaleDateString()}
              {d.lot ? ` · Lot ${d.lot}` : ""}
              {d.administeredBy ? ` · ${d.administeredBy}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
