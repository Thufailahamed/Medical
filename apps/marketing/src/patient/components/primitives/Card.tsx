"use client";

import { cn } from "@/portal/lib/utils";

/**
 * White rounded card. The single primitive every dashboard tile,
 * section, and chrome element is built from — the spec calls for
 * "large white rounded cards" and this is the only Card the project
 * needs.
 *
 * The `padded` prop defaults to true; opt out for tightly-packed grid
 * tiles (RadialGauge, StatTile) that want to control their own padding.
 */
export function Card({
  className,
  padded = true,
  as: As = "div",
  children,
}: {
  className?: string;
  padded?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
}) {
  return (
    <As
      className={cn(
        "bg-surface",
        padded && "p-6",
        className
      )}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {children}
    </As>
  );
}
