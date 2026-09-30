"use client";

import Link from "next/link";
import {
  Activity,
  CalendarPlus,
  FolderPlus,
  Pill,
} from "lucide-react";

import {
  useAppointments,
  useMedicationStats,
  useRefillDue,
  useVitalsAlerts,
} from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

/** Four primary actions — everything else lives in the sidebar. */
const ACTIONS = [
  {
    key: "medications",
    href: "/patient/medications",
    label: "Medications",
    icon: Pill,
    accent: "bg-rose-50 text-rose-500",
  },
  {
    key: "record",
    href: "/patient/records/new",
    label: "Add record",
    icon: FolderPlus,
    accent: "bg-brand-soft text-brand",
  },
  {
    key: "book",
    href: "/patient/appointments/book",
    label: "Book visit",
    icon: CalendarPlus,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    key: "vitals",
    href: "/patient/vitals",
    label: "Log vitals",
    icon: Activity,
    accent: "bg-emerald-50 text-emerald-600",
  },
] as const;

/**
 * Primary shortcuts — dense enough for daily use, not a second nav.
 * Hints are live: they reuse the same react-query cache as the rest of
 * the dashboard, so this costs no extra requests.
 */
export function QuickActions({ className }: { className?: string }) {
  const stats = useMedicationStats(7);
  const refills = useRefillDue(14);
  const appts = useAppointments();
  const alerts = useVitalsAlerts(7);

  const taken = stats.data?.todayTaken ?? 0;
  const total = stats.data?.todayCount ?? 0;
  const refillCount = refills.data?.count ?? 0;
  const next = (appts.data?.appointments ?? [])
    .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
    .sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
  const alertCount = alerts.data?.count ?? 0;

  const hints: Record<(typeof ACTIONS)[number]["key"], string> = {
    medications:
      total > 0
        ? `${taken}/${total} doses today${refillCount > 0 ? ` · ${refillCount} refill${refillCount === 1 ? "" : "s"} due` : ""}`
        : refillCount > 0
          ? `${refillCount} refill${refillCount === 1 ? "" : "s"} due`
          : "Today's doses",
    record: "Upload or log",
    book: next
      ? `Next: ${formatDayLabel(next.date)} · ${formatTime(next.time)}`
      : "Find a doctor",
    vitals:
      alertCount > 0
        ? `${alertCount} alert${alertCount === 1 ? "" : "s"} to review`
        : "Track trends",
  };

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className={cn("patient-card anim-rise anim-rise-delay-1 p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="quick-actions-heading"
          className="font-display text-[15.5px] font-semibold tracking-[-0.01em] text-text"
        >
          Quick actions
        </h2>
        <span className="text-xs text-text-muted">Today</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.label}
              className="group flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-[10px] transition-transform duration-200 group-hover:scale-105",
                  action.accent,
                )}
              >
                <Icon size={17} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-text">
                  {action.label}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-text-muted">
                  {hints[action.key]}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
