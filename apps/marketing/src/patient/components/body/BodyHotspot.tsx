"use client";

import { cn } from "@/portal/lib/utils";

/**
 * A clickable circle laid over the BodyFigure. Active state lifts the
 * fill to the full-strength tone (brand by default) and the dot
 * becomes the entry point into the right-anchored OrganDetailPanel.
 */
export function BodyHotspot({
  cx,
  cy,
  r = 4,
  active = false,
  tone = "brand",
  label,
  onSelect,
  testId,
}: {
  cx: number;
  cy: number;
  r?: number;
  active?: boolean;
  tone?: "brand" | "warn" | "danger" | "info";
  label?: string;
  onSelect?: () => void;
  testId?: string;
}) {
  const palette = {
    brand: { ring: "var(--color-brand)", soft: "var(--color-brand-soft)" },
    warn: { ring: "var(--color-warn)", soft: "var(--color-warn-soft)" },
    danger: { ring: "var(--color-danger)", soft: "var(--color-danger-soft)" },
    info: { ring: "var(--color-text-muted)", soft: "var(--color-surface-3)" },
  }[tone];

  return (
    <g data-testid={testId}>
      <circle
        cx={cx}
        cy={cy}
        r={r + 1.5}
        fill={active ? palette.ring : palette.soft}
        opacity={active ? 0.25 : 0.5}
        pointerEvents="all"
        onClick={onSelect}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={palette.ring}
        stroke="var(--color-surface)"
        strokeWidth={1.5}
        pointerEvents="all"
        onClick={onSelect}
        className={cn("cursor-pointer transition-transform", active && "scale-110")}
      />
      {label && active ? (
        <text
          x={cx}
          y={cy - r - 4}
          textAnchor="middle"
          fontSize="5"
          fontWeight={600}
          fill="var(--color-text)"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
