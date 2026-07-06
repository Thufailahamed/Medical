"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";

type IconTone =
  | "neutral"
  | "brand"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "violet"
  | "accent";

export interface ChartRowProps {
  icon?: ReactNode;
  iconTone?: IconTone;
  title: ReactNode;
  subtitle?: ReactNode;
  pills?: ReactNode[];
  meta?: ReactNode;
  /** Right-side action area (buttons, dropdowns, etc). */
  actions?: ReactNode;
  /** When set, the row renders as a link. `actions` still renders right-aligned. */
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Hide the trailing chevron that link rows show by default. */
  hideChevron?: boolean;
}

const TONE_BG: Record<IconTone, string> = {
  neutral: "bg-surface-2 text-text-soft",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-emerald-700",
  warn: "bg-warn-soft text-amber-700",
  danger: "bg-danger-soft text-red-700",
  info: "bg-info-soft text-sky-700",
  violet: "bg-violet-50 text-violet-700",
  accent: "bg-accent-soft text-emerald-700",
};

/**
 * Single row in a chart list. Layout:
 * [icon]  [title / subtitle / pills]  [meta]  [actions]  [chevron]
 */
export function ChartRow({
  icon,
  iconTone = "brand",
  title,
  subtitle,
  pills,
  meta,
  actions,
  href,
  onClick,
  className,
  hideChevron,
}: ChartRowProps) {
  const isLink = !!href;
  const isClickable = isLink || !!onClick;

  const inner = (
    <>
      {icon ? (
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            TONE_BG[iconTone]
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text truncate">{title}</div>
        {subtitle ? (
          <div className="text-[11px] text-text-soft truncate mt-0.5">
            {subtitle}
          </div>
        ) : null}
        {pills && pills.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {pills}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div className="text-right shrink-0 hidden md:flex flex-col items-end gap-0.5">
          {meta}
        </div>
      ) : null}
      {actions ? (
        <div className="shrink-0 flex items-center gap-1">{actions}</div>
      ) : null}
      {isLink && !hideChevron ? (
        <ChevronRight
          size={14}
          className="text-text-muted shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      ) : null}
    </>
  );

  const baseClass = cn(
    "group flex items-center gap-3 px-4 py-3 transition-colors",
    isClickable && "hover:bg-surface-2/50 cursor-pointer",
    className
  );

  if (isLink) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={baseClass}
    >
      {inner}
    </div>
  );
}
