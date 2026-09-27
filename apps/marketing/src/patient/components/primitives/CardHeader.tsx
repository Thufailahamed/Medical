"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";

/**
 * Section card header — ink icon tile + kicker caption + title +
 * optional “open” link with a travelling arrow. VYRO-style header
 * adapted to the patient palette.
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink text-sky-300"
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          {caption ? <p className="pt-kicker pt-kicker-muted">{caption}</p> : null}
          <p className="mt-0.5 text-[15px] font-extrabold tracking-tight text-text">
            {title}
          </p>
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="pt-btn pt-btn-ghost -mr-2 inline-flex h-8 shrink-0 items-center gap-1 px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brand"
        >
          {linkLabel}
          <ArrowRight size={12} className="pt-btn-arrow" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
