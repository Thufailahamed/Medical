"use client";

import Link from "next/link";

import { cn } from "@/portal/lib/utils";

import type { CardAccent } from "./Card";

const TONE: Record<
  Exclude<CardAccent, "none">,
  { blob: string; shine: string; lightBg: string; accent: string }
> = {
  brand: {
    blob: "bg-brand",
    shine: "bg-brand",
    lightBg: "bg-blue-50",
    accent: "text-brand",
  },
  sky: {
    blob: "bg-sky-500",
    shine: "bg-sky-500",
    lightBg: "bg-sky-50",
    accent: "text-sky-600",
  },
  violet: {
    blob: "bg-violet-500",
    shine: "bg-violet-500",
    lightBg: "bg-violet-50",
    accent: "text-violet-600",
  },
  amber: {
    blob: "bg-amber-500",
    shine: "bg-amber-500",
    lightBg: "bg-amber-50",
    accent: "text-amber-600",
  },
  green: {
    blob: "bg-emerald-500",
    shine: "bg-emerald-500",
    lightBg: "bg-emerald-50",
    accent: "text-emerald-600",
  },
  rose: {
    blob: "bg-rose-500",
    shine: "bg-rose-500",
    lightBg: "bg-rose-50",
    accent: "text-rose-600",
  },
};

/**
 * Summary tile matching the doctor portal StatCard: icon badge,
 * pastel corner blob, large number, caption.
 */
export function StatTile({
  label,
  value,
  unit,
  sublabel,
  delta,
  deltaTone = "neutral",
  icon,
  href,
  accent = "brand",
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  sublabel?: string;
  delta?: string | null;
  deltaTone?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  href?: string;
  accent?: Exclude<CardAccent, "none">;
  className?: string;
}) {
  const tone = TONE[accent];
  const deltaColor =
    deltaTone === "up"
      ? "text-success"
      : deltaTone === "down"
        ? "text-danger"
        : "text-text-soft";

  const body = (
    <div
      className={cn(
        "patient-card group relative w-full overflow-hidden p-4 md:p-5 transition-all duration-300 hover:-translate-y-0.5",
        className
      )}
    >
      <div className={cn("patient-card-blob", tone.blob)} aria-hidden />
      <div className={cn("patient-card-shine", tone.shine)} aria-hidden />

      <div className="relative z-10 flex items-start gap-3">
        {icon ? (
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-md transition-transform duration-300 group-hover:scale-105",
              tone.lightBg,
              tone.accent
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="pt-kicker pt-kicker-muted">{label}</p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="pt-metric text-[26px] leading-none text-text">
              {value}
            </span>
            {unit ? <span className="text-sm font-medium text-text-muted">{unit}</span> : null}
          </p>
          {sublabel ? (
            <p className="mt-1 text-[11px] text-text-muted">{sublabel}</p>
          ) : null}
          {delta != null ? (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1.5 text-xs font-medium",
                deltaColor,
              )}
            >
              <span
                className={cn(
                  "pt-dot",
                  deltaTone === "down"
                    ? "bg-danger"
                    : deltaTone === "up"
                      ? "bg-success"
                      : "bg-text-muted",
                )}
              />
              {delta}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group flex">
        {body}
      </Link>
    );
  }

  return body;
}
