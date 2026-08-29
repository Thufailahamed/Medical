"use client";

import { useRecordDischargeEvents } from "@/patient/hooks";

export function DischargeEventsList({ recordId }: { recordId: string }) {
  const q = useRecordDischargeEvents(recordId);
  const item = q.data?.item as
    | { id: string; date: string; description?: string }
    | null
    | undefined;
  if (!item) return <p className="t-micro">No discharge events extracted yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      <li className="rounded-inner bg-surface-2 px-3 py-2 text-sm">
        <p className="font-medium">{new Date(item.date).toLocaleDateString()}</p>
        {item.description ? (
          <p className="t-micro">{item.description}</p>
        ) : null}
      </li>
    </ul>
  );
}