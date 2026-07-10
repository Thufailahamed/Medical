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
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Bell,
  CalendarOff,
  Clock,
  Users,
  UserCheck,
  AlertTriangle,
  Calendar,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton, ErrorState } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
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
  { icon: typeof CalendarCheck; bg: string; fg: string; tag: string }
> = {
  appointment: { icon: CalendarCheck, bg: "bg-sky-50", fg: "text-sky-600", tag: "APPT" },
  walkin: { icon: Bell, bg: "bg-amber-50", fg: "text-amber-600", tag: "WALK" },
  followup: { icon: CalendarCheck, bg: "bg-emerald-50", fg: "text-emerald-600", tag: "F/U" },
  timeoff: { icon: CalendarOff, bg: "bg-rose-50", fg: "text-rose-500", tag: "OFF" },
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

function StatTile({
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
  const toneClass = {
    brand: "border-brand/20 bg-brand-soft/40 text-brand",
    sky: "border-sky-200/60 bg-sky-50 text-sky-700",
    amber: "border-amber-200/60 bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className={cn("rounded-2xl border px-4 py-3.5", toneClass)}>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold opacity-80 truncate">
            {label}
          </div>
          <div className="text-2xl font-extrabold tabular-nums leading-none mt-0.5">
            {count}
          </div>
        </div>
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
    event.queueNumber != null ? `#${event.queueNumber}` : null,
    event.status,
  ].filter(Boolean);
  const href = event.patientId
    ? `/portal/patients/${event.patientId}`
    : undefined;

  const content = (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/70 bg-white hover:shadow-sm hover:border-border transition-all duration-200 group">
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          meta.bg
        )}
      >
        <Icon size={18} className={meta.fg} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-[10px] font-extrabold uppercase tracking-wider", meta.fg)}>
            {meta.tag}
          </span>
          {timeStr ? (
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <Clock size={10} />
              {timeStr}
            </span>
          ) : null}
        </div>
        <div className="text-sm font-bold text-text truncate leading-tight">
          {event.patientName ?? "Unknown patient"}
        </div>
        {subtitleParts.length > 0 ? (
          <div className="text-[11px] text-text-muted mt-0.5 truncate">
            {subtitleParts.join(" · ")}
          </div>
        ) : null}
      </div>
      <ChevronRight
        size={16}
        className="text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function SchedulePage() {
  const t = useT();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.scheduleRange({ from: isoDay(weekStart), to: isoDay(weekEnd) }),
    queryFn: () =>
      api<ScheduleRangeResponse>(
        `/doctor-schedule/range?from=${isoDay(weekStart)}&to=${isoDay(weekEnd)}`
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
    return evts.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }, [byDay, selectedKey]);

  const today = new Date();
  const selectedDayLabel = isSameDay(selectedDay, today)
    ? t("schedule.today")
    : format(selectedDay, "EEEE, MMM d");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("schedule.title")}
        subtitle={`${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
        icon={<Calendar size={18} className="text-brand" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnchor((d) => addWeeks(d, -1))}
              className="h-9 w-9 rounded-xl border border-border/80 bg-white flex items-center justify-center hover:bg-surface-2 transition-colors"
              aria-label={t("schedule.prev")}
            >
              <ChevronLeft size={16} className="text-text-soft" />
            </button>
            <Button
              size="sm"
              variant="secondary"
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
              className="h-9 w-9 rounded-xl border border-border/80 bg-white flex items-center justify-center hover:bg-surface-2 transition-colors"
              aria-label={t("schedule.next")}
            >
              <ChevronRight size={16} className="text-text-soft" />
            </button>
          </div>
        }
      />

      <Card padding={false} className="overflow-hidden">
        <div className="p-3 md:p-4 flex gap-1.5 overflow-x-auto">
          {days.map((d) => {
            const isSelected = isSameDay(d, selectedDay);
            const isToday = isSameDay(d, today);
            const dayEvents = byDay.get(isoDay(d)) ?? [];
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedDay(d)}
                className="portal-schedule-day"
                data-selected={isSelected ? "true" : "false"}
                data-today={isToday ? "true" : "false"}
                aria-pressed={isSelected}
                aria-label={format(d, "EEEE, MMMM d")}
              >
                <span className="portal-schedule-day-weekday">{format(d, "EEE")}</span>
                <span className="portal-schedule-day-num">{format(d, "d")}</span>
                {dayEvents.length > 0 ? (
                  <span className="portal-schedule-day-dot" aria-hidden="true" />
                ) : (
                  <span className="portal-schedule-day-spacer" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          label={t("schedule.thisWeek")}
          count={stats.total}
          tone="brand"
          icon={Users}
        />
        <StatTile
          label={t("schedule.appointment")}
          count={stats.appointments}
          tone="sky"
          icon={UserCheck}
        />
        <StatTile
          label={t("schedule.walkIn")}
          count={stats.walkins}
          tone="amber"
          icon={AlertTriangle}
        />
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-surface-2/30">
          <h2 className="text-xs uppercase font-bold tracking-wider text-text-muted">
            {selectedDayLabel}
          </h2>
          <span className="text-xs text-text-muted font-medium">
            {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
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
              icon={<CalendarCheck size={20} className="text-text-muted" />}
              title={t("schedule.noSlots")}
              description={`${format(selectedDay, "EEEE, MMMM d")} · ${t("schedule.subtitle")}`}
              className="py-10"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
