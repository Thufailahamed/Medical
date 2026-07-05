"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  MessageSquare,
  Pill,
  FlaskConical,
  AlertCircle,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  metadata: Record<string, any> | null;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "appointment":
      return Calendar;
    case "message":
      return MessageSquare;
    case "prescription":
      return Pill;
    case "lab_order":
      return FlaskConical;
    case "alert":
      return AlertCircle;
    default:
      return Bell;
  }
}

export default function NotificationsPage() {
  const t = useT();
  const qc = useQueryClient();

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api<{ notifications: Notification[] }>("/notifications/me"),
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api(`/notifications/${id}/read`, { method: "PUT" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api("/notifications/read-all", { method: "PUT" });
    },
    onSuccess: () => {
      toast.success(t("notifications.markedAllRead"), "");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">{t("notifications.title")}</h1>
          <p className="text-sm text-text-soft mt-1">
            {unreadCount > 0
              ? t("notifications.subtitle", { count: unreadCount })
              : t("notifications.emptyUnread")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<CheckCheck size={14} />}
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card padding={false}>
        {notificationsLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Empty title={t("notifications.empty")} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const Icon = getNotificationIcon(n.type);
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-4 border-b border-border last:border-0 transition-colors",
                    !n.read && "bg-brand-soft/20"
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      n.read
                        ? "bg-surface-2 text-text-muted"
                        : "bg-brand-soft text-brand"
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-text-soft mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <span className="text-[10px] text-text-muted mt-1 block">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  {!n.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Check size={14} />}
                      onClick={() => markRead.mutate(n.id)}
                      loading={markRead.isPending}
                    >
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
