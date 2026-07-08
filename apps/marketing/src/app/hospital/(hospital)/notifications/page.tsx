"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Empty } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { relativeTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import {
  TYPE_ICON,
  TYPE_TONE,
  resolveHref as resolveNotifHref,
} from "@/hospital/lib/notifications-types";

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => api<{ notifications: any[] }>("/notifications/me"),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unreadCount"] });
      toast.success("All marked as read");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const items = list.data?.notifications ?? [];
  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck size={14} className="mr-1.5" />
              {t("notifications.markAllRead")}
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2">
        {(["all", "unread"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-text-muted border border-border hover:bg-surface-2"
            )}
          >
            {t(`notifications.filter.${f}` as any)}
            {f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      <Card>
        {list.isLoading ? (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <Empty
            title={
              filter === "unread"
                ? t("notifications.noUnread")
                : t("notifications.noneYet")
            }
            icon={<Bell size={28} className="text-text-muted opacity-40" />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n: any) => (
              <NotificationRow
                key={n.id}
                n={n}
                onClick={() => !n.read && markRead.mutate(n.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: any; onClick: () => void }) {
  const locale = useAuthStore((s) => s.locale);
  const data = parseData(n.data);
  const kind = data?.kind ?? n.type;
  const tone = TYPE_TONE[kind] ?? TYPE_TONE[n.type] ?? "neutral";
  const Icon = TYPE_ICON[kind] ?? TYPE_ICON[n.type] ?? Bell;
  const href = resolveNotifHref(n.type, data);

  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 p-4 hover:bg-surface-2 transition-colors",
        !n.read && "bg-accent-soft/30"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center",
          tone === "success" && "bg-success-soft text-emerald-700",
          tone === "warn" && "bg-warn-soft text-amber-700",
          tone === "danger" && "bg-danger-soft text-red-700",
          tone === "info" && "bg-info-soft text-sky-700",
          tone === "neutral" && "bg-surface-2 text-text-muted",
          n.read && "opacity-60"
        )}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PillBadge tone={tone}>{n.type.replace(/_/g, " ")}</PillBadge>
          {!n.read && (
            <span className="h-2 w-2 rounded-full bg-brand" aria-label="unread" />
          )}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-text">{n.title}</p>
        {n.body ? (
          <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
            {n.body}
          </p>
        ) : null}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
          {relativeTime(n.createdAt, locale)}
        </p>
      </div>
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

function parseData(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveHref(type: string, data: any): string | null {
  // Resolve via shared module so bell + list page stay in sync.
  return resolveNotifHref(type, data);
}