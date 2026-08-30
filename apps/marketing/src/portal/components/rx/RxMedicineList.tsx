import { Pill } from "lucide-react";

import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { formatDate } from "@/portal/lib/format";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";

export interface RxMedicineItem {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  timing?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
}

function humanize(value?: string | null) {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RxMedicineList({
  medicines,
  title,
  emptyTitle,
}: {
  medicines: RxMedicineItem[];
  title: string;
  emptyTitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Pill size={15} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
        {medicines.length > 0 ? (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {medicines.length} {medicines.length === 1 ? "medication" : "medications"}
          </span>
        ) : null}
      </div>

      {medicines.length === 0 ? (
        <div className="p-8">
          <ChartEmpty
            icon={<Pill size={20} />}
            title={emptyTitle}
            description="No medications have been prescribed for this prescription order."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {medicines.map((med, idx) => {
            const freq = humanize(med.frequency);
            const timing = humanize(med.timing);
            const schedule = [freq, timing].filter(Boolean).join(" · ");
            const duration =
              med.startDate && med.endDate
                ? `${formatDate(med.startDate)} → ${formatDate(med.endDate)}`
                : null;
            const meta = [schedule, duration].filter(Boolean).join(" · ");

            return (
              <li
                key={med.id}
                className="grid grid-cols-[2.5rem,1fr] gap-3.5 items-start px-5 py-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Pill size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {med.name}
                    </span>
                    {med.dosage ? (
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        {med.dosage}
                      </span>
                    ) : null}
                    {!med.endDate ? (
                      <span className="text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md">
                        Ongoing
                      </span>
                    ) : null}
                  </div>
                  {meta ? (
                    <p className="text-xs text-slate-500 font-medium">{meta}</p>
                  ) : null}
                  {med.instructions ? (
                    <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                      {med.instructions}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
