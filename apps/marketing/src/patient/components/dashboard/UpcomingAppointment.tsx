"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, MapPin, Video } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { teleconsultApi } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { countdownDays } from "@healthcare/shared/visit-lifecycle";

function CountdownChip({ startsAt }: { startsAt: number }) {
  const days = countdownDays(startsAt);
  const label = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`;
  return (
    <span
      data-testid="countdown-chip"
      className="shrink-0 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand"
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
        caption="Your upcoming visit"
        icon={<CalendarDays size={16} />}
        href="/patient/appointments"
        linkLabel="All"
      />

      <QueryBoundary
        query={query}
        emptyTitle="No upcoming appointments"
        emptyDescription="When your doctor schedules a visit, it'll show here."
        className="mt-4"
      >
        {(data) => {
          const next = (data.appointments ?? [])
            .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
            .sort((a, b) => a.startsAt - b.startsAt)[0];
          if (!next) {
            return (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3.5">
                <p className="text-sm text-text-soft">No upcoming appointments</p>
                <Link
                  href="/patient/appointments/book"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  <CalendarPlus size={13} aria-hidden />
                  Book
                </Link>
              </div>
            );
          }
          const d = next.date ? new Date(next.date) : null;
          const valid = d && !Number.isNaN(d.getTime());
          return (
            <div className="mt-4 flex flex-col gap-3.5">
              <div className="flex items-start gap-3.5">
                <div className="grid w-14 shrink-0 overflow-hidden rounded-xl bg-surface text-center shadow-[inset_0_0_0_1px_rgba(19,32,68,0.1)]">
                  <span className="bg-brand py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    {valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "—"}
                  </span>
                  <span className="py-1.5 font-display text-xl font-semibold leading-none text-text">
                    {valid ? d.getDate() : "—"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-text">
                      {next.doctorName ?? "Doctor"}
                    </p>
                    <CountdownChip startsAt={next.startsAt} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-soft">
                    {formatDayLabel(next.date)} · {formatTime(next.time)}
                    {next.doctorSpecialization ? ` · ${next.doctorSpecialization}` : ""}
                  </p>
                  {next.hospitalName ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">
                      <MapPin size={11} aria-hidden />
                      {next.hospitalName}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Pill tone={next.mode === "video" ? "brand" : "neutral"}>
                  {next.mode === "video" ? "Video" : "In-person"}
                </Pill>
                {next.mode === "video" &&
                next.isLive &&
                activeSession?.appointmentId === next.id ? (
                  <Link
                    href={`/patient/teleconsult/${activeSession.roomId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-violet-600"
                    data-testid="join-call-link"
                  >
                    <Video size={13} />
                    Join Call
                  </Link>
                ) : next.mode === "video" && (next.bucket === "today" || next.isLive) ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-soft"
                    data-testid="join-waiting-chip"
                  >
                    <Video size={13} />
                    {next.isLive ? "Waiting for doctor" : "Starts soon"}
                  </span>
                ) : null}
                <Link
                  href={`/patient/appointments/${next.id}/reschedule`}
                  className="ml-auto text-xs font-semibold text-text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
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
