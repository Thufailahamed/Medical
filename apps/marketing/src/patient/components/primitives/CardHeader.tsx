"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";

/**
 * Section card header — icon badge + title + optional “open” link.
 * Matches doctor portal dashboard content cards.
 */
export function CardHeader({
  title,
  caption,
  icon,
  href,
  linkLabel = "View all",
  className,
}: {
  title: string;
  caption?: string;
  icon?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-bold text-text">{title}</p>
          {caption ? (
            <p className="mt-0.5 text-[11px] text-text-muted">{caption}</p>
          ) : null}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong"
        >
          {linkLabel}
          <ArrowRight size={12} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
