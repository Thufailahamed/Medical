"use client";

/**
 * Patient pages share the admin / doctor workspace look: ink hero with a
 * floating stat strip, white hairline panels, accent-rail list rows. This
 * module re-exports those primitives plus a few patient-side helpers so
 * every Health & Care page imports from one place.
 */

import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

import { cn } from "@/portal/lib/utils";
import { PANEL as PANEL_CLASS } from "@/portal/components/doctor/Workspace";

export {
  DoctorHero as PatientHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  PrimaryLink,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  SecondaryLink,
  Segmented,
  SOFT_TILE,
  StatTile,
} from "@/portal/components/doctor/Workspace";
export { InfoField } from "@/portal/components/admin/AdminDirectory";

/** Amber "needs attention" chip for the ink hero. */
export const HERO_ATTENTION_CHIP =
  "inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25";

/** Rose "critical" chip for the ink hero. */
export const HERO_DANGER_CHIP =
  "inline-flex items-center gap-2 rounded-lg border border-rose-300/30 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/30";

/** Small uppercase mono label used above groups inside a panel. */
export const GROUP_LABEL =
  "font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400";

/** Form controls that sit on white panels. */
export const FIELD_LABEL = "block text-xs font-semibold text-slate-700";
export const FIELD_INPUT =
  "mt-1.5 block h-10 w-full rounded-lg bg-white px-3 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] outline-none transition-shadow placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_#0284c7] disabled:bg-slate-50 disabled:text-slate-500";
export const FIELD_TEXTAREA =
  "mt-1.5 block w-full rounded-lg bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] outline-none transition-shadow placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_#0284c7]";

