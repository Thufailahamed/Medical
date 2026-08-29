"use client";

import { cn } from "@/portal/lib/utils";

/**
 * A tiny stroked sparkline drawn from a flat array of numbers.
 *
 * No recharts dependency — we don't need axes, tooltips or animation
 * for the inline next-to-metric use case. The path is computed in JS
 * from the data; an optional accent colour tints the stroke.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  tone = "brand",
  className,
  "aria-hidden": ariaHidden = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: "brand" | "success" | "danger" | "muted";
  className?: string;
  "aria-hidden"?: boolean;
}) {
  if (data.length === 0) {
    return (
      <span
        className={cn("block", className)}
        style={{ width, height }}
        aria-hidden={ariaHidden}
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);

  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const palette = {
    brand: "var(--color-brand)",
    success: "var(--color-success)",
    danger: "var(--color-danger)",
    muted: "var(--color-text-muted)",
  } as const;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      className={cn("block", className)}
      aria-hidden={ariaHidden}
    >
      <path d={d} fill="none" stroke={palette[tone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last ? (
        <circle cx={last[0]} cy={last[1]} r={2.5} fill={palette[tone]} />
      ) : null}
    </svg>
  );
}
