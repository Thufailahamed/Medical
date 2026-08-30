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
  neutral: "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs",
  brand: "bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs",
  warn: "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs",
  danger: "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs",
  info: "bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs",
  violet: "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs",
  accent: "bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs",
};

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
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            TONE_BG[iconTone]
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
          {title}
        </div>
        {subtitle ? (
          <div className="text-xs text-slate-500 truncate mt-0.5">
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
        <div className="text-right shrink-0 hidden md:flex flex-col items-end gap-0.5 text-xs text-slate-500 font-medium">
          {meta}
        </div>
      ) : null}
      {actions ? (
        <div className="shrink-0 flex items-center gap-1">{actions}</div>
      ) : null}
      {(isLink || onClick) && !hideChevron ? (
        <ChevronRight
          size={16}
          className="text-slate-400 shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-sky-600"
        />
      ) : null}
    </>
  );

  const baseClass = cn(
    "group flex items-center gap-3.5 px-4 py-3.5 transition-all border-b border-slate-100 last:border-0",
    isClickable && "hover:bg-sky-50/40 cursor-pointer",
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
