"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";

/**
 * Section card header — soft brand icon tile + title + muted caption,
 * with an optional quiet "open" link whose arrow travels on hover.
 */
export function CardHeader({
  title,
  caption,
  icon,
  href,
  linkLabel = "View all",
  action,
  className,
}: {
  title: string;
  caption?: string;
  icon?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  /** Extra control rendered before the link (e.g. an "Upload" button). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand"
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-display text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-text">
            {title}
          </p>
          {caption ? (
            <p className="mt-0.5 truncate text-xs text-text-muted">{caption}</p>
          ) : null}
        </div>
      </div>
      {href || action ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {href ? (
            <Link
              href={href}
              className="group/link -mr-1.5 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              {linkLabel}
              <ArrowRight
                size={13}
                className="transition-transform duration-200 group-hover/link:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
