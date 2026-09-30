"use client";

import Link from "next/link";
import {
  Activity,
  CalendarPlus,
  FlaskConical,
  FolderPlus,
  MessageSquare,
  Pill,
} from "lucide-react";

import {
  useAppointments,
  useMedicationStats,
  useRefillDue,
  useVitalsAlerts,
} from "@/patient/hooks";
import { formatDayLabel } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PANEL } from "@/portal/components/doctor/Workspace";

/** Six primary shortcuts — everything else lives in the sidebar. */
const ACTIONS = [
  { key: "book", href: "/patient/appointments/book", label: "Book visit", icon: CalendarPlus, tone: "from-amber-500 to-orange-500", glow: "shadow-amber-500/30" },
  { key: "vitals", href: "/patient/vitals", label: "Log vitals", icon: Activity, tone: "from-rose-500 to-pink-600", glow: "shadow-rose-500/30" },
  { key: "medications", href: "/patient/medications", label: "Medications", icon: Pill, tone: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
  { key: "record", href: "/patient/records/new", label: "Add record", icon: FolderPlus, tone: "from-sky-500 to-blue-600", glow: "shadow-sky-500/30" },
  { key: "labs", href: "/patient/diagnostic-tests", label: "Lab tests", icon: FlaskConical, tone: "from-violet-500 to-purple-600", glow: "shadow-violet-500/30" },
  { key: "messages", href: "/patient/messages", label: "Messages", icon: MessageSquare, tone: "from-slate-600 to-slate-800", glow: "shadow-slate-500/30" },
] as const;

/**
 * Primary shortcuts in the admin "Quick tools" style. Hints are live:
 * they reuse the same react-query cache as the rest of the dashboard,
 * so this costs no extra requests.
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
    book: next ? `Next ${formatDayLabel(next.date)}` : "Find a doctor",
    vitals: alertCount > 0 ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Track trends",
    medications:
      refillCount > 0
        ? `${refillCount} refill${refillCount === 1 ? "" : "s"} due`
        : total > 0
          ? `${taken}/${total} today`
          : "Your plan",
    record: "Upload or log",
    labs: "Book a test",
    messages: "Care team",
  };
  const flagged: Partial<Record<(typeof ACTIONS)[number]["key"], boolean>> = {
    vitals: alertCount > 0,
    medications: refillCount > 0,
  };

  return (
    <section aria-labelledby="quick-actions-heading" className={cn(PANEL, className)}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id="quick-actions-heading"
          className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900"
        >
          Quick actions
        </h2>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">One click</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-label={action.label}
              className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <span
                className={cn(
                  "relative grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
                  action.tone,
                  action.glow,
                )}
              >
                <Icon size={19} aria-hidden />
                {flagged[action.key] ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-amber-500" aria-hidden />
                ) : null}
              </span>
              <span className="w-full min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-slate-900">{action.label}</span>
                <span
                  className={cn(
                    "block truncate text-[11px]",
                    flagged[action.key] ? "font-medium text-amber-600" : "text-slate-400",
                  )}
                >
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
