"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/portal/lib/utils";
import { useT } from "@/portal/i18n";

type BadgeTone = "neutral" | "brand" | "success" | "warn" | "danger" | "info" | "violet";

interface ChartTabHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: { count: number; tone?: BadgeTone } | null;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function ChartTabHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  backHref,
  backLabel,
  className,
}: ChartTabHeaderProps) {
  const t = useT();
  const badgeTone = badge?.tone ?? "neutral";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 flex-wrap rounded-2xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-2xs",
        className
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {icon ? (
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs flex items-center justify-center shrink-0">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-800 mb-1 transition-colors"
            >
              <ChevronLeft size={12} />
              <span>{backLabel ?? t("chart.backToList")}</span>
            </Link>
          ) : null}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h1>
            {badge && badge.count > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full text-[11px] font-extrabold border shadow-2xs",
                  badgeTone === "brand" &&
                    "bg-sky-50 text-sky-800 border-sky-200",
                  badgeTone === "success" &&
                    "bg-emerald-50 text-emerald-800 border-emerald-200",
                  badgeTone === "warn" &&
                    "bg-amber-50 text-amber-800 border-amber-200",
                  badgeTone === "danger" &&
                    "bg-rose-50 text-rose-800 border-rose-200",
                  badgeTone === "info" &&
                    "bg-sky-50 text-sky-800 border-sky-200",
                  badgeTone === "neutral" &&
                    "bg-slate-100 text-slate-700 border-slate-200",
                  badgeTone === "violet" &&
                    "bg-purple-50 text-purple-800 border-purple-200"
                )}
              >
                {badge.count}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
