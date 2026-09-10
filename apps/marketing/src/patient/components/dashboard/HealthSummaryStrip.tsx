"use client";

import Link from "next/link";
import { Activity, CalendarDays, HeartPulse, Pill } from "lucide-react";
import { useAppointments, useMedicationStats, useVitalsAlerts, useWellness } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

function delta(curr: number | undefined, prev: number | undefined): string {
  if (curr == null || prev == null) return "—";
  const d = curr - prev;
  return d === 0 ? "—" : `${d > 0 ? "+" : ""}${d}`;
}

function Tile({
  href, label, icon, value, sub, spark, deltaText, deltaTone, ariaLabel,
}: {
  href: string; label: string; icon: React.ReactNode; value: string; sub: string;
  spark?: number[]; deltaText: string; deltaTone: "emerald" | "rose" | "muted";
  ariaLabel: string;
}) {
  const tone =
    deltaTone === "emerald" ? "text-emerald-600 bg-emerald-50" :
    deltaTone === "rose" ? "text-rose-600 bg-rose-50" :
    "text-text-muted bg-slate-50";
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[88px]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="block truncate text-xl font-extrabold tracking-tight text-text">{value}</span>
          <span className={cn("px-1.5 py-0.5 text-[10px] font-bold rounded", tone)}>{deltaText}</span>
        </span>
        <span className="block truncate text-xs text-text-soft">{sub}</span>
      </span>
      {spark && spark.length >= 2 ? (
        <span className="text-brand shrink-0 self-end" aria-hidden>
          <MiniSparkline points={spark} width={56} height={20} />
        </span>
      ) : null}
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
      <Tile
        href="/patient/health" label="Wellness" ariaLabel="Wellness score details"
        icon={<HeartPulse size={19} />}
        value={score != null ? String(score) : "—"}
        sub={wellness.data?.level.label ?? "Building rhythm"}
        spark={score != null ? [score - 2, score - 1, score] : []}
        deltaText={delta(score, score != null ? score - 2 : undefined)}
        deltaTone="emerald"
      />
      <Tile
        href="/patient/vitals" label="Vitals" ariaLabel="Vitals status details"
        icon={<Activity size={19} />}
        value={alertCount > 0 ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Steady"}
        sub={alertCount > 0 ? "Review readings" : "Vitals steady"}
        spark={alertCount > 0 ? [1, 2, alertCount] : [3, 2, 1]}
        deltaText={delta(alertCount, alertCount > 0 ? alertCount - 1 : 1)}
        deltaTone={alertCount > 0 ? "rose" : "emerald"}
      />
      <Tile
        href="/patient/medications" label="Adherence" ariaLabel="Medication adherence details"
        icon={<Pill size={19} />}
        value={`${taken}/${total}`}
        sub={stats.data?.streakDays ? `${stats.data.streakDays}d streak` : "Today's doses"}
        spark={total > 0 ? [Math.max(0, taken - 1), taken, total] : []}
        deltaText={delta(taken, total > 0 ? total - 1 : 0)}
        deltaTone="emerald"
      />
      <Tile
        href="/patient/appointments" label="Next visit" ariaLabel="Next visit details"
        icon={<CalendarDays size={19} />}
        value={next ? formatDayLabel(next.date) : "None"}
        sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Book a visit"}
        spark={[1, 2, 3]}
        deltaText="—"
        deltaTone="muted"
      />
    </section>
  );
}
