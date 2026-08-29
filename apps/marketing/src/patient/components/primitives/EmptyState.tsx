"use client";

import { cn } from "@/portal/lib/utils";

/**
 * Quiet, illustration-free placeholder used wherever a list could be
 * empty. The spec forbids fake clinical content, so this is the only
 * thing we ever show when there's no data — a centered title +
 * subtitle, no graphic, no CTA unless caller passes one.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      <p className="t-card-title">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-text-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
