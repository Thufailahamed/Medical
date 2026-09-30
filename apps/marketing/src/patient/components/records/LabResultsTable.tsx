"use client";

import { useRecordLabResults } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

function flagTone(flag: string | null) {
  const f = (flag ?? "").toLowerCase();
  if (!f || f === "n" || f === "normal") return "bg-emerald-50 text-emerald-700";
  if (f.includes("crit") || f === "hh" || f === "ll") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export function LabResultsTable({ recordId }: { recordId: string }) {
  const q = useRecordLabResults(recordId);
  const items = (q.data?.items ?? []) as Array<{
    id: string;
    test: string;
    value: string;
    unit: string | null;
    referenceRange: string | null;
    flag: string | null;
    collectedAt: string;
  }>;
  if (!items.length) return <p className="text-xs text-slate-400">No lab results extracted yet.</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <th className="px-3 py-2">Test</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Range</th>
            <th className="px-3 py-2">Flag</th>
            <th className="px-3 py-2 text-right">Collected</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
              <td className="px-3 py-2.5 font-semibold text-slate-900">{row.test}</td>
              <td className="px-3 py-2.5 tabular-nums text-slate-900">
                {row.value}
                {row.unit ? <span className="ml-1 text-xs text-slate-400">{row.unit}</span> : null}
              </td>
              <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{row.referenceRange ?? "—"}</td>
              <td className="px-3 py-2.5">
                <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold", flagTone(row.flag))}>
                  {row.flag || "Normal"}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-xs text-slate-400">{new Date(row.collectedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
