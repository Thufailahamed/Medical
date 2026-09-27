"use client";

import { cn } from "@/portal/lib/utils";

export type CardAccent =
  | "brand"
  | "sky"
  | "violet"
  | "amber"
  | "green"
  | "rose"
  | "none";

/**
 * Buyer-portal surface: uniform white card, 12px radius, inset hairline,
 * quiet hover lift. No per-card accent decor — category color lives in
 * badges, pills and icon tiles (mirrors project-5 `Surface`).
 *
 * `accent` is reserved for API compatibility and intentionally renders
 * nothing; pass tone via child primitives (Pill, StatusDots, StatTile).
 */
export function Card({
  className,
  padded = true,
  as: As = "div",
  accent = "brand",
  children,
}: {
  className?: string;
  padded?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  accent?: CardAccent;
  children?: React.ReactNode;
}) {
  void accent;
  return (
    <As
      className={cn(
        "patient-card group",
        padded && "p-5 md:p-6",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </As>
  );
}
