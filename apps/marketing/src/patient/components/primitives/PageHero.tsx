"use client";

import { cn } from "@/portal/lib/utils";

export const heroPrimaryAction = "hero-primary";
export const heroSecondaryAction = "hero-secondary";

const TONE_DOT: Record<
  NonNullable<HeroStatusPillProps["tone"]>,
  string
> = {
  success: "bg-success",
  warn: "bg-warn",
  brand: "bg-brand",
  paper: "bg-white/50",
};

interface HeroStatusPillProps {
  label: React.ReactNode;
  tone?: "success" | "warn" | "brand" | "paper";
}

export function HeroStatusPill({ label, tone = "brand" }: HeroStatusPillProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs backdrop-blur-sm">
      <span
        className={cn("size-2 rounded-full", TONE_DOT[tone], "animate-pulse")}
        aria-hidden
      />
      <span className="font-semibold text-white">{label}</span>
    </span>
  );
}

export function PageHero({
  icon,
  kicker,
  title,
  description,
  status,
  actions,
  footer,
  className,
}: {
  icon?: React.ReactNode;
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("pt-hero anim-rise", className)}>
      <div className="relative z-10 p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            {kicker ? (
              <div className="pt-hero-kicker mb-2">
                {icon}
                <span>{kicker}</span>
              </div>
            ) : null}
            <h1 className="pt-hero-title">{title}</h1>
            {description ? <p className="pt-hero-desc mt-2">{description}</p> : null}
          </div>
          {status || actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {status}
              {actions}
            </div>
          ) : null}
        </div>
        {footer ? (
          <div className="pt-hero-footer mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </header>
  );
}
