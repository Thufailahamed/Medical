"use client";

import { cn } from "@/portal/lib/utils";

/**
 * Title row at the top of a section: optional small label, the
 * heading, optional inline content on the right (a "View all" link,
 * a tabs strip, a filter button).
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
        "flex items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {label ? <p className="t-label">{label}</p> : null}
        <h2 className="t-card-title mt-1 truncate text-text">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-text-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
