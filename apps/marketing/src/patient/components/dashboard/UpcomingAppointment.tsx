"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CalendarPlus, MapPin, Stethoscope, Video } from "lucide-react";

import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useAppointments } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { teleconsultApi } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  PANEL,
  PanelHeader,
  PrimaryLink,
} from "@/portal/components/doctor/Workspace";
import { countdownDays } from "@healthcare/shared/visit-lifecycle";

const SECONDARY =
  "inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700";

function CountdownChip({ startsAt }: { startsAt: number }) {
  const days = countdownDays(startsAt);
  const label = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`;
  return (
    <span
      data-testid="countdown-chip"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        days <= 0
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
          : "bg-sky-50 text-sky-700 ring-sky-600/15",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", days <= 0 ? "animate-pulse bg-emerald-500" : "bg-sky-500")}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** Next visit — gradient date block, countdown pill and the join / reschedule actions. */
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
    <section className={cn(PANEL, "relative overflow-hidden", className)} aria-labelledby="pt-next-up">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(420px 180px at 0% 0%, rgba(14,165,233,0.08), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative">
        <PanelHeader
          id="pt-next-up"
          icon={<CalendarDays size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Next up"
          caption="Your upcoming visit"
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
                <EmptyBlock
                  icon={<CalendarDays size={19} />}
                  title="No upcoming appointments"
                  body="Book a consultation and it will show up here with a countdown."
                  actions={
                    <PrimaryLink href="/patient/appointments/book" icon={<CalendarPlus size={13} />}>
                      Book a visit
                    </PrimaryLink>
                  }
                />
              );
            }
            const d = next.date ? new Date(next.date) : null;
            const valid = d && !Number.isNaN(d.getTime());
            const isVideo = next.mode === "video";
            return (
              <div className="mt-5 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-600 px-3 py-2.5 text-white shadow-lg shadow-sky-600/25">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100/80">
                      {valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "—"}
                    </span>
                    <span className="mt-0.5 text-2xl font-bold leading-none tabular-nums">
                      {valid ? d.getDate() : "—"}
                    </span>
                    <span className="mt-1 text-[10.5px] font-medium text-sky-100/90 tabular-nums">
                      {formatTime(next.time)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <CountdownChip startsAt={next.startsAt} />
                    <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
                      {next.doctorName ?? "Doctor"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {next.doctorSpecialization ?? formatDayLabel(next.date)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
                      isVideo ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {isVideo ? <Video size={12} aria-hidden /> : <Stethoscope size={12} aria-hidden />}
                    {isVideo ? "Video" : "In-person"}
                  </span>
                  {next.hospitalName ? (
                    <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      <MapPin size={12} className="shrink-0" aria-hidden />
                      <span className="truncate">{next.hospitalName}</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                  {isVideo && next.isLive && activeSession?.appointmentId === next.id ? (
                    <>
                      <Link href={`/patient/appointments/${next.id}`} className={SECONDARY} data-testid="reschedule-link">
                        Reschedule
                      </Link>
                      <Link
                        href={`/patient/teleconsult/${activeSession.roomId}`}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
                        data-testid="join-call-link"
                      >
                        <Video size={15} aria-hidden />
                        Join call
                      </Link>
                    </>
                  ) : isVideo && (next.bucket === "today" || next.isLive) ? (
                    <>
                      <Link href={`/patient/appointments/${next.id}`} className={SECONDARY} data-testid="reschedule-link">
                        Reschedule
                      </Link>
                      <span
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-500"
                        data-testid="join-waiting-chip"
                      >
                        <Video size={15} aria-hidden />
                        {next.isLive ? "Waiting for doctor" : "Starts soon"}
                      </span>
                    </>
                  ) : (
                    <Link
                      href={`/patient/appointments/${next.id}`}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700"
                      data-testid="reschedule-link"
                    >
                      Manage visit
                      <ArrowRight size={15} aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </section>
  );
}
