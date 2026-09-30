"use client";

/**
 * Doctor-workspace building blocks — shared by the dashboard, queue and
 * schedule so every clinic page reads the same: an ink hero with an ECG
 * trace, a stat strip (or any card) floating over its bottom edge, and
 * white hairline panels below.
 */

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";

import { cn } from "@/portal/lib/utils";

/** White surface with a whisper hairline — mirrors the patient home cards. */
export const PANEL =
  "rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] sm:p-6";

/** Soft tile used inside panels (quick tools, walk-in cards). */
export const SOFT_TILE =
  "rounded-xl bg-slate-50 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_-10px_rgba(15,23,42,0.2),inset_0_0_0_1px_rgba(15,23,42,0.07)]";

/** Row card used by the clinical ledgers (prescriptions, labs, notes…). */
export const LIST_ROW =
  "group relative flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)] sm:flex-row sm:items-center sm:justify-between";

/** Dark primary button for panels (pairs with the ink hero). */
export const PRIMARY_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50";

/** Hairline secondary button for panels. */
export const SECONDARY_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-50";

/** Quiet text link with an arrow, used on row trailing edges. */
export const ROW_LINK =
  "group/v inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50";

/** Glass button for use on the ink hero. */
export const HERO_GHOST =
  "inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/20 bg-white/[0.06] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12] disabled:opacity-50";

/** White primary button for use on the ink hero. */
export const HERO_PRIMARY =
  "inline-flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-sm font-semibold text-[#07233a] transition-all hover:-translate-y-px hover:bg-sky-50";

/** Small glass chip for status lines on the hero. */
export const HERO_CHIP =
  "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/85";

export function DoctorHero({
  kicker,
  kickerIcon,
  kickerMeta,
  title,
  description,
  chips,
  actions,
  aside,
  leading,
  /** Reserve room at the bottom for an overlapping strip. */
  overlap = true,
}: {
  kicker: React.ReactNode;
  kickerIcon?: React.ReactNode;
  kickerMeta?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  chips?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional glass widget shown above the actions on the right. */
  aside?: React.ReactNode;
  /** Optional avatar / tile shown left of the title block. */
  leading?: React.ReactNode;
  overlap?: boolean;
}) {
  return (
    <header
      className="relative overflow-hidden rounded-[20px] text-white"
      style={{
        background:
          "radial-gradient(900px 400px at 100% 0%, rgba(14,165,233,0.35), transparent 60%), radial-gradient(600px 320px at 0% 100%, rgba(20,184,166,0.18), transparent 60%), #07233a",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.08), 0 24px 48px -20px rgba(7,35,58,0.55)",
      }}
    >
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[60%] text-sky-300/25 md:block"
        viewBox="0 0 600 220"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          d="M0 132 H250 l14 -34 12 70 16 -104 12 88 14 -20 H420 l10 -18 10 30 10 -12 H600"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className={cn(
          "relative z-10 px-6 pt-6 md:px-8 md:pt-8",
          overlap ? "pb-20 md:pb-24" : "pb-6 md:pb-8",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 max-w-3xl items-start gap-5">
          {leading ? <div className="hidden shrink-0 sm:block">{leading}</div> : null}
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
              {kickerIcon}
              <span>{kicker}</span>
              {kickerMeta ? (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-white/60">{kickerMeta}</span>
                </>
              ) : null}
            </div>
            <h1 className="mt-3 text-[clamp(26px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">{description}</p>
            ) : null}
            {chips ? <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div> : null}
          </div>
          </div>
          {aside ? (
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              {aside}
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          ) : actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Wraps content so it floats over the hero's bottom edge. */
export function HeroOverlap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative z-10 -mt-14 px-3 md:-mt-16 md:px-6", className)}>{children}</div>
  );
}

export function StatTile({
  href,
  label,
  icon,
  tone,
  value,
  unit,
  sub,
  progress,
  badge,
  pulse = false,
  active = false,
  onClick,
  chart,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  tone: string;
  value: string;
  unit?: string;
  sub: string;
  progress?: number | null;
  badge?: { text: string; tone: string };
  pulse?: boolean;
  /** Highlights the tile when it doubles as a filter. */
  active?: boolean;
  onClick?: () => void;
  /** Tiny inline visual (e.g. sparkline) shown beside the value. */
  chart?: React.ReactNode;
}) {
  const className = cn(
    "group flex min-h-[112px] w-full flex-col justify-between gap-3 rounded-2xl bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5",
    active
      ? "shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_2px_#0284c7]"
      : "shadow-[0_16px_40px_-16px_rgba(15,23,42,0.22),inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_24px_52px_-18px_rgba(15,23,42,0.3),inset_0_0_0_1px_rgba(15,23,42,0.07)]",
  );

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-transform group-hover:scale-105",
              tone,
            )}
            aria-hidden
          >
            {icon}
            {pulse ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-amber-500" />
            ) : null}
          </span>
          <span className="truncate text-[13px] font-medium text-slate-500">{label}</span>
        </span>
        {badge ? (
          <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", badge.tone)}>
            {badge.text}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-baseline gap-1">
            <span className="truncate text-[26px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">
              {value}
            </span>
            {unit ? <span className="text-xs font-medium text-slate-400">{unit}</span> : null}
          </span>
          <span className="mt-1.5 block truncate text-xs text-slate-400">{sub}</span>
        </span>
        {chart ? <span className="shrink-0" aria-hidden>{chart}</span> : null}
      </span>
      {progress != null ? (
        <span className="-mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <span
            className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (!onClick) {
    return <div className={cn(className, "hover:translate-y-0")}>{body}</div>;
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {body}
    </button>
  );
}

export function PanelHeader({
  id,
  icon,
  tone,
  title,
  caption,
  href,
  linkLabel,
  action,
}: {
  id?: string;
  icon: React.ReactNode;
  tone: string;
  title: React.ReactNode;
  caption?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  /** Extra control rendered on the right (instead of or before the link). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", tone)} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="truncate text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">
            {title}
          </h2>
          {caption ? <p className="mt-0.5 truncate text-xs text-slate-400">{caption}</p> : null}
        </div>
      </div>
      {href || action ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {href ? (
            <Link
              href={href}
              className="group/link -mr-1.5 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
            >
              {linkLabel}
              <ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyBlock({
  icon,
  title,
  body,
  actions,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-5 flex flex-col items-center rounded-xl bg-slate-50 px-6 py-8 text-center", className)}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-sky-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{body}</p>
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={PRIMARY_BTN}>
      {icon}
      {children}
    </Link>
  );
}

export function SecondaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={SECONDARY_BTN}>
      {icon}
      {children}
    </Link>
  );
}

/** Soft segmented control — raised white active segment on a slate track. */
export function Segmented<T extends string | null>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value ?? "all")}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {o.icon}
            {o.label}
            {o.count != null ? (
              <span
                className={cn(
                  "rounded px-1.5 text-[10.5px] font-semibold tabular-nums",
                  active ? "bg-sky-50 text-sky-700" : "bg-slate-200/70 text-slate-500",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Soft search field for panel toolbars. */
export function PanelSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full lg:max-w-md", className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-10 w-full rounded-xl bg-slate-50 pl-10 pr-9 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

/** Coloured left rail on a LIST_ROW. */
export function RowAccent({ className }: { className?: string }) {
  return (
    <span
      className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", className ?? "bg-slate-200")}
      aria-hidden
    />
  );
}
