"use client";

import { LogOut } from "lucide-react";

import { useRecordDischargeEvents } from "@/patient/hooks";

export function DischargeEventsList({ recordId }: { recordId: string }) {
  const q = useRecordDischargeEvents(recordId);
  const item = q.data?.item as
    | { id: string; date: string; description?: string }
    | null
    | undefined;
  if (!item) return <p className="text-xs text-slate-400">No discharge events extracted yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      <li className="relative flex items-start gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-sky-500" aria-hidden />
        <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-sky-50 text-sky-600" aria-hidden>
          <LogOut size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{new Date(item.date).toLocaleDateString()}</span>
          {item.description ? <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span> : null}
        </span>
      </li>
    </ul>
  );
}
