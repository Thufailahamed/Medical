"use client";

import { cn } from "@/portal/lib/utils";

/**
 * Centered empty placeholder — doctor-portal Empty style with optional icon shell.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div
          className="mb-2 grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--color-border)] bg-surface-2 text-text-muted"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      {title ? <p className="text-sm font-bold text-text">{title}</p> : null}
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
