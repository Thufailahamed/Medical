"use client";

import { cn } from "@/portal/lib/utils";

/**
 * Skeleton loading placeholder. Single primitive; callers pick a
 * width/height shape. The shimmer animation lives in globals.css
 * under `.patient-shimmer` and is pause-on-reduced-motion by default.
 */
export function Skeleton({
  className,
  rounded = "inner",
}: {
  className?: string;
  rounded?: "inner" | "card" | "pill";
}) {
  const radius =
    rounded === "card"
      ? "var(--radius-card)"
      : rounded === "pill"
        ? "var(--radius-pill)"
        : "var(--radius-inner)";

  return (
    <span
      aria-hidden
      className={cn("patient-shimmer block", className)}
      style={{ borderRadius: radius }}
    />
  );
}
