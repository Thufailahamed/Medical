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

/**
 * Week strip with day selection that surfaces that day's appointments.
 */
export function WeekStrip({ className }: { className?: string }) {
  const summary = useHealthSummary();
  const appointments = useAppointments();
  const days = useMemo(() => buildWeekDays(), []);
  const todayKey = new Date().toISOString().slice(0, 10);
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
      <div className="px-5 pb-2 pt-5">
        <CardHeader
          title="This week"
          caption="Your schedule"
          icon={<CalendarRange size={15} />}
          href="/patient/appointments"
          linkLabel="Calendar"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-4">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const active = key === selected;
          const isToday = key === todayKey;
          const hasAppt = apptDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "flex min-w-[52px] flex-1 flex-col items-center gap-1 px-2 py-2.5 transition-colors",
                active
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-text-soft hover:bg-surface-3",
              )}
              style={{ borderRadius: 16 }}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  active ? "text-white/80" : "text-text-muted",
                )}
              >
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-base font-bold leading-none">
                {d.getDate()}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hasAppt
                    ? active
                      ? "bg-white"
                      : "bg-brand"
                    : isToday && !active
                      ? "bg-brand/40"
                      : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="border-t border-surface-3 px-5 py-3">
        {dayAppts.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {dayAppts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/patient/appointments/${a.id}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate font-semibold text-text">
                    {a.doctorName ?? "Appointment"}
                  </span>
                  <span className="shrink-0 text-text-soft">
                    {formatTime(a.time)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-soft">
            No visits on this day ·{" "}
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
