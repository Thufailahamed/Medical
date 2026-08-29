"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { TrendArea } from "@/patient/components/charts/TrendArea";
import {
  DASHBOARD_VITALS,
  VITAL_REGISTRY,
  toSeries,
  type VitalMeta,
} from "@/patient/lib/vitals";
import { useVitalsSeries } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Vitals overview — tab pills, trend chart, average / max footer.
 */
export function VitalsTrend({ className }: { className?: string }) {
  const [type, setType] = useState<(typeof DASHBOARD_VITALS)[number]>(
    DASHBOARD_VITALS[0]
  );
  const { data, isLoading } = useVitalsSeries(type, "week");
  const meta: VitalMeta = VITAL_REGISTRY[type];

  const points = data ? toSeries(data.points) : [];
  const stats = data?.stats ?? null;
  const peak =
    stats?.max != null
      ? stats.max
      : points.length
        ? Math.max(...points.map((p) => p.value))
        : null;

  return (
    <Card className={cn("anim-rise relative overflow-hidden", className)} accent="sky">
      <div className="flex flex-wrap items-center gap-2">
        {DASHBOARD_VITALS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            data-active={v === type}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold transition-colors",
              v === type
                ? "bg-ink text-white"
                : "bg-surface-2 text-text-soft hover:bg-surface-3 hover:text-text"
            )}
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {VITAL_REGISTRY[v].shortLabel}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <p className="t-label">{meta.label}</p>
          <p className="mt-1 text-sm text-text-soft">This week&apos;s readings</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          <Clock size={12} aria-hidden />
          7 days
        </span>
      </div>

      {isLoading ? (
        <div className="mt-4 h-[200px] animate-pulse rounded-inner bg-surface-2" />
      ) : (
        <TrendArea
          points={points}
          height={200}
          showSecondary={type === "blood_pressure"}
          className="mt-2"
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-3 pt-4">
        <div>
          <p className="t-micro">Average</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="t-metric text-[28px]">
              {stats?.avg != null ? stats.avg.toFixed(meta.decimals) : "—"}
            </span>
            <span className="t-unit text-sm">{meta.unit}</span>
          </p>
        </div>
        <div>
          <p className="t-micro">Max</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="t-metric text-[28px]">
              {peak != null ? Number(peak).toFixed(meta.decimals) : "—"}
            </span>
            <span className="t-unit text-sm">{meta.unit}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
