"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Check, CheckCheck, Calendar, MessageSquare, Pill, FlaskConical, AlertCircle, ChevronRight,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface Notification {
  id: string; type: string; title: string; body: string | null;
  read: boolean; createdAt: string; metadata: Record<string, any> | null;
}

const TYPE_META: Record<string, { icon: typeof Bell; bg: string; fg: string }> = {
  appointment: { icon: Calendar, bg: "bg-sky-50", fg: "text-sky-600" },
  message:     { icon: MessageSquare, bg: "bg-violet-50", fg: "text-violet-600" },
  prescription:{ icon: Pill, bg: "bg-emerald-50", fg: "text-emerald-600" },
  lab_order:   { icon: FlaskConical, bg: "bg-amber-50", fg: "text-amber-600" },
  alert:       { icon: AlertCircle, bg: "bg-red-50", fg: "text-red-600" },
};

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={unreadCount > 0 ? t("notifications.subtitle", { count: unreadCount }) : t("notifications.emptyUnread")}
        icon={<Bell size={18} className="text-brand" />}
        badge={unreadCount > 0 ? <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-[11px] font-bold text-white flex items-center justify-center">{unreadCount}</span> : undefined}
        actions={unreadCount > 0 ? (
          <Button size="sm" variant="secondary" leftIcon={<CheckCheck size={14} />} onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            {t("notifications.markAllRead")}
          </Button>
        ) : undefined}
      />

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : notifications.length === 0 ? (
          <Empty title={t("notifications.empty")} icon={<Bell size={20} className="text-text-muted" />} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: Bell, bg: "bg-surface-2", fg: "text-text-muted" };
              const Icon = meta.icon;
              return (
                <li key={n.id} className={cn(
                  "flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-colors group",
                  !n.read && "bg-sky-50/30"
                )}>
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", n.read ? "bg-surface-2 text-text-muted" : `${meta.bg} ${meta.fg}`)}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[13px] truncate", n.read ? "font-medium text-text-soft" : "font-bold text-text")}>{n.title}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>}
                    <span className="text-[10px] text-text-muted mt-1 block">{relativeTime(n.createdAt)}</span>
                  </div>
                  {!n.read && (
                    <Button size="sm" variant="ghost" leftIcon={<Check size={13} />} onClick={() => markRead.mutate(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {t("notifications.markRead")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
