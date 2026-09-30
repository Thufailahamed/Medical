"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Syringe } from "lucide-react";

import {
  useAllergies,
  useVaccinationsDue,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const ROW =
  "group relative flex items-center gap-3.5 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(15,23,42,0.07)]";

/**
 * Critical safety strip — severe/critical allergies + due vaccines.
 */
export function SafetyBanner({ className }: { className?: string }) {
  const allergies = useAllergies();
  const due = useVaccinationsDue();

  const critical = (allergies.data?.allergies ?? []).filter(
    (a) =>
      a.active !== false &&
      (a.severity === "severe" || a.severity === "critical"),
  );
  const dueList = [
    ...(due.data?.overdue ?? []),
    ...(due.data?.due ?? []),
  ].slice(0, 3);

  if (critical.length === 0 && dueList.length === 0) return null;

  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)}>
      {critical.length > 0 ? (
        <Link
          href="/patient/allergies"
          className={cn(ROW, "md:only:col-span-2")}
        >
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-rose-500" aria-hidden />
          <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-rose-50 text-rose-600">
            <AlertTriangle size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-rose-700">
              Critical allergies on file
            </span>
            <span className="mt-0.5 block truncate text-xs text-rose-600/80">
              {critical.map((a) => a.substance).join(" · ")}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
        </Link>
      ) : null}

      {dueList.length > 0 ? (
        <Link
          href="/patient/vaccinations"
          className={cn(ROW, "md:only:col-span-2")}
        >
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-amber-400" aria-hidden />
          <span className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-amber-50 text-amber-600">
            <Syringe size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-amber-700">
              Vaccinations due
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">
              {dueList.map((s) => s.vaccineName).join(" · ")}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
