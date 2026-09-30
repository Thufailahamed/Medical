"use client";

import { ScanLine } from "lucide-react";

import { useRecordImagingFindings } from "@/patient/hooks";

export function ImagingFindingsCard({ recordId }: { recordId: string }) {
  const q = useRecordImagingFindings(recordId);
  const item = q.data?.item as
    | { id: string; modality?: string; impression?: string }
    | null
    | undefined;
  if (!item) return <p className="text-xs text-slate-400">No imaging findings extracted yet.</p>;
  return (
    <div className="flex items-start gap-3.5 rounded-xl bg-slate-50 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-violet-50 text-violet-600" aria-hidden>
        <ScanLine size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{item.modality ?? "Imaging"}</p>
        {item.impression ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.impression}</p> : null}
      </div>
    </div>
  );
}
