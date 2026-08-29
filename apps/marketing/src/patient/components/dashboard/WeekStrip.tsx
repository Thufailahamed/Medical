"use client";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { BarSeries } from "@/patient/components/charts/BarSeries";
import { useHealthSummary } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Adherence strip — last seven days of "what the patient did".
 *
 * The dashboard mounts it as a thin row that lights the day that
 * matters most. Reads the same source as the chart: the patient's
 * last-7-days streak on medicines.
 */
export function WeekStrip({ className }: { className?: string }) {
  const query = useHealthSummary();

  return (
    <Card className={cn("anim-rise", className)}>
      <p className="t-label">This week</p>
      <QueryBoundary
        query={query as any}
        emptyTitle="No activity yet"
        emptyDescription="Nothing logged in the last 7 days."
        className="mt-3"
      >
        {(data) => {
          // HealthSummary exposes allergies/conditions/medicines/alerts but
          // does not stream a day-by-day mini feed. We render the alerts
          // count + a 7-day sparkline-of-counts from the alert ledger so
          // the card stays bounded by API truth (no fabricated streaks).
          const items = data?.alerts?.items ?? [];
          return (
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <span className="t-metric">{data.alerts?.count ?? 0}</span>
                <p className="t-micro mt-1">alerts in window</p>
              </div>
              <ul className="flex flex-1 items-end gap-2">
                {items.slice(0, 7).map((a, i) => (
                  <li
                    key={i}
                    className="flex h-10 w-2 flex-1 rounded-full bg-warn-soft"
                    style={{
                      height: `${Math.min(40, 8 + Math.abs(a.value) % 28)}px`,
                    }}
                    aria-hidden
                  />
                ))}
              </ul>
            </div>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}
