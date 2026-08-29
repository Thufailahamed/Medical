"use client";

import Link from "next/link";
import { AlertTriangle, Syringe } from "lucide-react";

import {
  useAllergies,
  useVaccinationsDue,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

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
    <div className={cn("anim-rise flex flex-col gap-2", className)}>
      {critical.length > 0 ? (
        <Link
          href="/patient/allergies"
          className="flex items-start gap-3 rounded-[var(--radius-inner)] border border-danger/25 bg-danger-soft px-4 py-3 transition-transform hover:-translate-y-0.5"
        >
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-danger text-white">
            <AlertTriangle size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-danger">
              Critical allergies on file
            </span>
            <span className="mt-0.5 block text-xs text-danger/80">
              {critical.map((a) => a.substance).join(" · ")}
            </span>
          </span>
        </Link>
      ) : null}

      {dueList.length > 0 ? (
        <Link
          href="/patient/vaccinations"
          className="flex items-start gap-3 rounded-[var(--radius-inner)] border border-warn/25 bg-warn-soft px-4 py-3 transition-transform hover:-translate-y-0.5"
        >
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warn text-white">
            <Syringe size={16} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-warn">
              Vaccinations due
            </span>
            <span className="mt-0.5 block text-xs text-text-soft">
              {dueList.map((s) => s.vaccineName).join(" · ")}
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
