"use client";

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
import { StatTile } from "@/portal/components/doctor/Workspace";
import { countdownDays } from "@healthcare/shared/visit-lifecycle";
import { MiniSparkline } from "./MiniSparkline";

/**
 * Four glanceable tiles that float over the hero's bottom edge — the
 * same `StatTile` the doctor and admin dashboards use.
 */
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
  const streak = stats.data?.streakDays ?? 0;
  const adherencePct = total > 0 ? Math.round((taken / total) * 100) : null;
  const next = (appts.data?.appointments ?? [])
    .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
    .sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
  const visitDays = next ? countdownDays(next.startsAt) : null;
  const hrSpark = heartRate.data ? toSeries(heartRate.data.points).map((p) => p.value) : [];
  const lastHr = hrSpark.at(-1);

  return (
    <section aria-label="Health summary" className={cn("grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      <StatTile
        href="/patient/health"
        label="Wellness"
        icon={<HeartPulse size={16} />}
        tone="bg-sky-50 text-sky-600"
        value={score != null ? String(score) : "—"}
        unit={score != null ? "/ 100" : undefined}
        sub={wellness.data?.level.label ?? "Building rhythm"}
        progress={score ?? null}
      />
      <StatTile
        href="/patient/vitals"
        label="Vitals"
        icon={<Activity size={16} />}
        tone="bg-rose-50 text-rose-600"
        value={
          alertCount > 0
            ? String(alertCount)
            : lastHr != null
              ? String(Math.round(lastHr))
              : "—"
        }
        unit={alertCount > 0 ? (alertCount === 1 ? "alert" : "alerts") : lastHr != null ? "bpm" : undefined}
        sub={alertCount > 0 ? "Review readings" : lastHr != null ? "Vitals steady" : "No readings this week"}
        badge={alertCount > 0 ? { text: "Review", tone: "bg-rose-50 text-rose-700" } : undefined}
        pulse={alertCount > 0}
        chart={
          hrSpark.length >= 2 ? (
            <span className="text-rose-400">
              <MiniSparkline points={hrSpark} width={64} height={28} />
            </span>
          ) : undefined
        }
      />
      <StatTile
        href="/patient/medications"
        label="Adherence"
        icon={<Pill size={16} />}
        tone="bg-emerald-50 text-emerald-600"
        value={total > 0 ? `${taken}/${total}` : "—"}
        unit={total > 0 ? "doses" : undefined}
        sub={streak > 0 ? `${streak}-day streak` : total > 0 ? "Doses today" : "No fixed doses today"}
        badge={
          adherencePct != null
            ? {
                text: `${adherencePct}%`,
                tone:
                  adherencePct >= 100
                    ? "bg-emerald-50 text-emerald-700"
                    : adherencePct >= 50
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700",
              }
            : undefined
        }
        progress={adherencePct}
      />
      <StatTile
        href={next ? "/patient/appointments" : "/patient/appointments/book"}
        label="Next visit"
        icon={<CalendarDays size={16} />}
        tone="bg-amber-50 text-amber-600"
        value={next ? formatDayLabel(next.date) : "—"}
        sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Nothing booked · book a visit"}
        badge={
          visitDays == null
            ? undefined
            : {
                text: visitDays <= 0 ? "Today" : visitDays === 1 ? "Tomorrow" : `In ${visitDays}d`,
                tone: visitDays <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
              }
        }
      />
    </section>
  );
}
