"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, Clock, Plus } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { TrendArea } from "@/patient/components/charts/TrendArea";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import {
  DASHBOARD_VITALS,
  VITAL_REGISTRY,
  toSeries,
  type VitalMeta,
} from "@/patient/lib/vitals";
import { useVitalsSeries } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

/**
 * Vitals overview — tab pills, trend chart (or empty CTA), average / max.
 */
export function VitalsTrend({ className }: { className?: string }) {
  const [type, setType] = useState<(typeof DASHBOARD_VITALS)[number]>(
    DASHBOARD_VITALS[0],
  );
  const { data, isLoading } = useVitalsSeries(type, "week");
  const meta: VitalMeta = VITAL_REGISTRY[type];

  const points = data ? toSeries(data.points) : [];
  const stats = data?.stats ?? null;
  const hasPoints = points.length > 0;
  const peak =
    stats?.max != null
      ? stats.max
      : hasPoints
        ? Math.max(...points.map((p) => p.value))
        : null;

  return (
    <Card
      className={cn("anim-rise relative overflow-hidden", className)}
      accent="sky"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap gap-1 rounded-[var(--radius-inner)] bg-surface-2 p-1"
          role="tablist"
          aria-label="Vital type"
        >
          {DASHBOARD_VITALS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === type}
              onClick={() => setType(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                v === type
                  ? "bg-ink text-white shadow-sm"
                  : "text-text-soft hover:bg-white hover:text-text",
              )}
            >
              {VITAL_REGISTRY[v].shortLabel}
            </button>
          ))}
        </div>
        <Link
          href={`/patient/vitals?type=${type}`}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition-transform hover:scale-[1.02]"
        >
          <Plus size={14} aria-hidden />
          Log reading
        </Link>
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
      ) : hasPoints ? (
        <TrendArea
          points={points}
          height={200}
          showSecondary={type === "blood_pressure"}
          className="mt-2"
        />
      ) : (
        <EmptyState
          className="mt-2 rounded-inner border border-dashed border-border bg-surface-2/60 py-10"
          icon={<Activity size={22} />}
          title={`No ${meta.label.toLowerCase()} yet`}
          description={`Log a reading to start your ${meta.shortLabel.toLowerCase()} trend for this week.`}
          action={
            <Link
              href={`/patient/vitals?type=${type}`}
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={14} aria-hidden />
              Add first reading
            </Link>
          }
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-surface-3 pt-4">
        <div>
          <p className="t-micro">Average</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="t-metric text-[28px]">
              {hasPoints && stats?.avg != null
                ? stats.avg.toFixed(meta.decimals)
                : "—"}
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
