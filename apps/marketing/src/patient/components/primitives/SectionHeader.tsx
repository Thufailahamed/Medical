"use client";

import { cn } from "@/portal/lib/utils";

/**
 * Page / section title row with optional action slot.
 */
export function SectionHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "anim-rise flex items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {label ? <p className="t-label">{label}</p> : null}
        <h2 className="t-page mt-1 truncate text-text">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm text-text-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
