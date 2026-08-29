"use client";

import { useState } from "react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
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
 * Trend card with a four-tab pill row. Each tab calls
 * `useVitalsSeries(type, "week")` lazily, so swapping to a different
 * vital swaps the query, key and chart in one motion. The
 * `latestClassification` from the API becomes the status chip.
 */
export function VitalsTrend({ className }: { className?: string }) {
  const [type, setType] = useState<(typeof DASHBOARD_VITALS)[number]>(
    DASHBOARD_VITALS[0]
  );
  const { data, isLoading } = useVitalsSeries(type, "week");
  const meta: VitalMeta = VITAL_REGISTRY[type];

  const points = data ? toSeries(data.points) : [];
  const stats = data?.stats ?? null;
  const latest = stats?.latest ?? null;
  const classification = data?.latestClassification ?? null;

  return (
    <Card className={cn("anim-rise", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="t-label">{meta.label}</p>
        <Pill tone={classification ? toneFor(classification) : "neutral"}>
          {classification ?? "—"}
        </Pill>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="t-metric">
          {latest != null ? latest.toFixed(meta.decimals) : "—"}
        </span>
        <span className="t-unit">{meta.unit}</span>
        {stats?.delta != null ? (
          <span className="ml-2 text-xs text-text-soft">
            {stats.delta > 0 ? "+" : ""}
            {stats.delta.toFixed(meta.decimals)} this week
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 h-[180px] animate-pulse rounded-inner bg-surface-2" />
      ) : (
        <TrendArea
          points={points}
          showSecondary={type === "blood_pressure"}
          className="mt-3"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {DASHBOARD_VITALS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            data-active={v === type}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              v === type
                ? "bg-ink text-white"
                : "bg-surface-2 text-text-soft hover:bg-surface-3"
            )}
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {VITAL_REGISTRY[v].shortLabel}
          </button>
        ))}
      </div>
    </Card>
  );
}

function toneFor(c: string): "success" | "warn" | "danger" | "neutral" {
  const s = c.toLowerCase();
  if (s.includes("normal") || s.includes("stable")) return "success";
  if (s.includes("elevated") || s.includes("high")) return "warn";
  if (s.includes("low") || s.includes("critical")) return "danger";
  return "neutral";
}
