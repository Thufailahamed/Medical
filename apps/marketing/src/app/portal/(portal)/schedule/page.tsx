"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton, ErrorState } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface ScheduleEvent {
  id: string;
  start: string;
  end?: string;
  type: "appointment" | "walk_in" | "blocked" | string;
  patientId?: string;
  patientName?: string;
  reason?: string | null;
  status?: string;
}

interface ScheduleRangeResponse {
  from: string;
  to: string;
  count: number;
  events: ScheduleEvent[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_PX = 56;
const START_HOUR = 7;
const END_HOUR = 21;

function isoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function SchedulePage() {
  const t = useT();
  const [anchor, setAnchor] = useState(() => new Date());

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
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of events) {
      const d = format(parseISO(e.start), "yyyy-MM-dd");
      const arr = map.get(d) ?? [];
      arr.push(e);
      map.set(d, arr);
    }
    return map;
  }, [events]);

  const today = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">{t("schedule.title")}</h1>
          <p className="text-sm text-text-soft mt-1">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ChevronLeft size={14} />}
            onClick={() => setAnchor((d) => addWeeks(d, -1))}
          >
            {t("schedule.prev")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
            {t("schedule.today")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ChevronRight size={14} />}
            onClick={() => setAnchor((d) => addWeeks(d, 1))}
          >
            {t("schedule.next")}
          </Button>
        </div>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState retry={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t("common.retry")}</Button>} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px] grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
              {/* Header row */}
              <div className="border-b border-border bg-surface-2/40" />
              {days.map((d) => {
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "px-3 py-2 border-b border-border text-center",
                      isToday && "bg-brand-soft/30"
                    )}
                  >
                    <div className="text-[11px] uppercase tracking-wide text-text-muted">
                      {format(d, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isToday ? "text-brand" : "text-text"
                      )}
                    >
                      {format(d, "d")}
                    </div>
                  </div>
                );
              })}

              {/* Hours */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
                const hour = START_HOUR + i;
                return (
                  <div key={`row-${hour}`} className="contents">
                    <div className="border-b border-border text-[10px] text-text-muted px-2 py-1 text-right tabular-nums">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    {days.map((d) => {
                      const dayKey = isoDay(d);
                      const dayEvents = (byDay.get(dayKey) ?? []).filter((e) => {
                        const dt = parseISO(e.start);
                        return dt.getHours() === hour;
                      });
                      const isToday = isSameDay(d, today);
                      return (
                        <div
                          key={`cell-${hour}-${dayKey}`}
                          className={cn(
                            "border-b border-l border-border min-h-[56px] relative",
                            isToday && "bg-brand-soft/10"
                          )}
                        >
                          {dayEvents.map((e) => (
                            <EventChip key={e.id} event={e} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function EventChip({ event }: { event: ScheduleEvent }) {
  const tone =
    event.type === "appointment"
      ? "brand"
      : event.type === "walk_in"
        ? "violet"
        : event.status === "cancelled"
          ? "danger"
          : event.status === "completed"
            ? "success"
            : "neutral";
  return (
    <div
      className={cn(
        "absolute left-1 right-1 top-1 rounded-md px-2 py-1 text-[11px] truncate cursor-pointer hover:shadow-sm",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "violet" && "bg-violet-soft text-violet",
        tone === "success" && "bg-success-soft text-success",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "neutral" && "bg-surface-2 text-text"
      )}
      title={event.patientName ?? event.reason ?? event.type}
    >
      <div className="font-medium truncate">{event.patientName ?? event.type}</div>
      <div className="truncate text-[10px] opacity-80">
        {format(parseISO(event.start), "HH:mm")} {event.reason ? `· ${event.reason}` : ""}
      </div>
    </div>
  );
}