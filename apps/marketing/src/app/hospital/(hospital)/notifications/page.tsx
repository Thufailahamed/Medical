"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Settings,
  UserCog,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { relativeTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import {
  TYPE_ICON,
  TYPE_TONE,
  resolveHref as resolveNotifHref,
} from "@/hospital/lib/notifications-types";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Filter = "all" | "unread";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read?: boolean;
  createdAt: string;
  data?: unknown;
}

const TONE_BADGE_MAP: Record<string, string> = {
  success: TONE_BADGE.emerald,
  warn: TONE_BADGE.amber,
  danger: TONE_BADGE.rose,
  info: TONE_BADGE.sky,
  neutral: TONE_BADGE.slate,
};

const TONE_TILE_MAP: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-600",
  warn: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  info: "bg-sky-50 text-sky-600",
  neutral: "bg-slate-100 text-slate-500",
};

function parseData(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => api<{ notifications: NotificationItem[] }>("/notifications/me"),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      toast.success("All marked as read");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const items = list.data?.notifications ?? [];
  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  const hero = (
    <DoctorHero
      kickerIcon={<Bell size={13} aria-hidden />}
      kicker={t("nav.admin")}
      kickerMeta={t("nav.notifications")}
      title={
        <>
          {t("notifications.title")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {unreadCount > 0 ? `${unreadCount} unread` : "inbox zero"}
          </span>
        </>
      }
      description={t("notifications.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <BellRing size={12} className="text-amber-300" />
            {unreadCount} {t("notifications.filter.unread").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {items.length} {t("notifications.filter.all").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<BellRing size={18} />}
          label={t("notifications.filter.unread")}
          value={list.isLoading ? "…" : unreadCount}
          sub={unreadCount > 0 ? "Needs attention" : "All caught up"}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          {unreadCount > 0 ? (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className={HERO_PRIMARY}
            >
              <CheckCheck size={14} className="text-emerald-600" />
              {t("notifications.markAllRead")}
            </button>
          ) : null}
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Bell size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("notifications.filter.all")}
          value={list.isLoading ? "…" : String(items.length)}
          sub={t("notifications.title")}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatTile
          icon={<BellRing size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("notifications.filter.unread")}
          value={list.isLoading ? "…" : String(unreadCount)}
          sub="Awaiting review"
          active={filter === "unread"}
          onClick={() => setFilter("unread")}
          pulse={unreadCount > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Read"
          value={list.isLoading ? "…" : String(items.length - unreadCount)}
          sub="Acknowledged"
        />
        <StatTile
          icon={<RefreshCw size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Live"
          value="30s"
          sub="Auto-refresh"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Bell size={16} />}
            tone="bg-amber-50 text-amber-600"
            title={t("notifications.title")}
            caption={list.isLoading ? t("common.loading") : `${filtered.length}`}
          />
          <div className="mt-4">
            <Segmented<Filter>
              ariaLabel="Filter notifications"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("notifications.filter.all"), count: items.length },
                { value: "unread", label: t("notifications.filter.unread"), count: unreadCount },
              ]}
            />
          </div>

          {list.isLoading ? (
            <PanelSkeleton rows={5} className="mt-4" />
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={<Bell size={19} />}
              title={filter === "unread" ? t("notifications.noUnread") : t("notifications.noneYet")}
              body="New alerts will land here."
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filtered.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="notifications-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: UserCog, label: t("nav.staff"), hint: "Directory", href: "/hospital/staff", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Settings, label: t("nav.settings"), hint: t("settings.title"), href: "/hospital/settings", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: CheckCheck, label: t("notifications.markAllRead"), hint: `${unreadCount} unread`, href: "/hospital/notifications", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: NotificationItem; onClick: () => void }) {
  const locale = useAuthStore((s) => s.locale);
  const data = parseData(n.data);
  const kind = (data?.kind as string) ?? n.type;
  const tone = TYPE_TONE[kind] ?? TYPE_TONE[n.type] ?? "neutral";
  const Icon = TYPE_ICON[kind] ?? TYPE_ICON[n.type] ?? Bell;
  const href = resolveNotifHref(n.type, data);

  const inner = (
    <div
      className={cn(
        "group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[color:var(--ink-border)] bg-white p-4 transition hover:shadow-md",
        !n.read && "border-sky-200 bg-sky-50/40"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          !n.read ? "bg-sky-400" : "bg-transparent"
        )}
      />
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          TONE_TILE_MAP[tone] ?? TONE_TILE_MAP.neutral,
          n.read && "opacity-60"
        )}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", TONE_BADGE_MAP[tone] ?? TONE_BADGE.slate)}>
            {n.type.replace(/_/g, " ")}
          </span>
          {!n.read && <span className="h-2 w-2 rounded-full bg-sky-500" aria-label="unread" />}
        </div>
        <p className={cn("mt-1.5 text-sm font-semibold text-slate-900", n.read && "font-medium text-slate-600")}>
          {n.title}
        </p>
        {n.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>
        ) : null}
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {relativeTime(n.createdAt, locale)}
        </p>
      </div>
      {href ? (
        <ChevronRight size={15} className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
      ) : null}
    </div>
  );

  return (
    <li>
      {href ? (
        <Link href={href} onClick={onClick} className="block">
          {inner}
        </Link>
      ) : (
        <button onClick={onClick} className="w-full text-left">
          {inner}
        </button>
      )}
    </li>
  );
}
