"use client";

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
  if (!items.length) return <p className="t-micro">No medicines on this prescription.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((m) => (
        <li key={m.id} className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
          <p className="font-medium">
            {m.name}
            {m.dosage ? ` · ${m.dosage}` : ""}
          </p>
          <p className="t-micro">
            {[m.frequency, m.timing].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}