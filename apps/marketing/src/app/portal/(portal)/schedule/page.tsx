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
  CalendarClock,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  ListOrdered,
  Repeat,
  Users,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton, ErrorState } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PrimaryLink,
  SecondaryLink,
} from "@/portal/components/doctor/Workspace";

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
    dot: string;
    label: string;
  }
> = {
  appointment: {
    icon: CalendarCheck,
    bg: "bg-sky-50",
    fg: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
    label: "Appointment",
  },
  walkin: {
    icon: DoorOpen,
    bg: "bg-amber-50",
    fg: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "Walk-in",
  },
  followup: {
    icon: Repeat,
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Follow-up",
  },
  timeoff: {
    icon: CalendarOff,
    bg: "bg-rose-50",
    fg: "text-rose-600",
    border: "border-rose-200",
    dot: "bg-rose-400",
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
      dot: "bg-slate-400",
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

function EventRow({ event, isLast }: { event: ScheduleEvent; isLast: boolean }) {
  const meta = getKindMeta(event.kind);
  const Icon = meta.icon;
  const start = formatTime12(event.startTime);
  const end = formatTime12(event.endTime);
  const subtitleParts = [
    event.title,
    event.queueNumber != null ? `Token #${event.queueNumber}` : null,
  ].filter(Boolean);
  const href = event.patientId ? `/portal/patients/${event.patientId}/overview` : undefined;

  const card = (
    <div
      className={cn(
        "group flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-50 p-3.5 transition-all",
        href && "hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_-10px_rgba(15,23,42,0.2),inset_0_0_0_1px_rgba(15,23,42,0.07)]",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", meta.bg, meta.fg)} aria-hidden>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">
            {event.patientName ?? (event.kind === "timeoff" ? "Unavailable" : "Consultation")}
          </p>
          <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", meta.bg, meta.fg)}>
            {meta.label}
          </span>
        </div>
        {subtitleParts.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{subtitleParts.join(" · ")}</p>
        ) : null}
      </div>
      {event.status ? (
        <span className="hidden shrink-0 rounded-md bg-white px-2 py-1 text-[11px] font-medium capitalize text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] sm:inline">
          {event.status.replace(/_/g, " ")}
        </span>
      ) : null}
      {href ? (
        <ArrowRight
          size={15}
          className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-sky-600"
          aria-hidden
        />
      ) : null}
    </div>
  );

  return (
    <li className="flex gap-4">
      {/* Time rail */}
      <div className="w-16 shrink-0 pt-3 text-right">
        {start ? (
          <>
            <div className="text-sm font-semibold tabular-nums text-slate-900">{start}</div>
            {end ? <div className="text-[11px] tabular-nums text-slate-400">{end}</div> : null}
          </>
        ) : (
          <Clock size={14} className="ml-auto text-slate-300" aria-hidden />
        )}
      </div>
      <div className="relative flex flex-col items-center" aria-hidden>
        <span className={cn("mt-4 h-2.5 w-2.5 rounded-full ring-4 ring-white", meta.dot)} />
        {!isLast ? <span className="w-px flex-1 bg-slate-200" /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-3">
        {href ? <Link href={href} className="flex">{card}</Link> : card}
      </div>
    </li>
  );
}

export default function SchedulePage() {
  const t = useT();
  void t;
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
    const total = events.length;
    let appointments = 0;
    let walkins = 0;
    let followups = 0;
    let timeoff = 0;
    for (const e of events) {
      if (e.kind === "appointment") appointments++;
      else if (e.kind === "walkin") walkins++;
      else if (e.kind === "followup") followups++;
      else if (e.kind === "timeoff") timeoff++;
    }
    return { total, appointments, walkins, followups, timeoff };
  }, [events]);

  const busiest = useMemo(() => {
    let best: { day: Date; count: number } | null = null;
    for (const d of days) {
      const c = (byDay.get(isoDay(d)) ?? []).length;
      if (c > 0 && (!best || c > best.count)) best = { day: d, count: c };
    }
    return best;
  }, [days, byDay]);
  const maxPerDay = busiest?.count ?? 0;

  const selectedKey = isoDay(selectedDay);
  const selectedEvents = useMemo(() => {
    const evts = [...(byDay.get(selectedKey) ?? [])];
    return evts.sort((a, b) =>
      (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  }, [byDay, selectedKey]);

  const today = new Date();
  const isThisWeek = isSameDay(startOfWeek(today, { weekStartsOn: 1 }), weekStart);
  const selectedDayLabel = isSameDay(selectedDay, today)
    ? "Today"
    : format(selectedDay, "EEEE");

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelectedDay(now);
  }

  function shiftWeek(delta: number) {
    setAnchor((d) => addWeeks(d, delta));
    setSelectedDay((d) => addWeeks(d, delta));
  }

  const breakdown = [
    { key: "appointment", label: "Appointments", count: stats.appointments },
    { key: "walkin", label: "Walk-ins", count: stats.walkins },
    { key: "followup", label: "Follow-ups", count: stats.followups },
    { key: "timeoff", label: "Time off", count: stats.timeoff },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      {/* ── Hero + week strip ─────────────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Calendar size={13} aria-hidden />}
          kicker="Schedule"
          kickerMeta={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
          title={isThisWeek ? "This week" : `Week of ${format(weekStart, "MMMM d")}`}
          description={
            isLoading
              ? "Loading your week…"
              : stats.total > 0
                ? `${stats.total} encounter${stats.total === 1 ? "" : "s"} across the week${busiest ? ` — busiest on ${format(busiest.day, "EEEE")}` : ""}.`
                : "Nothing booked this week yet. Open slots or check in walk-ins as they arrive."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
                {stats.appointments} appointment{stats.appointments === 1 ? "" : "s"}
              </span>
              <span className={HERO_CHIP}>
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                {stats.walkins} walk-in{stats.walkins === 1 ? "" : "s"}
              </span>
              {stats.followups > 0 ? (
                <span className={HERO_CHIP}>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                  {stats.followups} follow-up{stats.followups === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <div className="flex h-10 items-center gap-0.5 rounded-[10px] border border-white/20 bg-white/[0.06] p-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/15"
                  aria-label="Previous week"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  disabled={isThisWeek && isSameDay(selectedDay, today)}
                  className="h-8 rounded-lg px-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/15"
                  aria-label="Next week"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <Link href="/portal/queue" className={HERO_PRIMARY}>
                <ListOrdered size={15} className="text-sky-600" aria-hidden />
                Live queue
              </Link>
            </>
          }
        />

        <HeroOverlap>
          <div className="grid grid-cols-7 gap-1.5 rounded-2xl bg-white p-2 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(15,23,42,0.07)] sm:gap-2 sm:p-3">
            {days.map((d) => {
              const isSelected = isSameDay(d, selectedDay);
              const isToday = isSameDay(d, today);
              const count = (byDay.get(isoDay(d)) ?? []).length;
              const fill = maxPerDay > 0 ? Math.max(12, Math.round((count / maxPerDay) * 100)) : 0;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  aria-pressed={isSelected}
                  aria-label={`${format(d, "EEEE, MMMM d")}: ${count} event${count === 1 ? "" : "s"}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 transition-all sm:py-3",
                    isSelected
                      ? "bg-sky-600 text-white shadow-[0_10px_24px_-10px_rgba(2,132,199,0.7)]"
                      : isToday
                        ? "bg-sky-50 text-sky-700 hover:bg-sky-100"
                        : "text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold uppercase tracking-wider",
                      isSelected ? "text-white/75" : isToday ? "text-sky-600" : "text-slate-400",
                    )}
                  >
                    {format(d, "EEE")}
                  </span>
                  <span className="text-xl font-semibold leading-none tabular-nums sm:text-2xl">
                    {format(d, "d")}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 h-1 w-8 overflow-hidden rounded-full",
                      isSelected ? "bg-white/25" : "bg-slate-100",
                    )}
                    aria-hidden
                  >
                    <span
                      className={cn("block h-full rounded-full", isSelected ? "bg-white" : "bg-sky-500")}
                      style={{ width: `${fill}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      isSelected ? "text-white/85" : count > 0 ? "font-medium text-slate-600" : "text-slate-300",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "xl:col-span-8")} aria-labelledby="sched-day">
          <PanelHeader
            id="sched-day"
            icon={<CalendarCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={selectedDayLabel}
            caption={format(selectedDay, "EEEE, MMMM d, yyyy")}
            action={
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
                {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}
              </span>
            }
          />

          {isLoading ? (
            <div className="mt-5 flex flex-col gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="mt-5">
              <ErrorState
                retry={
                  <Button size="sm" variant="secondary" onClick={() => refetch()}>
                    Retry loading
                  </Button>
                }
              />
            </div>
          ) : selectedEvents.length === 0 ? (
            <EmptyBlock
              className="py-12"
              icon={<CalendarClock size={20} />}
              title={`Nothing scheduled ${isSameDay(selectedDay, today) ? "today" : `on ${format(selectedDay, "EEEE")}`}`}
              body="Your calendar is clear for this day. Take walk-ins from the live queue or book a follow-up from a patient's chart."
              actions={
                <>
                  <PrimaryLink href="/portal/queue" icon={<ListOrdered size={13} />}>
                    Live queue
                  </PrimaryLink>
                  <SecondaryLink href="/portal/walk-ins" icon={<DoorOpen size={13} />}>
                    Check in walk-in
                  </SecondaryLink>
                </>
              }
            />
          ) : (
            <ol className="mt-5">
              {selectedEvents.map((e, i) => (
                <EventRow key={e.id} event={e} isLast={i === selectedEvents.length - 1} />
              ))}
            </ol>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5 xl:col-span-4" aria-label="Week summary">
          <section className={PANEL} aria-labelledby="sched-week">
            <PanelHeader
              id="sched-week"
              icon={<Users size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Week summary"
              caption={`${stats.total} encounter${stats.total === 1 ? "" : "s"} in total`}
            />
            <ul className="mt-5 flex flex-col gap-3.5">
              {breakdown.map((b) => {
                const meta = getKindMeta(b.key);
                const pct = stats.total > 0 ? Math.round((b.count / stats.total) * 100) : 0;
                return (
                  <li key={b.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-600">
                        <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
                        {b.label}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900">{b.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <div className={cn("h-full rounded-full", meta.dot)} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-xs">
              <span className="text-slate-500">Busiest day</span>
              <span className="font-semibold text-slate-900">
                {busiest ? `${format(busiest.day, "EEEE")} · ${busiest.count}` : "—"}
              </span>
            </div>
          </section>

          <section className={PANEL} aria-labelledby="sched-links">
            <h2 id="sched-links" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
              Manage availability
            </h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {[
                { href: "/portal/availability", label: "Working hours & slots", icon: Clock },
                { href: "/portal/appointments", label: "All appointments", icon: CalendarCheck },
                { href: "/portal/follow-ups", label: "Follow-ups due", icon: Repeat },
                { href: "/portal/walk-ins", label: "Walk-in desk", icon: DoorOpen },
              ].map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <Icon size={15} className="text-slate-400 group-hover:text-sky-600" aria-hidden />
                      <span className="flex-1">{l.label}</span>
                      <ChevronRight size={15} className="text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
