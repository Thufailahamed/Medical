"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Globe,
  Layers,
  Loader2,
  PenLine,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  RowAccent,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { ROW_BTN_QUIET } from "@/portal/components/admin/AdminDirectory";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { ExportButton } from "@/portal/components/admin/ExportButton";

type Row = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

type Page = { items: Row[]; total: number; limit: number; offset: number };

const PAGE_SIZE = 200;

const FILTER_INPUT =
  "h-10 w-full rounded-xl bg-slate-50 px-3.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)] sm:w-44";

type Cat = "danger" | "warn" | "success" | "neutral";

function actionCategory(action: string): Cat {
  const a = action.toLowerCase();
  if (/(delete|reject|suspend|fail|remove|ban|deny)/.test(a)) return "danger";
  if (/(impersonate|export|update|edit|step_up)/.test(a)) return "warn";
  if (/(approve|create|complete|paid|verify|login|activate)/.test(a)) return "success";
  return "neutral";
}

const CAT_TILE: Record<Cat, string> = {
  danger: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-600",
  success: "bg-emerald-50 text-emerald-600",
  neutral: "bg-sky-50 text-sky-600",
};

const CAT_RAIL: Record<Cat, string> = {
  danger: "bg-red-500",
  warn: "bg-amber-400",
  success: "bg-emerald-500",
  neutral: "bg-slate-300",
};

const CAT_PILL: Record<Cat, "danger" | "warn" | "success" | "info"> = {
  danger: "danger",
  warn: "warn",
  success: "success",
  neutral: "info",
};

const CAT_ICON: Record<Cat, React.ReactNode> = {
  danger: <AlertTriangle size={17} aria-hidden />,
  warn: <PenLine size={17} aria-hidden />,
  success: <CheckCircle2 size={17} aria-hidden />,
  neutral: <Activity size={17} aria-hidden />,
};

export default function AdminAuditPage() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = {
    userId: userId.trim() || undefined,
    action: action.trim() || undefined,
    resource: resource.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const activeFilterCount = [filters.userId, filters.action, filters.resource, filters.from, filters.to].filter(Boolean).length;
  const filtersOn = activeFilterCount > 0;

  function clearFilters() {
    setUserId("");
    setAction("");
    setResource("");
    setFrom("");
    setTo("");
  }

  const query = useInfiniteQuery({
    queryKey: adminQk.audit(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (filters.userId) qs.set("userId", filters.userId);
      if (filters.action) qs.set("action", filters.action);
      if (filters.resource) qs.set("resource", filters.resource);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(pageParam));
      return adminApi<Page>(`/admin/audit?${qs.toString()}`);
    },
    getNextPageParam: (last) =>
      last.items.length === PAGE_SIZE ? last.offset + PAGE_SIZE : undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  // Today's platform-wide event count — shares the dashboard cache entry.
  const { data: dash } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<{ today: { auditEvents: number } }>("/admin/dashboard"),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<ScrollText size={13} aria-hidden />}
          kicker="Operations"
          kickerMeta={dash ? `${dash.today.auditEvents.toLocaleString()} events today` : "Audit trail"}
          title={
            <>
              System{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                audit log
              </span>
            </>
          }
          description="Every administrative action on the platform — who did it, on what resource, from where, and when."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Immutable record
              </span>
              {filtersOn ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Filter size={12} aria-hidden />
                  {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isRefetching}
                className={HERO_GHOST}
              >
                <RefreshCw size={15} className={cn(query.isRefetching && "animate-spin")} aria-hidden />
                {query.isRefetching ? "Refreshing…" : "Refresh"}
              </button>
              <div className="[&_button]:h-10 [&_button]:rounded-[10px]">
                <ExportButton
                  exportPath="audit"
                  filters={{
                    userId: filters.userId,
                    action: filters.action,
                    resource: filters.resource,
                  }}
                />
              </div>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Events today"
            icon={<Activity size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={dash ? dash.today.auditEvents.toLocaleString() : "…"}
            sub="Across the whole platform"
          />
          <StatTile
            label="Matching"
            icon={<ScrollText size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={query.data ? total.toLocaleString() : "…"}
            sub={filtersOn ? "With current filters" : "All recorded events"}
          />
          <StatTile
            label="Loaded"
            icon={<Layers size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={items.length.toLocaleString()}
            sub={query.hasNextPage ? "More pages available" : "End of the trail"}
          />
          <StatTile
            label="Filters"
            icon={<SlidersHorizontal size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(activeFilterCount)}
            sub={filtersOn ? "Narrowing the stream" : "No filters applied"}
            badge={filtersOn ? { text: "Reset", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={filtersOn}
            onClick={filtersOn ? clearFilters : undefined}
          />
        </HeroOverlap>
      </div>

      {/* ── Event stream ───────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="audit-list">
        <PanelHeader
          id="audit-list"
          icon={<ScrollText size={16} />}
          tone="bg-slate-100 text-slate-600"
          title="Event stream"
          caption={
            query.isLoading
              ? "Loading events…"
              : `${items.length.toLocaleString()} of ${total.toLocaleString()} loaded${filtersOn ? " · filtered" : ""}`
          }
          action={
            filtersOn ? (
              <button type="button" onClick={clearFilters} className={ROW_BTN_QUIET}>
                <X size={12} />
                Reset
              </button>
            ) : undefined
          }
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="User ID…"
            aria-label="Filter by user ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={FILTER_INPUT}
          />
          <input
            type="text"
            placeholder="Action prefix (admin.)…"
            aria-label="Filter by action prefix"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={FILTER_INPUT}
          />
          <input
            type="text"
            placeholder="Resource (user|doctor|…)…"
            aria-label="Filter by resource"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className={FILTER_INPUT}
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={cn(FILTER_INPUT, "sm:w-40")}
            title="From date"
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={cn(FILTER_INPUT, "sm:w-40")}
            title="To date"
            aria-label="To date"
          />
        </div>

        {query.isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyBlock
            icon={<ScrollText size={19} />}
            title={filtersOn ? "No matching events" : "No events yet"}
            body={
              filtersOn
                ? "Nothing matches the current filter set — widen the dates or clear a field."
                : "Administrative actions will be recorded here as they happen."
            }
            actions={
              filtersOn ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((row) => {
                const cat = actionCategory(row.action);
                return (
                  <li key={row.id} className={LIST_ROW}>
                    <RowAccent className={CAT_RAIL[cat]} />
                    <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", CAT_TILE[cat])}>
                        {CAT_ICON[cat]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-[13px] font-semibold text-slate-900">
                            {row.action}
                          </span>
                          <Pill tone={CAT_PILL[cat]}>{row.resource}</Pill>
                          {row.resourceId ? (
                            <span className="font-mono text-[11px] text-slate-400">
                              {row.resourceId.slice(0, 8)}…
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock size={11} aria-hidden />
                            {new Date(row.createdAt).toLocaleString()}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px]">
                            <User size={11} aria-hidden />
                            {row.userId ? `${row.userId.slice(0, 8)}…` : "system"}
                          </span>
                          {row.ip ? (
                            <span className="hidden items-center gap-1 font-mono text-[11px] sm:inline-flex">
                              <Globe size={11} aria-hidden />
                              {row.ip}
                            </span>
                          ) : null}
                          {row.details ? (
                            <span className="inline-flex min-w-0 items-center gap-1 truncate" title={row.details}>
                              <FileText size={11} aria-hidden />
                              {row.details}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {query.hasNextPage ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-50"
                >
                  {query.isFetchingNextPage ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    `Load more · ${(total - items.length).toLocaleString()} remaining`
                  )}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
