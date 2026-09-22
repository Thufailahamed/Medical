"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Video } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { teleconsultApi } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

function CountdownChip({ date }: { date: string }) {
  const days = Math.max(
    0,
    Math.ceil(
      (new Date(date).getTime() - new Date(new Date().toDateString()).getTime()) /
        86_400_000,
    ),
  );
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`;
  return (
    <span
      data-testid="countdown-chip"
      className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand"
    >
      {label}
    </span>
  );
}

export function UpcomingAppointment({ className }: { className?: string }) {
  const query = useAppointments();
  const [activeSession, setActiveSession] = useState<{
    roomId: string;
    appointmentId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await teleconsultApi.getActiveForMe();
        if (!cancelled) setActiveSession(res.session);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Card accent="sky" className={cn("anim-rise", className)}>
      <CardHeader
        title="Next up"
        caption="Upcoming visit"
        icon={<CalendarDays size={15} />}
        href="/patient/appointments"
        linkLabel="All appointments"
      />

      <QueryBoundary
        query={query}
        emptyTitle="No upcoming appointments"
        emptyDescription="When your doctor schedules a visit, it'll show here."
        className="mt-4"
      >
        {(data) => {
          const next = (data.appointments ?? [])
            .filter((a) => new Date(a.date) >= new Date(new Date().toDateString()))
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
          if (!next) {
            return (
              <p className="mt-4 text-sm text-text-soft">No upcoming appointments</p>
            );
          }
          return (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="t-card-title">
                    {formatDayLabel(next.date)}{" "}
                    <span className="text-text-soft">·</span>{" "}
                    {formatTime(next.time)}
                  </p>
                  <p className="mt-1 text-sm text-text-soft">
                    {next.doctorName ?? "Doctor"}{" "}
                    {next.doctorSpecialization ? (
                      <span className="text-text-muted">
                        · {next.doctorSpecialization}
                      </span>
                    ) : null}
                  </p>
                  {next.hospitalName ? (
                    <p className="mt-1 text-xs text-text-muted">
                      {next.hospitalName}
                    </p>
                  ) : null}
                </div>
                <CountdownChip date={next.date} />
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={next.mode === "video" ? "brand" : "neutral"}>
                  {next.mode === "video" ? "Video" : "In-person"}
                </Pill>
                {next.mode === "video" ? (
                  <Link
                    href={`/patient/teleconsult/${
                      activeSession?.appointmentId === next.id
                        ? activeSession.roomId
                        : "__pending__"
                    }`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-violet-600"
                    data-testid="join-call-link"
                  >
                    <Video size={13} />
                    Join Call
                  </Link>
                ) : null}
                <Link
                  href={`/patient/appointments/${next.id}/reschedule`}
                  className="text-[11px] font-bold text-text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                  data-testid="reschedule-link"
                >
                  Reschedule
                </Link>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}
