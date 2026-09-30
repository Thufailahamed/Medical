"use client";

/**
 * Admin directory scaffold — the admin-dashboard look (ink hero, floating
 * stat strip, hairline panel) wrapped around a searchable, filterable list
 * of people or tenants. Pages own the data + filter state; this owns layout,
 * search and the row chrome.
 */

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy } from "lucide-react";

import { Avatar } from "@/portal/components/ui/Avatar";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  ROW_LINK,
  RowAccent,
  Segmented,
} from "@/portal/components/doctor/Workspace";

export type DirectoryMeta = {
  icon?: React.ReactNode;
  text: React.ReactNode;
  mono?: boolean;
  /** Hidden below the sm breakpoint. */
  wide?: boolean;
};

export type DirectoryRow = {
  id: string;
  name: string;
  href?: string;
  onClick?: () => void;
  /** Replaces the default initials avatar. */
  leading?: React.ReactNode;
  badges?: React.ReactNode;
  meta?: DirectoryMeta[];
  /** Tailwind bg class for the left rail. */
  accent?: string;
  /** Extra text the search box should match (email, phone, licence…). */
  searchText?: string;
  actions?: React.ReactNode;
  /** Label for the trailing link (defaults to "Open"). */
  linkLabel?: string;
};

export function statusTone(status?: string | null): "success" | "warn" | "danger" | "neutral" {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "approved":
    case "verified":
      return "success";
    case "pending":
    case "pending_approval":
    case "invited":
      return "warn";
    case "suspended":
    case "rejected":
    case "banned":
      return "danger";
    default:
      return "neutral";
  }
}

export function statusRail(status?: string | null) {
  return {
    success: "bg-emerald-500",
    warn: "bg-amber-400",
    danger: "bg-red-500",
    neutral: "bg-slate-300",
  }[statusTone(status)];
}

export function humanize(v?: string | null) {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function withinDays(iso: string | null | undefined, days: number, now: number) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !isNaN(t) && now - t <= days * 86_400_000;
}

export function AdminDirectory<F extends string>({
  hero,
  stats,
  title,
  icon,
  tone = "bg-sky-50 text-sky-600",
  rows,
  total,
  loading,
  searchPlaceholder = "Search…",
  segmented,
  toolbar,
  empty,
  aside,
  children,
}: {
  hero: React.ReactNode;
  stats: React.ReactNode;
  title: string;
  icon: React.ReactNode;
  tone?: string;
  rows: DirectoryRow[];
  total: number;
  loading: boolean;
  searchPlaceholder?: string;
  segmented?: {
    value: F;
    onChange: (v: F) => void;
    options: Array<{ value: F; label: React.ReactNode; count?: number }>;
  };
  /** Extra controls next to the filter (e.g. a role select). */
  toolbar?: React.ReactNode;
  empty: { icon: React.ReactNode; title: string; body: string; actions?: React.ReactNode };
  /** Optional right rail (xl: 4 of 12 columns). */
  aside?: React.ReactNode;
  /** Rendered after the grid (modals, drawers). */
  children?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) => `${r.name} ${r.searchText ?? ""}`.toLowerCase().includes(term))
    : rows;

  const list = (
    <section className={cn(PANEL, "min-w-0", aside && "xl:col-span-8")} aria-label={title}>
      <PanelHeader
        icon={icon}
        tone={tone}
        title={title}
        caption={loading ? "Loading…" : `${shown.length} of ${total} shown${term ? ` · matching “${q.trim()}”` : ""}`}
      />

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PanelSearch value={q} onChange={setQ} placeholder={searchPlaceholder} ariaLabel={`Search ${title.toLowerCase()}`} />
        {segmented || toolbar ? (
          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            {segmented ? (
              <Segmented<F>
                ariaLabel="Filter"
                value={segmented.value}
                onChange={segmented.onChange}
                options={segmented.options}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-5 space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyBlock
          icon={empty.icon}
          title={term ? "No matches" : empty.title}
          body={term ? `Nothing matches “${q.trim()}”. Try a name, email or phone.` : empty.body}
          actions={
            term ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
              >
                Clear search
              </button>
            ) : (
              empty.actions
            )
          }
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((r) => (
            <DirectoryItem key={r.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      <div>
        {hero}
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats}</HeroOverlap>
      </div>
      {aside ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          {list}
          <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4">{aside}</aside>
        </div>
      ) : (
        list
      )}
      {children}
    </div>
  );
}

function DirectoryItem({ row }: { row: DirectoryRow }) {
  const main = (
    <>
      {row.leading ?? <Avatar name={row.name} size="md" className="h-10 w-10 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
            {row.name}
          </span>
          {row.badges}
        </span>
        {row.meta?.length ? (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {row.meta.map((m, i) => (
              <span
                key={i}
                className={cn(
                  "min-w-0 items-center gap-1 truncate",
                  m.wide ? "hidden sm:inline-flex" : "inline-flex",
                  m.mono && "font-mono text-[11px]",
                )}
              >
                {m.icon}
                {m.text}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  const mainClass = "flex min-w-0 flex-1 items-center gap-3.5 pl-1.5 text-left";
  return (
    <li className={LIST_ROW}>
      <RowAccent className={row.accent} />
      {row.href ? (
        <Link href={row.href} className={mainClass}>
          {main}
        </Link>
      ) : row.onClick ? (
        <button type="button" onClick={row.onClick} className={cn(mainClass, "cursor-pointer")}>
          {main}
        </button>
      ) : (
        <div className={mainClass}>{main}</div>
      )}
      {row.actions || row.href || row.onClick ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-1.5 sm:pl-0">
          {row.actions}
          {row.href ? (
            <Link href={row.href} className={ROW_LINK}>
              {row.linkLabel ?? "Open"}
              <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
            </Link>
          ) : row.onClick ? (
            <button type="button" onClick={row.onClick} className={ROW_LINK}>
              {row.linkLabel ?? "Open"}
              <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Small gradient tile used as a row's leading icon for organisations. */
export function OrgTile({ icon, tone }: { icon: React.ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br text-white shadow-sm",
        tone,
      )}
    >
      {icon}
    </span>
  );
}

/** Row action buttons. */
export const ROW_BTN_APPROVE =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:opacity-50";
export const ROW_BTN_QUIET =
  "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50";
export const ROW_BTN_DANGER =
  "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50";

/** Label/value tile for detail pages, with an optional hover copy button. */
export function InfoField({
  icon,
  label,
  children,
  mono,
  copyValue,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  copyValue?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group/f flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
        <dd className={cn("mt-0.5 truncate text-sm font-medium text-slate-900", mono && "font-mono text-[13px]")}>{children}</dd>
      </div>
      {copyValue ? (
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(copyValue).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 opacity-0 transition-all hover:bg-white hover:text-slate-700 focus-visible:opacity-100 group-hover/f:opacity-100"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      ) : null}
    </div>
  );
}
