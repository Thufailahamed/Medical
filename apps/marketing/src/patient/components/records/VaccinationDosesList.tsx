"use client";

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
  if (!items.length) return <p className="t-micro">No doses recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((d) => (
        <li key={d.id} className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">
            {d.vaccineName}
            {d.dose ? ` · Dose ${d.dose}` : ""}
          </p>
          <p className="t-micro">
            {new Date(d.date).toLocaleDateString()}
            {d.lot ? ` · Lot ${d.lot}` : ""}
            {d.administeredBy ? ` · ${d.administeredBy}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}