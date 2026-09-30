"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  FileLock2,
  Inbox,
  Layers,
  Megaphone,
  Pill as PillIcon,
  Receipt,
  Siren,
  UserCheck,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";
import { useAuthStore } from "@/portal/stores/auth";
import { formatDate, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
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
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { humanize } from "@/portal/components/admin/AdminDirectory";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data?: unknown;
}

function resolveAdminHref(type: string): string | null {
  switch (type) {
    case "account_pending_review":
    case "tenant_pending_review":
      return "/admin/approvals";
    case "medicine":
      return "/admin/medicines-master";
    case "appointment":
    case "prescription":
      return "/admin/audit";
    case "lab_ready":
      return "/admin/audit";
    case "insurance":
      return "/admin/insurance-claims";
    case "hospital":
    case "hospital_request":
      return "/admin/hospitals";
    case "emergency":
      return "/admin/system-health";
    case "vaccination":
      return "/admin/users";
    case "general":
      return "/admin/dashboard";
    default:
      // Unknown type — surface to the inbox itself so the admin can
      // see the notification but cannot take a contextual action.
      return null;
  }
}

type Filter = "all" | "unread" | "action";

type Meta = { icon: typeof Bell; tile: string; rail: string; action: boolean };

/** Visual + triage meta per notification type. "action" = needs an admin decision. */
function metaFor(type: string): Meta {
  switch (type) {
    case "account_pending_review":
    case "tenant_pending_review":
      return { icon: UserCheck, tile: "bg-amber-50 text-amber-600", rail: "bg-amber-400", action: true };
    case "hospital":
    case "hospital_request":
      return { icon: Building2, tile: "bg-violet-50 text-violet-600", rail: "bg-violet-500", action: true };
    case "insurance":
      return { icon: Receipt, tile: "bg-sky-50 text-sky-600", rail: "bg-sky-500", action: true };
    case "emergency":
      return { icon: Siren, tile: "bg-red-50 text-red-600", rail: "bg-red-500", action: true };
    case "medicine":
      return { icon: PillIcon, tile: "bg-emerald-50 text-emerald-600", rail: "bg-emerald-500", action: false };
    default:
      return { icon: Bell, tile: "bg-slate-100 text-slate-500", rail: "bg-slate-300", action: false };
  }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type QueueCounts = {
  users: { pendingApprovals: number };
  operations: { pendingPayouts: number; openInsuranceClaims: number; openDsarRequests: number; newDemoRequests: number };
};

export default function AdminInboxPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const isSuperAdmin = useAuthStore((st) => st.user?.role) === "super_admin";

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api<{ notifications: Notification[] }>("/notifications/me"),
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
  });

  const { data: dash } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<QueueCounts>("/admin/dashboard"),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api(`/notifications/${id}/read`, { method: "PUT" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api("/notifications/read-all", { method: "PUT" });
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = useMemo(() => notificationsData?.notifications ?? [], [notificationsData]);
  const unreadCount = unreadData?.count ?? 0;

  const stats = useMemo(() => {
    const today = startOfDay(new Date(now));
    let todayCount = 0;
    let week = 0;
    let action = 0;
    const byType = new Map<string, number>();
    for (const n of notifications) {
      const ts = Date.parse(n.createdAt);
      if (ts >= today) todayCount++;
      if (ts >= now - 7 * 86_400_000) week++;
      if (!n.read && metaFor(n.type).action) action++;
      byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    }
    return { today: todayCount, week, action, types: [...byType.entries()].sort((a, b) => b[1] - a[1]) };
  }, [notifications, now]);

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "action" && (n.read || !metaFor(n.type).action)) return false;
    if (typeFilter && n.type !== typeFilter) return false;
    return true;
  });

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    const today = startOfDay(new Date());
    for (const n of filtered) {
      const diff = Math.round((today - startOfDay(new Date(n.createdAt))) / 86_400_000);
      const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : formatDate(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [filtered]);

  const queues = dash
    ? [
        { label: "Pending approvals", count: dash.users.pendingApprovals, href: "/admin/approvals", icon: UserCheck, tone: "bg-amber-50 text-amber-600" },
        { label: "Pending payouts", count: dash.operations.pendingPayouts, href: "/admin/payouts?status=pending", icon: Wallet, tone: "bg-emerald-50 text-emerald-600" },
        { label: "Insurance claims", count: dash.operations.openInsuranceClaims, href: "/admin/insurance-claims", icon: Receipt, tone: "bg-sky-50 text-sky-600" },
        { label: "DSAR requests", count: dash.operations.openDsarRequests, href: "/admin/dsar", icon: FileLock2, tone: "bg-rose-50 text-rose-600" },
        { label: "Demo requests", count: dash.operations.newDemoRequests, href: "/admin/demo-requests?status=new", icon: Megaphone, tone: "bg-violet-50 text-violet-600" },
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Inbox size={13} aria-hidden />}
          kicker="Admin inbox"
          kickerMeta={`${stats.today} today`}
          title={
            <>
              Your{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                inbox
              </span>
            </>
          }
          description={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}${stats.action ? ` — ${stats.action} need a decision` : ""}.`
              : "You're all caught up. Sign-up reviews, tenant requests and system alerts land here."
          }
          chips={
            stats.action > 0 ? (
              <button
                type="button"
                onClick={() => setFilter("action")}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
              >
                <AlertTriangle size={12} aria-hidden />
                {stats.action} need action
              </button>
            ) : (
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                Nothing needs a decision
              </span>
            )
          }
          actions={
            <>
              <Link href="/admin/notifications" className={HERO_GHOST}>
                <Megaphone size={15} aria-hidden />
                Broadcast
              </Link>
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0 || markAllRead.isPending}
                className={cn(HERO_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0")}
              >
                <CheckCheck size={15} className="text-sky-600" aria-hidden />
                Mark all read
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
            sub={unreadCount ? "Waiting for you" : "All caught up"}
            pulse={unreadCount > 0}
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
          <StatTile
            label="Needs action"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(stats.action)}
            sub="Reviews & requests"
            badge={stats.action ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={filter === "action"}
            onClick={() => setFilter("action")}
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
            progress={notifications.length ? Math.round(((notifications.length - unreadCount) / notifications.length) * 100) : null}
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
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="inbox-feed">
          <PanelHeader
            id="inbox-feed"
            icon={<Bell size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={typeFilter ? humanize(typeFilter) : "Notifications"}
            caption={isLoading ? "Loading…" : `${filtered.length} of ${notifications.length} shown`}
            action={
              <Segmented<Filter>
                ariaLabel="Filter notifications"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "unread", label: "Unread", count: unreadCount },
                  { value: "action", label: "Action", count: stats.action },
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
              icon={filter === "all" && !typeFilter ? <Inbox size={19} /> : <BellOff size={19} />}
              title={notifications.length === 0 ? "No notifications yet" : "Nothing here"}
              body={
                notifications.length === 0
                  ? "Sign-up reviews, tenant requests and system alerts will appear here as they happen."
                  : "No notifications match this filter."
              }
              actions={
                filter !== "all" || typeFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setTypeFilter(null);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
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
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">{group.items.length}</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.items.map((n) => {
                      const href = resolveAdminHref(n.type);
                      const m = metaFor(n.type);
                      const Icon = m.icon;
                      const body = (
                        <>
                          <RowAccent className={n.read ? "bg-transparent" : m.rail} />
                          <span className="flex min-w-0 flex-1 items-start gap-3.5 pl-1.5">
                            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", n.read ? "bg-slate-100 text-slate-400" : m.tile)}>
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className={cn("truncate text-[13.5px]", n.read ? "font-medium text-slate-600" : "font-semibold text-slate-900")}>
                                    {n.title}
                                  </span>
                                  {!n.read && m.action ? (
                                    <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Action</span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{relativeTime(n.createdAt)}</span>
                              </span>
                              {n.body ? (
                                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500">{n.body}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 self-end pl-1.5 sm:self-center sm:pl-0">
                            {!n.read ? (
                              <button
                                type="button"
                                title="Mark read"
                                aria-label="Mark read"
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
                              <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
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

        {/* ── Right rail ───────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Inbox tools">
          {queues.length ? (
            <section className={PANEL} aria-labelledby="inbox-queues">
              <PanelHeader
                id="inbox-queues"
                icon={<Layers size={16} />}
                tone="bg-amber-50 text-amber-600"
                title="Operational queues"
                caption="Live counts from the platform"
                href="/admin/dashboard"
                linkLabel="Dashboard"
              />
              <ul className="mt-4 flex flex-col gap-0.5">
                {queues.map((q) => {
                  const Icon = q.icon;
                  return (
                    <li key={q.label}>
                      <Link
                        href={q.href}
                        className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", q.count ? q.tone : "bg-slate-100 text-slate-400")}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 group-hover:text-sky-700">{q.label}</span>
                        {q.count ? (
                          <span className="grid h-5 min-w-[24px] place-items-center rounded-full bg-slate-900 px-1.5 text-[10.5px] font-bold tabular-nums text-white">
                            {q.count}
                          </span>
                        ) : (
                          <CheckCircle2 size={14} className="text-emerald-500" aria-label="Clear" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className={PANEL} aria-labelledby="inbox-types">
            <PanelHeader
              id="inbox-types"
              icon={<Layers size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="By type"
              caption="Filter the feed"
            />
            {stats.types.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Nothing to break down yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {stats.types.map(([type, count]) => {
                  const on = typeFilter === type;
                  const m = metaFor(type);
                  const Icon = m.icon;
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
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", m.tile)}>
                          <Icon size={14} />
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "font-semibold text-sky-800" : "font-medium text-slate-700")}>
                          {humanize(type)}
                        </span>
                        <span className={cn("min-w-[28px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums", on ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600")}>
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
