"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellOff, Check, CheckCheck, ChevronRight, Inbox,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
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
  neutral: "bg-surface-2 text-text-muted ring-border/60",
};

const TONE_BAR: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-300",
};

type Filter = "all" | "unread";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

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
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={unreadCount > 0 ? t("notifications.subtitle", { count: unreadCount }) : t("notifications.emptyUnread")}
        icon={<Bell size={18} className="text-brand" />}
        badge={unreadCount > 0 ? <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-[11px] font-bold text-white flex items-center justify-center">{unreadCount}</span> : undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface-2/60 p-1">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5",
                    filter === f
                      ? "bg-white text-slate-900 shadow-2xs ring-1 ring-border/70"
                      : "text-text-muted hover:text-text"
                  )}
                >
                  {f === "all" ? t("notifications.showAll") : t("notifications.showUnread")}
                  {f === "unread" && unreadCount > 0 && (
                    <span className={cn(
                      "h-4 min-w-[16px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center",
                      filter === "unread" ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700"
                    )}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <Button size="sm" variant="secondary" leftIcon={<CheckCheck size={14} />} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
                {t("notifications.markAllRead")}
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <Card padding={false}>
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3.5">
                <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-3 w-12 mt-1" />
              </div>
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding={false}>
          <Empty
            title={filter === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")}
            icon={filter === "unread" ? <BellOff size={22} className="text-brand" /> : <Inbox size={22} className="text-brand" />}
            className="py-16"
          />
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 shrink-0">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
                {group.items.length}
              </span>
            </div>
            <Card padding={false} className="overflow-hidden">
              <ul className="flex flex-col divide-y divide-border/50">
                {group.items.map((n) => {
                  const data = parseNotificationData(n.data);
                  const tone = toneForNotification(n.type, data);
                  const Icon = iconForNotification(n.type, data);
                  const href = resolveDoctorPortalHref(n.type, data);
                  const chipClass = TONE_CHIP[tone] ?? TONE_CHIP.neutral;
                  const barClass = TONE_BAR[tone] ?? TONE_BAR.neutral;

                  const row = (
                    <div
                      className={cn(
                        "relative flex items-start gap-3.5 px-4 sm:px-5 py-4 transition-colors group",
                        !n.read && "bg-sky-50/40",
                        href && "hover:bg-surface-2/70 cursor-pointer"
                      )}
                    >
                      {!n.read && (
                        <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-9 w-1 rounded-r-full", barClass)} />
                      )}
                      <div
                        className={cn(
                          "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-inset shadow-2xs",
                          n.read ? "bg-surface-2 text-text-muted ring-border/50" : chipClass
                        )}
                      >
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={cn("text-[13.5px] truncate", n.read ? "font-medium text-text-soft" : "font-bold text-text")}>
                            {n.title}
                          </span>
                          <span className="text-[11px] text-text-muted shrink-0 tabular-nums">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                            {n.body}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {!n.read && (
                          <button
                            type="button"
                            title={t("notifications.markRead")}
                            aria-label={t("notifications.markRead")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markRead.mutate(n.id);
                            }}
                            className="h-7 w-7 rounded-full flex items-center justify-center text-text-muted hover:text-emerald-600 hover:bg-emerald-50 ring-1 ring-transparent hover:ring-emerald-200 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {!n.read && <span className="h-2 w-2 rounded-full bg-sky-500 group-hover:opacity-0 transition-opacity" />}
                        {href ? <ChevronRight size={15} className="text-text-muted/70 group-hover:text-text-muted group-hover:translate-x-0.5 transition-all" /> : null}
                      </div>
                    </div>
                  );

                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link
                          href={href}
                          className="block"
                          onClick={() => {
                            if (!n.read) markRead.mutate(n.id);
                          }}
                        >
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
