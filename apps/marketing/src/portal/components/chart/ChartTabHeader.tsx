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

/**
 * Header for any patient-chart drill-down tab. Title, optional icon,
 * count badge, subtitle, and a right-aligned action slot.
 *
 * `backHref` is optional; when set, shows a small "back to patient" link
 * above the title (used by some tabs that are reached via deep links).
 */
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
        "flex items-start justify-between gap-4 flex-wrap rounded-2xl border border-border/70 bg-surface p-4 md:p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon ? (
          <div className="h-11 w-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-text mb-1 transition-colors"
            >
              <ChevronLeft size={11} />
              {backLabel ?? t("chart.backToList")}
            </Link>
          ) : null}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-xl font-bold text-text tracking-tight">
              {title}
            </h1>
            {badge && badge.count > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold border",
                  badgeTone === "brand" &&
                    "bg-brand-soft text-brand border-brand/20",
                  badgeTone === "success" &&
                    "bg-success-soft text-emerald-700 border-emerald-200/50",
                  badgeTone === "warn" &&
                    "bg-warn-soft text-amber-700 border-amber-200/50",
                  badgeTone === "danger" &&
                    "bg-danger-soft text-red-700 border-red-200/50",
                  badgeTone === "info" &&
                    "bg-info-soft text-sky-700 border-sky-200/50",
                  badgeTone === "neutral" &&
                    "bg-surface-2 text-text-soft border-border/50",
                  badgeTone === "violet" &&
                    "bg-violet-50 text-violet-700 border-violet-200/50"
                )}
              >
                {badge.count}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
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
