"use client";

import { cn } from "@/portal/lib/utils";

import { Card } from "./Card";

/**
 * A single hero number with a label, an optional unit, and an optional
 * delta. Used inside Dashboard widgets where one numerical fact
 * dominates the card (Today's steps, Sleep last night, etc).
 *
 * The metric renders at the 40px `.t-metric` size from globals.css;
 * the unit sits to the right at the 18px `.t-unit` size.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  /** A delta is rendered as a small chip below the value. Pass null to omit. */
  delta?: string | null;
  /** "up" = success-green, "down" = danger-red, "neutral" = ink. */
  deltaTone?: "up" | "down" | "neutral";
  className?: string;
}) {
  const deltaColor =
    deltaTone === "up"
      ? "text-success"
      : deltaTone === "down"
        ? "text-danger"
        : "text-text-soft";

  return (
    <Card padded={false} className={cn("p-5", className)}>
      <p className="t-label">{label}</p>
      <p className="mt-3">
        <span className="t-metric">{value}</span>
        {unit ? <span className="ml-1 t-unit">{unit}</span> : null}
      </p>
      {delta != null ? (
        <p className={cn("mt-2 text-xs font-medium", deltaColor)}>{delta}</p>
      ) : null}
    </Card>
  );
}
