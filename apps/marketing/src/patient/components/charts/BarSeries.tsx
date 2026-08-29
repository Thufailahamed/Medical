"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { cn } from "@/portal/lib/utils";

export interface BarPoint {
  /** Label rendered under the bar (a day, an hour, etc). */
  label: string;
  value: number;
}

/**
 * Tinted bar series used by the medication adherence strip, the
 * symptoms-per-day timeline, and similar primary metrics.
 *
 * The `accentIndex` paints one bar in the brand colour so the eye
 * lands on a highlighted entry (today, the worst day, the spike).
 */
export function BarSeries({
  points,
  height = 96,
  accentIndex = -1,
  className,
}: {
  points: BarPoint[];
  height?: number;
  accentIndex?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} isAnimationActive={false}>
            {points.map((_, i) => (
              <Cell
                key={i}
                fill={
                  i === accentIndex
                    ? "var(--color-brand)"
                    : "var(--color-surface-3)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
