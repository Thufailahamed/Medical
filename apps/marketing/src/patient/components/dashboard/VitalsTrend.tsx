"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, Clock, HeartPulse, Droplets, Wind, Scale, Plus } from "lucide-react";

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
import { MiniSparkline } from "./MiniSparkline";

const OVERVIEW = [
  { vitalKey: "heart_rate" as const, label: "Heart rate", unit: "bpm", icon: HeartPulse, href: "/patient/vitals?type=heart_rate" },
  { vitalKey: "blood_pressure" as const, label: "Blood pressure", unit: "mmHg", icon: Droplets, href: "/patient/vitals?type=blood_pressure" },
  { vitalKey: "spo2" as const, label: "SpO₂", unit: "%", icon: Wind, href: "/patient/vitals?type=spo2" },
  { vitalKey: "weight" as const, label: "Weight", unit: "kg", icon: Scale, href: "/patient/vitals?type=weight" },
];

/**
 * Vitals overview — 4-cell sparkline strip for at-a-glance trends + tabbed
 * detail chart below for deep dives.
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
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {OVERVIEW.map((cell) => (
          <OverviewCell key={cell.vitalKey} {...cell} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-surface-3 pt-4">
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

function OverviewCell({
  vitalKey,
  label,
  unit,
  icon: Icon,
  href,
}: {
  vitalKey: "heart_rate" | "blood_pressure" | "spo2" | "weight";
  label: string;
  unit: string;
  icon: typeof HeartPulse;
  href: string;
}) {
  const { data } = useVitalsSeries(vitalKey, "week");
  const series = data ? toSeries(data.points).map((p) => p.value) : [];
  const last = series.at(-1);
  const prev = series.at(-2);
  const delta = last != null && prev != null ? last - prev : 0;
  const decimals = VITAL_REGISTRY[vitalKey]?.decimals ?? 0;
  return (
    <Link
      href={href}
      aria-label={`${label} details`}
      className="group flex flex-col rounded-xl border border-surface-3 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex items-center gap-1.5 text-text-muted">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft text-brand">
          <Icon size={12} aria-hidden />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg font-extrabold text-text">
          {last != null ? Number(last).toFixed(decimals) : "—"}
        </span>
        <span className="text-[10px] text-text-muted">{unit}</span>
        {delta !== 0 ? (
          <span
            className={cn(
              "text-[10px] font-bold px-1 py-0.5 rounded",
              delta > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50",
            )}
          >
            {delta > 0 ? "+" : ""}
            {Number(delta).toFixed(decimals)}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-brand">
        <MiniSparkline points={series} width={120} height={28} />
      </div>
    </Link>
  );
}
