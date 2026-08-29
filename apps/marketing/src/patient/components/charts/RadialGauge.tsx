"use client";

import { cn } from "@/portal/lib/utils";

/**
 * A pure-SVG radial gauge.
 *
 * No recharts — the gauge is a tiny unit and pulling in recharts'
 * radial bar for one ring is overkill. The needle is computed from
 * `value / max`; the tone drives the colour of the active arc.
 */
export function RadialGauge({
  value,
  max = 100,
  size = 132,
  tone = "brand",
  label,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  tone?: "brand" | "success" | "warn" | "danger";
  label?: string;
  className?: string;
}) {
  const r = (size - 12) / 2;
  const c = size / 2;
  const pct = Math.min(1, Math.max(0, value / max));
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const palette = {
    brand: "var(--color-brand)",
    success: "var(--color-success)",
    warn: "var(--color-warn)",
    danger: "var(--color-danger)",
  } as const;

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={10}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={palette[tone]}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="t-card-title text-text">{value}</span>
        {label ? <span className="t-micro">{label}</span> : null}
      </div>
    </div>
  );
}
