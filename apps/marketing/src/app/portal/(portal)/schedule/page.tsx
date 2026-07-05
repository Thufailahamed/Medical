"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Bell,
  Pill,
  CalendarOff,
  Clock,
  Users,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Empty, Skeleton, ErrorState } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Event kind metadata (matches mobile app)                           */
/* ------------------------------------------------------------------ */

const KIND_META: Record<
  string,
  { icon: typeof CalendarCheck; bg: string; fg: string; tag: string }
> = {
  appointment: {
    icon: CalendarCheck,
    bg: "bg-sky-100",
    fg: "text-sky-600",
    tag: "APPT",
  },
  walkin: {
    icon: Bell,
    bg: "bg-amber-100",
    fg: "text-amber-600",
    tag: "WALK",
  },
  followup: {
    icon: Pill,
    bg: "bg-emerald-100",
    fg: "text-emerald-600",
    tag: "F/U",
  },
  timeoff: {
    icon: CalendarOff,
    bg: "bg-rose-100",
    fg: "text-rose-500",
    tag: "OFF",
  },
};

function getKindMeta(kind: string) {
  return (
    KIND_META[kind] ?? {
      icon: CalendarCheck,
      bg: "bg-surface-2",
      fg: "text-text-soft",
      tag: kind.toUpperCase().slice(0, 4),
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Status colors                                                      */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  completed: "text-emerald-600",
  cancelled: "text-rose-500",
  no_show: "text-amber-600",
  in_progress: "text-sky-600",
  confirmed: "text-emerald-600",
  scheduled: "text-text-soft",
};

function statusColor(status: string | null) {
  return STATUS_COLORS[status ?? ""] ?? "text-text-muted";
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Pulse tile (stat card)                                             */
/* ------------------------------------------------------------------ */

function PulseTile({
  label,
  count,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: typeof Users;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3",
        color
      )}
    >
      <Icon size={18} className="opacity-80" />
      <div>
        <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">
          {label}
        </div>
        <div className="text-2xl font-extrabold tabular-nums leading-none mt-0.5">
          {count}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Day event card                                                     */
/* ------------------------------------------------------------------ */

function EventCard({ event }: { event: ScheduleEvent }) {
  const meta = getKindMeta(event.kind);
  const Icon = meta.icon;
  const timeStr = formatTime12(event.startTime);

  const subtitleParts = [
    event.title,
    event.queueNumber != null ? `#${event.queueNumber}` : null,
    event.status,
  ].filter(Boolean);

  const href = event.patientId
    ? `/patients/${event.patientId}`
    : undefined;

  const content = (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:shadow-md transition-all duration-150 cursor-pointer group">
      {/* Icon box */}
      <div
        className={cn(
          "w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0",
          meta.bg
        )}
      >
        <Icon size={20} className={meta.fg} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: kind tag + time */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase tracking-wider",
              meta.fg
            )}
          >
            {meta.tag}
          </span>
          {timeStr && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <Clock size={10} />
              {timeStr}
            </span>
          )}
        </div>

        {/* Patient name */}
        <div className="text-[15px] font-bold text-text truncate leading-tight">
          {event.patientName ?? "Unknown patient"}
        </div>

        {/* Subtitle */}
        {subtitleParts.length > 0 && (
          <div className="text-[11px] text-text-muted mt-0.5 truncate">
            {subtitleParts.join(" · ")}
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={16}
        className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SchedulePage() {
  const t = useT();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.scheduleRange({
      from: isoDay(weekStart),
      to: isoDay(weekEnd),
    }),
    queryFn: () =>
      api<ScheduleRangeResponse>(
        `/doctor-schedule/range?from=${isoDay(weekStart)}&to=${isoDay(weekEnd)}`
      ),
  });

  const events = data?.events ?? [];

  // Events by day
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const d = e.date;
      const arr = map.get(d) ?? [];
      arr.push(e);
      map.set(d, arr);
    }
    return map;
  }, [events]);

  // Stats for the week
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

  // Events for selected day
  const selectedKey = isoDay(selectedDay);
  const selectedEvents = useMemo(() => {
    const evts = byDay.get(selectedKey) ?? [];
    return evts.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }, [byDay, selectedKey]);

  const today = new Date();
  const isThisWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 }));

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Header ---- */}
      <div>
        <h1 className="text-2xl font-bold text-text tracking-tight">
          {t("schedule.title")}
        </h1>
        <p className="text-sm text-text-soft mt-1">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </p>
      </div>

      {/* ---- Week navigation ---- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setAnchor((d) => addWeeks(d, -1))}
          className="h-9 w-9 rounded-xl border border-border bg-surface flex items-center justify-center hover:bg-surface-2 transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} className="text-text-soft" />
        </button>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl"
          onClick={() => {
            setAnchor(new Date());
            setSelectedDay(new Date());
          }}
        >
          {t("schedule.today")}
        </Button>
        <button
          type="button"
          onClick={() => setAnchor((d) => addWeeks(d, 1))}
          className="h-9 w-9 rounded-xl border border-border bg-surface flex items-center justify-center hover:bg-surface-2 transition-colors"
          aria-label="Next week"
        >
          <ChevronRight size={16} className="text-text-soft" />
        </button>
      </div>

      {/* ---- Day strip ---- */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const isSelected = isSameDay(d, selectedDay);
          const isToday = isSameDay(d, today);
          const dayEvents = byDay.get(isoDay(d)) ?? [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[52px] py-2.5 px-2 rounded-2xl transition-all duration-150",
                isSelected
                  ? "bg-brand text-white shadow-[var(--shadow-primary)]"
                  : isToday
                    ? "bg-brand-soft text-brand"
                    : "bg-surface border border-border text-text hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase font-bold tracking-wider",
                  isSelected ? "text-white/70" : "text-text-muted"
                )}
              >
                {format(d, "EEE")}
              </span>
              <span
                className={cn(
                  "text-lg font-extrabold leading-none",
                  isSelected ? "text-white" : "text-text"
                )}
              >
                {format(d, "d")}
              </span>
              {hasEvents && (
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-0.5",
                    isSelected ? "bg-white/70" : "bg-brand"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ---- Pulse strip (stats) ---- */}
      <div className="grid grid-cols-3 gap-3">
        <PulseTile
          label={t("schedule.thisWeek")}
          count={stats.total}
          color="bg-brand-soft text-brand"
          icon={Users}
        />
        <PulseTile
          label={t("schedule.appointment")}
          count={stats.appointments}
          color="bg-sky-100 text-sky-700"
          icon={UserCheck}
        />
        <PulseTile
          label={t("schedule.walkIn")}
          count={stats.walkins}
          color="bg-amber-100 text-amber-700"
          icon={AlertTriangle}
        />
      </div>

      {/* ---- Day event list ---- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase font-extrabold tracking-[0.12em] text-text-muted">
            {isSameDay(selectedDay, today)
              ? t("schedule.today")
              : `Day of, ${format(selectedDay, "EEEE, MMM d")}`}
          </h2>
          <span className="text-xs text-text-muted font-medium">
            {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <ErrorState
            retry={
              <Button size="sm" variant="secondary" onClick={() => refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : selectedEvents.length === 0 ? (
          <Empty
            icon={<CalendarCheck size={24} />}
            title={t("schedule.noSlots")}
            description={`${format(selectedDay, "EEEE, MMMM d")} — ${t("schedule.subtitle")}`}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {selectedEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
