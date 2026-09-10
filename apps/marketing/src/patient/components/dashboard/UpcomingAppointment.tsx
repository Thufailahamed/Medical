"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
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
