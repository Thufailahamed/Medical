"use client";

import Link from "next/link";

import { cn } from "@/portal/lib/utils";

import type { CardAccent } from "./Card";

const TONE: Record<
  Exclude<CardAccent, "none">,
  { fill: string; glyph: string }
> = {
  brand: { fill: "bg-brand-soft", glyph: "text-brand" },
  sky: { fill: "bg-sky-50", glyph: "text-sky-600" },
  violet: { fill: "bg-violet-50", glyph: "text-violet-600" },
  amber: { fill: "bg-amber-50", glyph: "text-amber-600" },
  green: { fill: "bg-emerald-50", glyph: "text-emerald-600" },
  rose: { fill: "bg-rose-50", glyph: "text-rose-600" },
};

/**
 * Buyer-portal metric tile (mirrors project-5 `StatTile`): tinted square
 * icon tile, mono tabular value, uppercase micro label, tone change chip.
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
  const deltaStyles =
    deltaTone === "up"
      ? "bg-success-soft text-success"
      : deltaTone === "down"
        ? "bg-danger-soft text-danger"
        : "bg-surface-2 text-text-soft";

  const body = (
    <div
      className={cn(
        "patient-card group relative w-full overflow-hidden p-4 md:p-5 transition-all duration-300 hover:-translate-y-0.5",
        className
      )}
    >
      <div className="relative z-10 flex items-start gap-3">
        {icon ? (
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md transition-transform duration-300 group-hover:scale-105",
              tone.fill,
              tone.glyph
            )}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="t-label">{label}</p>
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
            <p className="mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  deltaStyles,
                )}
              >
                <span
                  aria-hidden
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
              </span>
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
