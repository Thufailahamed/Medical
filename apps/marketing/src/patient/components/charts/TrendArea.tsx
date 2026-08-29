"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/portal/lib/utils";

import type { ChartPoint } from "@/patient/lib/vitals";

/**
 * Smoothed area chart for a single vital type.
 *
 * Renders the primary value as a soft fill tinted with the brand hue
 * and overlays the secondary value (used for blood-pressure's
 * diastolic reading) as a thin ghost stroke so both series share the
 * same x-axis without competing for visual weight.
 *
 * `height` defaults to 180 (the dashboard trend card size). We
 * intentionally ship a fixed height inside `ResponsiveContainer` so
 * the parent card never collapses before recharts mounts.
 */
export function TrendArea({
  points,
  height = 180,
  showSecondary = false,
  className,
}: {
  points: ChartPoint[];
  height?: number;
  showSecondary?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="patient-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={["dataMin - 4", "dataMax + 4"]} />
          <Tooltip
            cursor={{ stroke: "var(--color-text-muted)", strokeOpacity: 0.2 }}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "var(--shadow-float)",
              fontFamily: "var(--font-patient)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-brand)"
            strokeWidth={2}
            fill="url(#patient-trend-fill)"
            isAnimationActive={false}
          />
          {showSecondary ? (
            <Area
              type="monotone"
              dataKey="secondary"
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive={false}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
