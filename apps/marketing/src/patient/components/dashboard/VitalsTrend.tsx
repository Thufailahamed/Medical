"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  BarChart2,
  Clock,
  Droplets,
  HeartPulse,
  Plus,
  Scale,
  TrendingUp,
  Wind,
} from "lucide-react";

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
import { MiniSparkline } from "./MiniSparkline";

const OVERVIEW = [
  {
    vitalKey: "heart_rate" as const,
    label: "Heart rate",
    unit: "bpm",
    icon: HeartPulse,
    accent: "bg-rose-50 text-rose-600 border-rose-100/80",
    href: "/patient/vitals?type=heart_rate",
  },
  {
    vitalKey: "blood_pressure" as const,
    label: "Blood pressure",
    unit: "mmHg",
    icon: Droplets,
    accent: "bg-indigo-50 text-indigo-600 border-indigo-100/80",
    href: "/patient/vitals?type=blood_pressure",
  },
  {
    vitalKey: "spo2" as const,
    label: "SpO₂",
    unit: "%",
    icon: Wind,
    accent: "bg-sky-50 text-sky-600 border-sky-100/80",
    href: "/patient/vitals?type=spo2",
  },
  {
    vitalKey: "weight" as const,
    label: "Weight",
    unit: "kg",
    icon: Scale,
    accent: "bg-emerald-50 text-emerald-600 border-emerald-100/80",
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
      {/* ── Top 4 Overview Metric Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
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

      {/* ── Segmented Vital Selection Tabs & Action ──────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div
          className="inline-flex items-center gap-1 rounded-xl bg-surface-2/90 p-1 border border-border"
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
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  isSelected
                    ? "bg-surface text-blue-600 shadow-xs border border-border"
                    : "text-text-soft hover:text-text hover:bg-surface-3/60",
                )}
              >
                {VITAL_REGISTRY[v].shortLabel}
              </button>
            );
          })}
        </div>

        <Link
          href={`/patient/vitals?type=${type}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] px-3.5 py-2 text-xs font-semibold text-white shadow-xs shadow-blue-600/25 border border-blue-600 transition-all cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden />
          Log reading
        </Link>
      </div>

      {/* ── Chart Header Details ────────────────────────────────────────── */}
      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {meta.label}
          </p>
          <p className="mt-0.5 text-sm font-bold text-text">
            This week&apos;s readings &amp; trends
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-soft shadow-2xs">
          <Clock size={12} className="text-text-muted" aria-hidden />
          7 days
        </span>
      </div>

      {/* ── Chart Area or High-End Empty State ───────────────────────────── */}
      {isLoading ? (
        <div className="mt-4 h-[210px] animate-pulse rounded-2xl border border-border bg-surface-2" />
      ) : hasPoints ? (
        <TrendArea
          points={points}
          height={210}
          showSecondary={type === "blood_pressure"}
          className="mt-2"
        />
      ) : (
        <div className="mt-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-gradient-to-b from-surface-2/50 via-white to-surface-2/30 px-6 py-10 text-center shadow-2xs">
          <div
            className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-blue-100/80 bg-blue-50 text-blue-600 shadow-2xs"
            aria-hidden
          >
            <Activity size={20} />
          </div>
          <p className="text-sm font-bold text-text">
            No {meta.label.toLowerCase()} yet
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-soft">
            Log a reading to start your {meta.shortLabel.toLowerCase()} trend for this week.
          </p>
          <Link
            href={`/patient/vitals?type=${type}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-white shadow-xs shadow-blue-600/20 border border-blue-600 transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden />
            Add first reading
          </Link>
        </div>
      )}

      {/* ── Bottom Summary Stat Cards ───────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="rounded-xl border border-border bg-gradient-to-br from-surface-2/80 to-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <BarChart2 size={12} className="text-blue-600" />
            <span>Average</span>
          </div>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tight text-text">
              {hasPoints && stats?.avg != null
                ? stats.avg.toFixed(meta.decimals)
                : "—"}
            </span>
            <span className="text-xs font-semibold text-text-soft">{meta.unit}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">Weekly mean</p>
        </div>

        <div className="rounded-xl border border-border bg-gradient-to-br from-surface-2/80 to-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <TrendingUp size={12} className="text-emerald-600" />
            <span>Max</span>
          </div>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tight text-text">
              {peak != null ? Number(peak).toFixed(meta.decimals) : "—"}
            </span>
            <span className="text-xs font-semibold text-text-soft">{meta.unit}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">Weekly peak</p>
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
        "group flex flex-col rounded-2xl border p-3.5 transition-all focus-visible:outline-2 focus-visible:outline-blue-600",
        isSelected
          ? "border-blue-400/90 bg-blue-50/25 ring-2 ring-blue-500/15 shadow-xs"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/40 hover:-translate-y-0.5 shadow-2xs",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-lg border",
              accent,
            )}
          >
            <Icon size={14} aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {label}
          </span>
        </div>
        {isSelected && (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="text-xl font-black tracking-tight text-text">
          {last != null ? Number(last).toFixed(decimals) : "—"}
        </span>
        <span className="text-xs font-semibold text-text-muted">{unit}</span>
        {delta !== 0 ? (
          <span
            className={cn(
              "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
              delta > 0
                ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
                : "text-rose-700 bg-rose-50 border-rose-200/60",
            )}
          >
            {delta > 0 ? "+" : ""}
            {Number(delta).toFixed(decimals)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 text-blue-600">
        {series.length >= 2 ? (
          <MiniSparkline points={series} width={120} height={26} stroke="#3b82f6" />
        ) : (
          <svg
            width={120}
            height={26}
            viewBox="0 0 120 26"
            aria-hidden="true"
            className="text-border-strong"
          >
            <polyline
              points="0,13 120,13"
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
