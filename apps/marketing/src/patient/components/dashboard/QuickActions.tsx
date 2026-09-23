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
    accent: "bg-rose-50 text-rose-600",
  },
  {
    key: "record",
    href: "/patient/records/new",
    label: "Add record",
    icon: FolderPlus,
    accent: "bg-sky-50 text-sky-600",
  },
  {
    key: "book",
    href: "/patient/appointments/book",
    label: "Book visit",
    icon: CalendarPlus,
    accent: "bg-brand-soft text-brand",
  },
  {
    key: "vitals",
    href: "/patient/vitals",
    label: "Log vitals",
    icon: Activity,
    accent: "bg-amber-50 text-amber-700",
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
    <section className={cn("anim-rise anim-rise-delay-1", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="t-label">Today</p>
          <h2 className="t-card-title mt-0.5 text-text">Quick actions</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.label}
              className="group flex items-center gap-3.5 rounded-2xl border border-border bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[76px]"
            >
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 shadow-xs",
                  action.accent,
                )}
              >
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-text group-hover:text-brand transition-colors">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-text-muted mt-0.5">
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
