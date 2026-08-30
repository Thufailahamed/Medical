"use client";

import Link from "next/link";
import {
  Activity,
  CalendarPlus,
  FolderPlus,
  Pill,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

/** Four primary actions — everything else lives in the sidebar. */
const ACTIONS = [
  {
    href: "/patient/medications",
    label: "Medications",
    hint: "Today's doses",
    icon: Pill,
    accent: "bg-rose-50 text-rose-600",
  },
  {
    href: "/patient/records/new",
    label: "Add record",
    hint: "Upload or log",
    icon: FolderPlus,
    accent: "bg-sky-50 text-sky-600",
  },
  {
    href: "/patient/appointments/book",
    label: "Book visit",
    hint: "Find a doctor",
    icon: CalendarPlus,
    accent: "bg-brand-soft text-brand",
  },
  {
    href: "/patient/vitals",
    label: "Log vitals",
    hint: "Track trends",
    icon: Activity,
    accent: "bg-amber-50 text-amber-700",
  },
] as const;

/**
 * Primary shortcuts — dense enough for daily use, not a second nav.
 */
export function QuickActions({ className }: { className?: string }) {
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
              className="group flex items-center gap-3.5 rounded-xl border border-border bg-white px-4 py-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
            >
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 shadow-xs",
                  action.accent,
                )}
              >
                <Icon size={19} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-text group-hover:text-brand transition-colors">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-text-muted mt-0.5">
                  {action.hint}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
