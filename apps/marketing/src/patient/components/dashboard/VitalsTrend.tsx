"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  BarChart2,
  Droplets,
  HeartPulse,
  Plus,
  Scale,
  TrendingUp,
  Wind,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";
import { TrendArea } from "@/patient/components/charts/TrendArea";
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
  {
    vitalKey: "heart_rate" as const,
    label: "Heart rate",
    unit: "bpm",
    icon: HeartPulse,
    accent: "bg-rose-50 text-rose-500",
    href: "/patient/vitals?type=heart_rate",
  },
  {
    vitalKey: "blood_pressure" as const,
    label: "Blood pressure",
    unit: "mmHg",
    icon: Droplets,
    accent: "bg-violet-50 text-violet-600",
    href: "/patient/vitals?type=blood_pressure",
  },
  {
    vitalKey: "spo2" as const,
    label: "SpO₂",
    unit: "%",
    icon: Wind,
    accent: "bg-brand-soft text-brand",
    href: "/patient/vitals?type=spo2",
  },
  {
    vitalKey: "weight" as const,
    label: "Weight",
    unit: "kg",
    icon: Scale,
    accent: "bg-success-soft text-success",
    href: "/patient/vitals?type=weight",
  },
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
      <CardHeader
        title="Vitals"
        caption="Readings and trends from the last 7 days"
        icon={<HeartPulse size={16} aria-hidden />}
        action={
          <Link
            href={`/patient/vitals?type=${type}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            <Plus size={13} strokeWidth={2.5} aria-hidden />
            Log reading
          </Link>
        }
      />

      {/* ── Overview cells ─────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {OVERVIEW.map((cell) => (
          <OverviewCell
            key={cell.vitalKey}
            {...cell}
            isSelected={cell.vitalKey === type}
            onSelect={() => {
              if (DASHBOARD_VITALS.includes(cell.vitalKey as any)) {
                setType(cell.vitalKey as (typeof DASHBOARD_VITALS)[number]);
              }
            }}
          />
        ))}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-surface-2 p-1"
            role="tablist"
            aria-label="Vital type"
          >
            {DASHBOARD_VITALS.map((v) => {
              const isSelected = v === type;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setType(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    isSelected
                      ? "bg-surface text-text shadow-sm"
                      : "text-text-muted hover:text-text",
                  )}
                >
                  {VITAL_REGISTRY[v].shortLabel}
                </button>
              );
            })}
          </div>

          <dl className="flex items-center gap-5 text-xs">
            <div className="flex items-baseline gap-1.5">
              <dt className="inline-flex items-center gap-1 text-text-muted">
                <BarChart2 size={12} className="text-brand" aria-hidden />
                Avg
              </dt>
              <dd className="font-semibold text-text">
                {hasPoints && stats?.avg != null ? stats.avg.toFixed(meta.decimals) : "—"}
                <span className="ml-0.5 font-normal text-text-muted">{meta.unit}</span>
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="inline-flex items-center gap-1 text-text-muted">
                <TrendingUp size={12} className="text-success" aria-hidden />
                Peak
              </dt>
              <dd className="font-semibold text-text">
                {peak != null ? Number(peak).toFixed(meta.decimals) : "—"}
                <span className="ml-0.5 font-normal text-text-muted">{meta.unit}</span>
              </dd>
            </div>
          </dl>
        </div>

        {isLoading ? (
          <div className="mt-4 h-[200px] rounded-lg patient-shimmer" />
        ) : hasPoints ? (
          <TrendArea
            points={points}
            height={200}
            showSecondary={type === "blood_pressure"}
            className="mt-3"
          />
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-surface-2 px-6 py-9 text-center">
            <div
              className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface text-brand shadow-card"
              aria-hidden
            >
              <Activity size={19} />
            </div>
            <p className="text-sm font-semibold text-text">
              No {meta.label.toLowerCase()} yet
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-muted">
              Log a reading to start your {meta.shortLabel.toLowerCase()} trend for this week.
            </p>
            <Link
              href={`/patient/vitals?type=${type}`}
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-semibold text-text shadow-card transition-colors hover:text-brand"
            >
              <Plus size={13} strokeWidth={2.5} aria-hidden />
              Add first reading
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

function OverviewCell({
  vitalKey,
  label,
  unit,
  icon: Icon,
  accent,
  href,
  isSelected,
  onSelect,
}: {
  vitalKey: "heart_rate" | "blood_pressure" | "spo2" | "weight";
  label: string;
  unit: string;
  icon: typeof HeartPulse;
  accent: string;
  href: string;
  isSelected?: boolean;
  onSelect?: () => void;
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
      onClick={(e) => {
        if (onSelect) {
          onSelect();
        }
      }}
      aria-label={`${label} details`}
      className={cn(
        "group flex flex-col rounded-xl p-3.5 transition-all focus-visible:outline-2 focus-visible:outline-brand",
        isSelected
          ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-brand)]"
          : "bg-surface-2 hover:-translate-y-0.5 hover:bg-surface hover:shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md",
              accent,
            )}
          >
            <Icon size={14} aria-hidden />
          </span>
          <span className="text-xs font-medium text-text-soft">
            {label}
          </span>
        </div>
        {isSelected && (
          <span className="pt-dot bg-brand" aria-hidden />
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-text">
          {last != null ? Number(last).toFixed(decimals) : "—"}
        </span>
        <span className="text-xs font-semibold text-text-muted">{unit}</span>
        {delta !== 0 ? (
          <span
            className={cn(
              "ml-auto rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
              delta > 0
                ? "text-success bg-success-soft"
                : "text-danger bg-danger-soft",
            )}
          >
            {delta > 0 ? "+" : ""}
            {Number(delta).toFixed(decimals)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-brand">
        {series.length >= 2 ? (
          <MiniSparkline points={series} width={140} height={28} stroke="currentColor" />
        ) : (
          <svg
            width={140}
            height={28}
            viewBox="0 0 140 28"
            aria-hidden="true"
            className="text-border-strong"
          >
            <polyline
              points="0,14 140,14"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          </svg>
        )}
      </div>
    </Link>
  );
}
