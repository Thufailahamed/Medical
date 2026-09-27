"use client";

import { cn } from "@/portal/lib/utils";

export type MetricAccent = "mint" | "amber" | "rose" | "brand" | "ink";

export interface MetricStackItem {
  label: string;
  value: string;
  accent?: MetricAccent;
}

const ACCENT: Record<MetricAccent, string> = {
  mint: "text-success",
  amber: "text-warn",
  rose: "text-danger",
  brand: "text-brand",
  ink: "text-text",
};

export function MetricStack({
  items,
  compact = false,
  className,
}: {
  items: MetricStackItem[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-ink/10", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-baseline justify-between gap-4",
            compact ? "py-2" : "py-3"
          )}
        >
          <dt className="t-label">{item.label}</dt>
          <dd className={cn("pt-metric text-2xl", ACCENT[item.accent ?? "ink"])}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