/** Page wrapper — same width, rhythm and link treatment as admin pages. */
export function PatientPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Title with the sky→teal gradient accent used across the hero plates. */
export function HeroAccent({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/** Live green dot for hero chips. */
export function LiveDot({ tone = "emerald" }: { tone?: "emerald" | "amber" | "sky" }) {
  const color = tone === "amber" ? "bg-amber-400" : tone === "sky" ? "bg-sky-400" : "bg-emerald-400";
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

/** Square gradient tile shown left of the hero title on detail pages. */
export function HeroTile({
  children,
  tone = "from-sky-400 to-blue-600",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br text-white shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/25",
        tone,
      )}
    >
      {children}
    </span>
  );
}

/** Loading placeholder rows for panels. */
export function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("mt-5 space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

/** Inline error block with retry, styled for white panels. */
export function PanelError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-xl bg-rose-50/60 px-6 py-7 text-center">
      <p className="text-sm font-semibold text-slate-900">We couldn&apos;t load this right now</p>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        {message ?? "Refresh the page or check your connection. Your data is safe."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Tone maps shared by rows, rails and icon tiles. */
export type Tone = "sky" | "emerald" | "amber" | "rose" | "violet" | "slate";

export const TONE_TILE: Record<Tone, string> = {
  sky: "bg-sky-50 text-sky-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-500",
};

export const TONE_RAIL: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-300",
};

export const TONE_BADGE: Record<Tone, string> = {
  sky: "bg-sky-50 text-sky-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
};

/** Small status badge (rounded-md, 11px). */
export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Admin-queue style row: accent rail + tone tile + body + trailing. */
export function RailRow({
  tone,
  active = true,
  icon,
  title,
  meta,
  trailing,
  className,
  children,
}: {
  tone: Tone;
  /** Inactive rows drop the rail and fade to slate. */
  active?: boolean;
  icon: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-wrap items-center gap-3.5 rounded-xl p-3.5 transition-all sm:flex-nowrap",
        active
          ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
          : "bg-slate-50/70 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
        className,
      )}
    >
      <span
        className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", active ? TONE_RAIL[tone] : "bg-transparent")}
        aria-hidden
      />
      <span
        className={cn(
          "ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
          active ? TONE_TILE[tone] : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
          {title}
        </span>
        {meta ? <span className="mt-0.5 block truncate text-xs text-slate-400">{meta}</span> : null}
        {children}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </div>
  );
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function todayLong(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/* ─── Admin-dashboard rail widgets ─────────────────────────────────────── */

export type QuickTool = {
  href: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  /** Gradient + glow classes, e.g. "from-sky-500 to-blue-600 shadow-sky-500/30". */
  tone: string;
};

/** "Quick tools" panel — gradient icon tiles in a 3-up grid. */
export function QuickToolsPanel({
  id,
  title = "Shortcuts",
  tag = "One click",
  tools,
}: {
  id: string;
  title?: string;
  tag?: string;
  tools: QuickTool[];
}) {
  return (
    <section className={PANEL_CLASS} aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
          {title}
        </h2>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{tag}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href + t.label}
              href={t.href}
              className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
                  t.tone,
                )}
              >
                <Icon size={19} aria-hidden />
              </span>
              <span className="w-full min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-slate-900">{t.label}</span>
                <span className="block truncate text-[11px] text-slate-400">{t.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Segmented proportion bar + legend (admin "Users by role"). */
export function BreakdownBar({
  items,
  total,
  max = 7,
  onSelect,
  activeKey,
}: {
  items: Array<{ key: string; label: string; count: number; color: string }>;
  total: number;
  max?: number;
  onSelect?: (key: string) => void;
  activeKey?: string;
}) {
  const shown = items.filter((i) => i.count > 0);
  return (
    <>
      <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {shown.map((i) => (
          <span
            key={i.key}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", i.color)}
            style={{ width: `${total > 0 ? (i.count / total) * 100 : 0}%` }}
            title={`${i.label} · ${i.count}`}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-0.5">
        {shown.slice(0, max).map((i) => {
          const body = (
            <>
              <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", i.color)} />
              <span className="min-w-0 flex-1 truncate text-left text-slate-700">{i.label}</span>
              <span className="text-[11px] tabular-nums text-slate-400">
                {total > 0 ? Math.round((i.count / total) * 100) : 0}%
              </span>
              <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                {i.count}
              </span>
            </>
          );
          const cls = cn(
            "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-slate-50",
            activeKey === i.key && "bg-sky-50 hover:bg-sky-50",
          );
          return (
            <li key={i.key}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(i.key)} aria-pressed={activeKey === i.key} className={cls}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
        {shown.length > max ? (
          <li className="pt-1 text-[11px] font-medium text-slate-400">+{shown.length - max} more</li>
        ) : null}
      </ul>
    </>
  );
}

/** Dark indigo promo link card (admin "Marketing" tile). */
export function PromoCard({
  href,
  kicker,
  title,
  body,
  icon,
}: {
  href: string;
  kicker: string;
  title: React.ReactNode;
  body: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
      style={{
        background:
          "radial-gradient(420px 200px at 100% 0%, rgba(244,114,182,0.30), transparent 60%), radial-gradient(300px 160px at 0% 100%, rgba(129,140,248,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
      }}
    >
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
      <span className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 rounded-full border border-white/10" aria-hidden />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-pink-200 ring-1 ring-inset ring-white/15 backdrop-blur">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pink-200/80">
          {kicker}
        </span>
        <span className="mt-1 block text-lg font-semibold tracking-[-0.01em]">{title}</span>
        <span className="block text-xs text-white/60">{body}</span>
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

/** Glass metric tile for the hero `aside` slot (admin "Activity today"). */
export function HeroPulse({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[13.5rem] items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sky-300">{label}</span>
        <span className="mt-0.5 block text-2xl font-semibold leading-none tracking-[-0.02em] text-white tabular-nums">
          {value}
        </span>
        {sub ? <span className="mt-1 block text-[11px] text-white/55">{sub}</span> : null}
      </span>
    </div>
  );
}

/** Admin "Needs attention" row as a link — rail + tile + body + count/Clear + chevron. */
export function QueueRow({
  href,
  onClick,
  tone,
  icon,
  label,
  hint,
  count,
  clearLabel = "Clear",
}: {
  href?: string;
  onClick?: () => void;
  tone: Tone;
  icon: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  count: number;
  clearLabel?: string;
}) {
  const open = count > 0;
  const cls = cn(
    "group relative flex w-full items-center gap-3.5 rounded-xl p-3.5 text-left transition-all hover:-translate-y-px",
    open
      ? "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
      : "bg-slate-50/70 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]",
  );
  const body = (
    <>
      <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", open ? TONE_RAIL[tone] : "bg-transparent")} aria-hidden />
      <span
        className={cn(
          "ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
          open ? TONE_TILE[tone] : "bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">{label}</span>
        {hint ? <span className="block truncate text-xs text-slate-400">{hint}</span> : null}
      </span>
      {open ? (
        <span className="grid h-6 min-w-[28px] place-items-center rounded-full bg-slate-900 px-2 text-[11px] font-bold tabular-nums text-white">
          {count}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 size={12} aria-hidden />
          {clearLabel}
        </span>
      )}
      <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** Admin "Today's activity" soft metric tile. */
export function MetricTile({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[24px] font-semibold leading-none tracking-[-0.03em] text-slate-900 tabular-nums">{value}</span>
        <span className="mt-1.5 block truncate text-xs text-slate-400">{label}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3.5 rounded-xl bg-slate-50 p-4 transition-all";
  return href ? (
    <Link
      href={href}
      className={cn(cls, "hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_-10px_rgba(15,23,42,0.2),inset_0_0_0_1px_rgba(15,23,42,0.07)]")}
    >
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
