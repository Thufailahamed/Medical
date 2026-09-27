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
        "pt-flow relative flex flex-col items-center justify-center gap-2 overflow-hidden px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div
          className="mb-2 grid h-12 w-12 place-items-center rounded-lg bg-ink text-sky-300"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      {title ? (
        <p className="text-[15px] font-extrabold tracking-tight text-text">{title}</p>
      ) : null}
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
