"use client";

import { Pill } from "lucide-react";

import { useRecordPrescriptionItems } from "@/patient/hooks";

export function PrescriptionItemsList({ recordId }: { recordId: string }) {
  const q = useRecordPrescriptionItems(recordId);
  const items = (q.data?.items ?? []) as Array<{
    id: string;
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    timing?: string | null;
  }>;
  if (!items.length) return <p className="text-xs text-slate-400">No medicines on this prescription.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((m) => (
        <li key={m.id} className="relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden />
          <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600" aria-hidden>
            <Pill size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {m.name}
              {m.dosage ? ` · ${m.dosage}` : ""}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">
              {[m.frequency, m.timing].filter(Boolean).join(" · ") || "As prescribed"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
