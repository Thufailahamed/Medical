"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { useAppointments, useHealthSummary } from "@/patient/hooks";
import { formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function buildWeekDays(anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Local-calendar YYYY-MM-DD (toISOString would shift the day across UTC). */
function localKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Week strip with day selection that surfaces that day's appointments.
 */
export function WeekStrip({ className }: { className?: string }) {
  const summary = useHealthSummary();
  const appointments = useAppointments();
  const days = useMemo(() => buildWeekDays(), []);
  const todayKey = localKey(new Date());
  const [selected, setSelected] = useState(todayKey);

  const dayAppts = useMemo(() => {
    return (appointments.data?.appointments ?? [])
      .filter((a) => (a.date ?? "").slice(0, 10) === selected)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments.data?.appointments, selected]);

  const apptDays = useMemo(() => {
    const set = new Set<string>();
    for (const a of appointments.data?.appointments ?? []) {
      if (a.date) set.add(a.date.slice(0, 10));
    }
    return set;
  }, [appointments.data?.appointments]);

  return (
    <Card
      accent="amber"
      className={cn("anim-rise anim-rise-delay-1", className)}
      padded={false}
    >
      <div className="px-5 pb-4 pt-5">
        <CardHeader
          title="This week"
          caption="Tap a day to see visits"
          icon={<CalendarRange size={16} />}
          href="/patient/appointments"
          linkLabel="Calendar"
        />
      </div>
      <div className="grid grid-cols-7 gap-1 px-4 pb-4">
        {days.map((d) => {
          const key = localKey(d);
          const active = key === selected;
          const isToday = key === todayKey;
          const hasAppt = apptDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={active}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors",
                active
                  ? "bg-brand text-white shadow-brand"
                  : isToday
                    ? "bg-brand-soft text-brand"
                    : "text-text-soft hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  active ? "text-white/75" : "text-text-muted",
                )}
              >
                {d.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
              <span className="text-[15px] font-semibold leading-none">
                {d.getDate()}
              </span>
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  hasAppt ? (active ? "bg-white" : "bg-brand") : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="border-t border-border px-5 py-3.5">
        {dayAppts.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {dayAppts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/patient/appointments/${a.id}`}
                  className="flex items-center justify-between gap-2 text-xs hover:text-brand"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span className="truncate font-semibold text-text">
                      {a.doctorName ?? "Appointment"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-text-soft">
                    {formatTime(a.time)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted">
            No visits {selected === todayKey ? "today" : "on this day"} ·{" "}
            <span className="font-semibold text-text">
              {summary.data?.alerts?.count ?? 0}
            </span>{" "}
            vitals alerts this week
          </p>
        )}
      </div>
    </Card>
  );
}
