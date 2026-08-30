"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  ListOrdered,
  UserCheck,
  Users,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton, ErrorState } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface ScheduleEvent {
  id: string;
  kind: "appointment" | "walkin" | "followup" | "timeoff" | string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
  patientId: string | null;
  patientName: string | null;
  title: string | null;
  queueNumber: number | null;
  priority: string | null;
}

interface ScheduleRangeResponse {
  from: string;
  to: string;
  count: number;
  events: ScheduleEvent[];
}

const KIND_META: Record<
  string,
  {
    icon: typeof CalendarCheck;
    bg: string;
    fg: string;
    border: string;
    label: string;
  }
> = {
  appointment: {
    icon: CalendarCheck,
    bg: "bg-sky-50",
    fg: "text-sky-700",
    border: "border-sky-200",
    label: "Appointment",
  },
  walkin: {
    icon: DoorOpen,
    bg: "bg-amber-50",
    fg: "text-amber-700",
    border: "border-amber-200",
    label: "Walk-in",
  },
  followup: {
    icon: CalendarCheck,
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    border: "border-emerald-200",
    label: "Follow-up",
  },
  timeoff: {
    icon: CalendarOff,
    bg: "bg-rose-50",
    fg: "text-rose-600",
    border: "border-rose-200",
    label: "Time off",
  },
};

function getKindMeta(kind: string) {
  return (
    KIND_META[kind] ?? {
      icon: CalendarCheck,
      bg: "bg-slate-50",
      fg: "text-slate-700",
      border: "border-slate-200",
      label: kind,
    }
  );
}

function isoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function formatTime12(time: string | null) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function StatChip({
  label,
  count,
  tone,
  icon: Icon,
}: {
  label: string;
  count: number;
  tone: "brand" | "sky" | "amber";
  icon: typeof Users;
}) {
  const styles = {
    brand: "bg-sky-50 text-sky-800 border-sky-200",
    sky: "bg-blue-50 text-blue-800 border-blue-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  }[tone];

  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border px-3.5 py-2.5 min-w-0 shadow-2xs bg-white",
        styles,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border border-inherit">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </p>
        <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none mt-0.5">
          {count}
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: ScheduleEvent }) {
  const meta = getKindMeta(event.kind);
  const Icon = meta.icon;
  const timeStr = formatTime12(event.startTime);
  const subtitleParts = [
    event.title,
    event.queueNumber != null ? `Token #${event.queueNumber}` : null,
    event.status,
  ].filter(Boolean);
  const href = event.patientId
    ? `/portal/patients/${event.patientId}/overview`
    : undefined;

  const content = (
    <div className="group flex items-stretch gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs transition-all">
      <div
        className={cn(
          "flex w-16 shrink-0 flex-col items-center justify-center border-r border-slate-200 px-2 py-3",
          meta.bg,
        )}
      >
        {timeStr ? (
          <>
            <span className={cn("text-[10px] font-bold uppercase", meta.fg)}>
              {timeStr.split(" ")[1]}
            </span>
            <span className={cn("text-sm font-extrabold tabular-nums", meta.fg)}>
              {timeStr.split(" ")[0]}
            </span>
          </>
        ) : (
          <Clock size={16} className={meta.fg} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 p-3.5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            meta.bg,
            meta.fg,
            meta.border,
          )}
        >
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border",
                meta.bg,
                meta.fg,
                meta.border,
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="truncate text-sm font-bold text-slate-900">
            {event.patientName ?? "Consultation Encounter"}
          </p>
          {subtitleParts.length > 0 ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {subtitleParts.join(" · ")}
            </p>
          ) : null}
        </div>
        <ArrowRight
          size={15}
          className="shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-sky-600 mr-2"
        />
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function SchedulePage() {
  const t = useT();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.scheduleRange({ from: isoDay(weekStart), to: isoDay(weekEnd) }),
    queryFn: () =>
      api<ScheduleRangeResponse>(
        `/doctor-schedule/range?from=${isoDay(weekStart)}&to=${isoDay(weekEnd)}`,
      ),
  });

  const events = data?.events ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const stats = useMemo(() => {
    let total = events.length;
    let appointments = 0;
    let walkins = 0;
    for (const e of events) {
      if (e.kind === "appointment") appointments++;
      else if (e.kind === "walkin") walkins++;
    }
    return { total, appointments, walkins };
  }, [events]);

  const selectedKey = isoDay(selectedDay);
  const selectedEvents = useMemo(() => {
    const evts = byDay.get(selectedKey) ?? [];
    return evts.sort((a, b) =>
      (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  }, [byDay, selectedKey]);

  const today = new Date();
  const selectedDayLabel = isSameDay(selectedDay, today)
    ? "Today"
    : format(selectedDay, "EEEE, MMM d");

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelectedDay(now);
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Doctor Schedule Hero ──────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Calendar size={12} className="text-sky-300" />
                Clinical Consultation Roster
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Doctor Schedule &amp; Encounters
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                {format(weekStart, "MMMM d")} – {format(weekEnd, "MMMM d, yyyy")} · Comprehensive weekly consultation timeline across booked appointments, walk-ins, and follow-ups.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="flex items-center gap-1 bg-white/15 border border-white/25 rounded-xl p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setAnchor((d) => addWeeks(d, -1))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="px-3 py-1 text-xs font-bold text-white hover:bg-white/20 rounded-lg transition-all cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setAnchor((d) => addWeeks(d, 1))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <Link
                href="/portal/queue"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <ListOrdered size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Live Queue</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Week Encounters
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.total} Total Visits
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <UserCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Appointments
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.appointments} Scheduled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <DoorOpen size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Walk-In Queue
                </p>
                <p className="text-base font-extrabold text-white">
                  {stats.walkins} Walk-Ins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <CalendarCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Selected Day
                </p>
                <p className="text-base font-extrabold text-white">
                  {selectedEvents.length} on {format(selectedDay, "MMM d")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Unified 7-Day Interactive Scroller Card ─────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-4">
        {/* Full-width 7-day selector grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const isSelected = isSameDay(d, selectedDay);
            const isToday = isSameDay(d, today);
            const dayEvents = byDay.get(isoDay(d)) ?? [];
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedDay(d)}
                style={{
                  backgroundColor: isSelected ? "#0284c7" : "#ffffff",
                  borderColor: isSelected ? "#0284c7" : isToday ? "#38bdf8" : "#e2e8f0",
                  color: isSelected ? "#ffffff" : "#0f172a",
                }}
                className={cn(
                  "p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]",
                  isSelected ? "shadow-md" : "hover:bg-slate-50",
                )}
                aria-pressed={isSelected}
              >
                <span
                  style={{ color: isSelected ? "rgba(255,255,255,0.85)" : "#64748b" }}
                  className="text-[11px] font-bold uppercase tracking-wider"
                >
                  {format(d, "EEE")}
                </span>
                <span
                  style={{ color: isSelected ? "#ffffff" : "#0f172a" }}
                  className="text-xl sm:text-2xl font-black tabular-nums leading-none"
                >
                  {format(d, "d")}
                </span>
                <span
                  style={{
                    backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : dayEvents.length > 0 ? "#e0f2fe" : "#f1f5f9",
                    color: isSelected ? "#ffffff" : dayEvents.length > 0 ? "#0369a1" : "#94a3b8",
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold mt-0.5"
                >
                  {dayEvents.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3 Telemetry Summary Chips */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <StatChip
            label="This Week Total"
            count={stats.total}
            tone="brand"
            icon={Users}
          />
          <StatChip
            label="Scheduled Appointments"
            count={stats.appointments}
            tone="sky"
            icon={UserCheck}
          />
          <StatChip
            label="Walk-In Encounters"
            count={stats.walkins}
            tone="amber"
            icon={DoorOpen}
          />
        </div>
      </section>

      {/* ── 3. Day Timeline & Schedule Details ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Week At A Glance Navigation Card */}
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Week At A Glance
            </h3>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
              {stats.total} total
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {days.map((d) => {
              const key = isoDay(d);
              const count = (byDay.get(key) ?? []).length;
              const isSelected = isSameDay(d, selectedDay);
              const isToday = isSameDay(d, today);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-sky-50 border-l-4 border-sky-600 font-bold"
                        : "hover:bg-slate-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-xs truncate",
                          isSelected ? "text-sky-900 font-bold" : "text-slate-700 font-medium",
                        )}
                      >
                        {isToday ? "Today" : format(d, "EEEE")}
                        <span className="text-slate-400 font-normal">
                          {" "}
                          · {format(d, "MMM d")}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums",
                        count > 0
                          ? "bg-sky-100 text-sky-800"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Selected Day Encounters Stage */}
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/40">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck size={17} className="text-sky-600" />
                <span>{selectedDayLabel}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {format(selectedDay, "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <span className="rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-bold text-sky-800 tabular-nums">
              {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 p-5">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : error ? (
              <ErrorState
                retry={
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    Retry loading
                  </Button>
                }
              />
            ) : selectedEvents.length === 0 ? (
              /* Rich Empty State for Selected Day */
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
                  <CalendarCheck size={26} />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    No Events Scheduled for This Day
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {format(selectedDay, "EEEE, MMMM d")} · Your consultation calendar is clear. You can open booking slots, accept patient walk-in arrivals, or view the live clinical queue.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <Link
                    href="/portal/queue"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <ListOrdered size={14} />
                    <span>Live Patient Queue</span>
                  </Link>
                  <Link
                    href="/portal/walk-ins"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <DoorOpen size={14} />
                    <span>Check-In Walk-In</span>
                  </Link>
                  <Link
                    href="/portal/patients"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users size={14} />
                    <span>Patient Registry</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedEvents.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
