"use client";

import { useMemo, useState } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useHealthSummary } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { CalendarRange } from "lucide-react";

function buildWeekDays(anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(12, 0, 0, 0);
  // Start from Sunday of current week
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Horizontal calendar strip for the dashboard right column.
 */
export function WeekStrip({ className }: { className?: string }) {
  const query = useHealthSummary();
  const days = useMemo(() => buildWeekDays(), []);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = useState(todayKey);

  return (
    <Card accent="amber" className={cn("anim-rise anim-rise-delay-1", className)} padded={false}>
      <div className="px-5 pb-2 pt-5">
        <CardHeader
          title="This week"
          caption="Pick a day"
          icon={<CalendarRange size={15} />}
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-4">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const active = key === selected;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "flex min-w-[52px] flex-1 flex-col items-center gap-1 px-2 py-2.5 transition-colors",
                active
                  ? "bg-brand text-white"
                  : "bg-surface-2 text-text-soft hover:bg-surface-3"
              )}
              style={{ borderRadius: 16 }}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase",
                  active ? "text-white/80" : "text-text-muted"
                )}
              >
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-base font-bold leading-none">
                {d.getDate()}
              </span>
              {isToday && !active ? (
                <span className="h-1 w-1 rounded-full bg-brand" aria-hidden />
              ) : (
                <span className="h-1 w-1" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <QueryBoundary
        query={query as any}
        emptyTitle=""
        className="border-t border-surface-3 px-5 py-3"
      >
        {(data) => (
          <p className="text-xs text-text-soft">
            <span className="font-semibold text-text">
              {data.alerts?.count ?? 0}
            </span>{" "}
            vitals alerts in the last window
          </p>
        )}
      </QueryBoundary>
    </Card>
  );
}
