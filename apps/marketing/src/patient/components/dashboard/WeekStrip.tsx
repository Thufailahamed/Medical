"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";

import { useAppointments, useHealthSummary } from "@/patient/hooks";
import { formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { PANEL, PanelHeader } from "@/portal/components/doctor/Workspace";

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
    <section className={cn(PANEL, className)} aria-labelledby="pt-week">
      <PanelHeader
        id="pt-week"
        icon={<CalendarRange size={16} />}
        tone="bg-amber-50 text-amber-600"
        title="This week"
        caption="Tap a day to see visits"
        href="/patient/appointments"
        linkLabel="Calendar"
      />
      <div className="mt-4 grid grid-cols-7 gap-1 rounded-xl bg-slate-50 p-1.5">
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
                "flex flex-col items-center gap-1 rounded-lg py-2 transition-all",
                active
                  ? "bg-[#07233a] text-white shadow-lg shadow-slate-900/20"
                  : isToday
                    ? "bg-white text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                    : "text-slate-600 hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  active ? "text-sky-200" : "text-slate-400",
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
                  hasAppt ? (active ? "bg-teal-300" : "bg-sky-500") : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {dayAppts.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {dayAppts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/patient/appointments/${a.id}`}
                  className="group flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs transition-colors hover:bg-sky-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                    <span className="truncate font-semibold text-slate-900 group-hover:text-sky-700">
                      {a.doctorName ?? "Appointment"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-500">
                    {formatTime(a.time)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
            No visits {selected === todayKey ? "today" : "on this day"} ·{" "}
            <span className="font-semibold text-slate-700">
              {summary.data?.alerts?.count ?? 0}
            </span>{" "}
            vitals alerts this week
          </p>
        )}
      </div>
    </section>
  );
}
