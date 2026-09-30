"use client";

import Link from "next/link";
import { Activity, CalendarDays, HeartPulse, Pill } from "lucide-react";
import {
  useAppointments,
  useMedicationStats,
  useVitalsAlerts,
  useVitalsSeries,
  useWellness,
} from "@/patient/hooks";
import { toSeries } from "@/patient/lib/vitals";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { countdownDays } from "@healthcare/shared/visit-lifecycle";
import { MiniSparkline } from "./MiniSparkline";

type BadgeTone = "emerald" | "rose" | "muted" | "amber";
type IconTone = "brand" | "rose" | "emerald" | "amber";

const ICON_TONE: Record<IconTone, string> = {
  brand: "bg-brand-soft text-brand",
  rose: "bg-rose-50 text-rose-500",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
};

const BADGE_TONE: Record<BadgeTone, string> = {
  emerald: "text-success bg-success-soft",
  rose: "text-danger bg-danger-soft",
  amber: "text-warn bg-warn-soft",
  muted: "text-text-muted bg-surface-2",
};

function Tile({
  href, label, icon, iconTone, value, unit, sub, spark, progress, badgeText, badgeTone = "muted", ariaLabel,
}: {
  href: string; label: string; icon: React.ReactNode; iconTone: IconTone;
  value: string; unit?: string; sub: string;
  spark?: number[]; progress?: number | null; badgeText?: string; badgeTone?: BadgeTone;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex min-h-[112px] flex-col justify-between gap-3 rounded-card bg-surface p-4 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-transform group-hover:scale-105",
              ICON_TONE[iconTone],
            )}
            aria-hidden
          >
            {icon}
          </span>
          <span className="truncate text-[13px] font-medium text-text-soft">{label}</span>
        </span>
        {badgeText ? (
          <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", BADGE_TONE[badgeTone])}>
            {badgeText}
          </span>
        ) : null}
      </span>

      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-baseline gap-1">
            <span className="truncate font-display text-[26px] font-semibold leading-none tracking-[-0.03em] text-text">
              {value}
            </span>
            {unit ? <span className="text-xs font-medium text-text-muted">{unit}</span> : null}
          </span>
          <span className="mt-1.5 block truncate text-xs text-text-muted">{sub}</span>
        </span>
        {spark && spark.length >= 2 ? (
          <span className="shrink-0 text-rose-400" aria-hidden>
            <MiniSparkline points={spark} width={64} height={24} />
          </span>
        ) : null}
      </span>

      {progress != null ? (
        <span className="-mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span
            className="block h-full rounded-full bg-gradient-to-r from-brand to-sky-400"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
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
  const heartRate = useVitalsSeries("heart_rate", "week");

  const score = wellness.data?.score;
  const alertCount = alerts.data?.count ?? 0;
  const taken = stats.data?.todayTaken ?? 0;
  const total = stats.data?.todayCount ?? 0;
  const adherencePct =
    total > 0 ? Math.round((taken / total) * 100) : null;
  const next = (appts.data?.appointments ?? [])
    .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
    .sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
  const visitDays = next ? countdownDays(next.startsAt) : null;
  const hrPoints = heartRate.data ? toSeries(heartRate.data.points) : [];
  const hrSpark = hrPoints.map((p) => p.value);
  const lastHr = hrSpark.at(-1);

  return (
    <section aria-label="Health summary" className={cn("anim-rise grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      <Tile
        href="/patient/health" label="Wellness" ariaLabel="Wellness score details"
        icon={<HeartPulse size={16} />} iconTone="brand"
        value={score != null ? String(score) : "—"}
        unit={score != null ? "/ 100" : undefined}
        sub={wellness.data?.level.label ?? "Building rhythm"}
        progress={score ?? null}
      />
      <Tile
        href="/patient/vitals" label="Vitals" ariaLabel="Vitals status details"
        icon={<Activity size={16} />} iconTone="rose"
        value={
          alertCount > 0
            ? `${alertCount} alert${alertCount === 1 ? "" : "s"}`
            : lastHr != null
              ? String(Math.round(lastHr))
              : "Steady"
        }
        unit={alertCount === 0 && lastHr != null ? "bpm" : undefined}
        sub={alertCount > 0 ? "Review readings" : "Vitals steady"}
        spark={hrSpark}
        badgeText={alertCount > 0 ? "Review" : undefined}
        badgeTone="rose"
      />
      <Tile
        href="/patient/medications" label="Adherence" ariaLabel="Medication adherence details"
        icon={<Pill size={16} />} iconTone="emerald"
        value={total > 0 ? `${taken}/${total}` : "—"}
        sub={stats.data?.streakDays ? `${stats.data.streakDays}-day streak` : "Doses today"}
        badgeText={adherencePct != null ? `${adherencePct}%` : undefined}
        badgeTone={
          adherencePct == null ? "muted" :
          adherencePct >= 100 ? "emerald" :
          adherencePct >= 50 ? "amber" : "rose"
        }
      />
      <Tile
        href="/patient/appointments" label="Next visit" ariaLabel="Next visit details"
        icon={<CalendarDays size={16} />} iconTone="amber"
        value={next ? formatDayLabel(next.date) : "None"}
        sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Nothing booked yet"}
        badgeText={
          visitDays == null ? undefined :
          visitDays === 0 ? "Today" :
          visitDays === 1 ? "Tomorrow" : `In ${visitDays}d`
        }
        badgeTone={visitDays === 0 ? "emerald" : "muted"}
      />
    </section>
  );
}
