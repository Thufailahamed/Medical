"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Bell, BellOff, CalendarDays, Check, CheckCheck, ChevronRight, Inbox, Layers, Settings2,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { useT } from "@/portal/i18n";
import { formatDate, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  iconForNotification,
  parseNotificationData,
  resolveDoctorPortalHref,
  toneForNotification,
} from "@/portal/lib/notifications-types";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data?: unknown;
}

const TONE_CHIP: Record<string, string> = {
  info: "bg-sky-50 text-sky-600 ring-sky-600/15",
  success: "bg-emerald-50 text-emerald-600 ring-emerald-600/15",
  warn: "bg-amber-50 text-amber-600 ring-amber-600/15",
  danger: "bg-red-50 text-red-600 ring-red-600/15",
  neutral: "bg-slate-100 text-slate-500 ring-slate-200",
};

const TONE_BAR: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-300",
};

type Filter = "all" | "unread" | "alerts";

function humanizeType(type: string) {
  return type.replace(/[_.-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api<{ notifications: Notification[] }>("/notifications/me"),
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => { await api(`/notifications/${id}/read`, { method: "PUT" }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => { await api("/notifications/read-all", { method: "PUT" }); },
    onSuccess: () => { toast.success(t("notifications.markedAllRead")); qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = unreadData?.count ?? 0;
  const [now] = useState(() => Date.now());

  const stats = useMemo(() => {
    const today = startOfDay(new Date(now));
    let todayCount = 0;
    let week = 0;
    let alerts = 0;
    const byType = new Map<string, number>();
    for (const n of notifications) {
      const ts = Date.parse(n.createdAt);
      if (ts >= today) todayCount++;
      if (ts >= now - 7 * 86_400_000) week++;
      const tone = toneForNotification(n.type, parseNotificationData(n.data));
      if (tone === "danger" || tone === "warn") alerts++;
      byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    }
    const types = [...byType.entries()].sort((a, b) => b[1] - a[1]);
    return { today: todayCount, week, alerts, types };
  }, [notifications, now]);

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "alerts") {
      const tone = toneForNotification(n.type, parseNotificationData(n.data));
      if (tone !== "danger" && tone !== "warn") return false;
    }
    if (typeFilter && n.type !== typeFilter) return false;
    return true;
  });

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    const today = startOfDay(new Date());
    for (const n of filtered) {
      const day = startOfDay(new Date(n.createdAt));
      const diffDays = Math.round((today - day) / 86_400_000);
      const label =
        diffDays === 0
          ? t("common.today")
          : diffDays === 1
            ? t("common.yesterday")
            : formatDate(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [filtered, t]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Bell size={13} aria-hidden />}
          kicker="Activity feed"
          kickerMeta={`${stats.today} today`}
          title={
            <>
              Your{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                notifications
              </span>
            </>
          }
          description={
            unreadCount > 0
              ? t("notifications.subtitle", { count: unreadCount })
              : "You're all caught up. Bookings, lab results, messages and system alerts will appear here."
          }
          chips={
            stats.alerts > 0 ? (
              <button
                type="button"
                onClick={() => setFilter("alerts")}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
              >
                <AlertTriangle size={12} aria-hidden />
                {stats.alerts} need attention
              </button>
            ) : (
              <span className={HERO_CHIP}>
                <CheckCheck size={12} className="text-emerald-300" aria-hidden />
                No alerts
              </span>
            )
          }
          actions={
            <>
              <Link href="/portal/settings" className={HERO_GHOST}>
                <Settings2 size={15} aria-hidden />
                Preferences
              </Link>
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0 || markAllRead.isPending}
                className={cn(HERO_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0")}
              >
                <CheckCheck size={15} className="text-sky-600" aria-hidden />
                {t("notifications.markAllRead")}
              </button>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Unread"
            icon={<Inbox size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(unreadCount)}
            sub={unreadCount > 0 ? "Waiting for you" : "All caught up"}
            pulse={unreadCount > 0}
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
          <StatTile
            label="Needs attention"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(stats.alerts)}
            sub="Warnings & critical alerts"
            badge={stats.alerts > 0 ? { text: "Review", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={filter === "alerts"}
            onClick={() => setFilter("alerts")}
          />
          <StatTile
            label="Last 7 days"
            icon={<CalendarDays size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(stats.week)}
            sub={`${stats.today} today`}
          />
          <StatTile
            label="All notifications"
            icon={<Bell size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(notifications.length)}
            sub="Full history"
            progress={notifications.length > 0 ? Math.round(((notifications.length - unreadCount) / notifications.length) * 100) : null}
            active={filter === "all" && !typeFilter}
            onClick={() => {
              setFilter("all");
              setTypeFilter(null);
            }}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Feed ─────────────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="notif-feed">
          <PanelHeader
            id="notif-feed"
            icon={<Bell size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={typeFilter ? humanizeType(typeFilter) : t("notifications.title")}
            caption={isLoading ? "Loading…" : `${filtered.length} of ${notifications.length} shown`}
            action={
              <Segmented<Filter>
                ariaLabel="Filter notifications"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: t("notifications.showAll") },
                  { value: "unread", label: t("notifications.showUnread"), count: unreadCount },
                  { value: "alerts", label: "Alerts", count: stats.alerts },
                ]}
              />
            }
          />

          {isLoading ? (
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={filter === "unread" ? <BellOff size={19} /> : <Inbox size={19} />}
              title={filter === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")}
              body="New bookings, results, messages and system alerts show up here as they happen."
              actions={
                filter !== "all" || typeFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setTypeFilter(null);
                    }}
                    className={SECONDARY_BTN}
                  >
                    Show everything
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-slate-100" />
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">
                      {group.items.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.items.map((n) => {
                      const data = parseNotificationData(n.data);
                      const tone = toneForNotification(n.type, data);
                      const Icon = iconForNotification(n.type, data);
                      const href = resolveDoctorPortalHref(n.type, data);
                      const chipClass = TONE_CHIP[tone] ?? TONE_CHIP.neutral;
                      const barClass = TONE_BAR[tone] ?? TONE_BAR.neutral;

                      const body = (
                        <>
                          <RowAccent className={n.read ? "bg-transparent" : barClass} />
                          <span className="flex min-w-0 flex-1 items-start gap-3.5 pl-1.5">
                            <span
                              className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                                n.read ? "bg-slate-100 text-slate-400" : chipClass,
                              )}
                            >
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-3">
                                <span
                                  className={cn(
                                    "truncate text-[13.5px]",
                                    n.read ? "font-medium text-slate-600" : "font-semibold text-slate-900",
                                  )}
                                >
                                  {n.title}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                                  {relativeTime(n.createdAt)}
                                </span>
                              </span>
                              {n.body ? (
                                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500">
                                  {n.body}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 self-end pl-1.5 sm:self-center sm:pl-0">
                            {!n.read ? (
                              <button
                                type="button"
                                title={t("notifications.markRead")}
                                aria-label={t("notifications.markRead")}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  markRead.mutate(n.id);
                                }}
                                className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                <Check size={13} />
                                <span className="hidden sm:inline">Read</span>
                              </button>
                            ) : null}
                            {href ? (
                              <ChevronRight
                                size={16}
                                className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
                              />
                            ) : null}
                          </span>
                        </>
                      );

                      const rowClass = cn(LIST_ROW, "sm:flex-row", !n.read && "bg-sky-50/40");
                      return (
                        <li key={n.id}>
                          {href ? (
                            <Link
                              href={href}
                              className={rowClass}
                              onClick={() => {
                                if (!n.read) markRead.mutate(n.id);
                              }}
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className={cn(rowClass, "hover:translate-y-0")}>{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Breakdown ────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Notification types">
          <section className={PANEL} aria-labelledby="notif-types">
            <PanelHeader
              id="notif-types"
              icon={<Layers size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="By type"
              caption="Filter the feed by source"
            />
            {stats.types.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                Nothing to break down yet.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {stats.types.map(([type, count]) => {
                  const on = typeFilter === type;
                  const Icon = iconForNotification(type, null);
                  const tone = toneForNotification(type, null);
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTypeFilter(on ? null : type)}
                        className={cn(
                          "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                          on ? "bg-sky-50" : "hover:bg-slate-50",
                        )}
                      >
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", TONE_CHIP[tone] ?? TONE_CHIP.neutral)}>
                          <Icon size={14} />
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "font-semibold text-sky-800" : "font-medium text-slate-700")}>
                          {humanizeType(type)}
                        </span>
                        <span
                          className={cn(
                            "min-w-[28px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                            on ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
