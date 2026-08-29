"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export function UpcomingAppointment({ className }: { className?: string }) {
  const query = useAppointments();
  return (
    <Card className={cn("anim-rise", className)}>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center bg-brand-soft text-brand"
            style={{ borderRadius: 12 }}
            aria-hidden
          >
            <CalendarDays size={16} />
          </span>
          <p className="t-label">Next up</p>
        </div>
        <Link
          href="/patient/appointments"
          className="text-xs font-semibold text-brand hover:text-brand-strong"
        >
          All appointments
        </Link>
      </div>

      <QueryBoundary
        query={query as any}
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
              <p className="text-sm text-text-soft">No upcoming appointments</p>
            );
          }
          return (
            <div className="mt-1 flex flex-col gap-3">
              <div>
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
              <div>
                <Pill tone={next.mode === "video" ? "brand" : "neutral"}>
                  {next.mode === "video" ? "Video" : "In-person"}
                </Pill>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}
