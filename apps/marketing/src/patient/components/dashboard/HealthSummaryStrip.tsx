"use client";

import Link from "next/link";
import { Activity, CalendarDays, HeartPulse, Pill } from "lucide-react";
import { useAppointments, useMedicationStats, useVitalsAlerts, useWellness } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function Tile({ href, label, icon, value, sub, ariaLabel }: { href: string; label: string; icon: React.ReactNode; value: string; sub: string; ariaLabel: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[76px]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="block truncate text-xl font-extrabold tracking-tight text-text">{value}</span>
        <span className="block truncate text-xs text-text-soft">{sub}</span>
      </span>
    </Link>
  );
}

export function HealthSummaryStrip({ className }: { className?: string }) {
  const wellness = useWellness();
  const alerts = useVitalsAlerts(7);
  const stats = useMedicationStats(7);
  const appts = useAppointments();

  const score = wellness.data?.score;
  const alertCount = alerts.data?.count ?? 0;
  const taken = stats.data?.todayTaken ?? 0;
  const total = stats.data?.todayCount ?? 0;
  const next = (appts.data?.appointments ?? [])
    .filter((a) => new Date(a.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] ?? null;

  return (
    <section aria-label="Health summary" className={cn("anim-rise grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      <Tile href="/patient/health" label="Wellness" ariaLabel="Wellness score details" icon={<HeartPulse size={19} />} value={score != null ? String(score) : "—"} sub={wellness.data?.level.label ?? "Building rhythm"} />
      <Tile href="/patient/vitals" label="Vitals" ariaLabel="Vitals status details" icon={<Activity size={19} />} value={alertCount > 0 ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Steady"} sub={alertCount > 0 ? "Review readings" : "Vitals steady"} />
      <Tile href="/patient/medications" label="Adherence" ariaLabel="Medication adherence details" icon={<Pill size={19} />} value={`${taken}/${total}`} sub={stats.data?.streakDays ? `${stats.data.streakDays}d streak` : "Today's doses"} />
      <Tile href="/patient/appointments" label="Next visit" ariaLabel="Next visit details" icon={<CalendarDays size={19} />} value={next ? formatDayLabel(next.date) : "None"} sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Book a visit"} />
    </section>
  );
}
