"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ChevronRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  iconForPatientNotification,
  parseNotificationData,
  resolvePatientPortalHref,
} from "@/portal/lib/patient-notifications-types";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data?: unknown;
}

export default function PatientNotificationsPage() {
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
      toast.success(t("patientPortal.notifications.markedAllRead"));
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">
            {t("patientPortal.notifications.title")}
          </h1>
          <p className="text-sm text-text-soft mt-0.5">
            {unreadCount > 0
              ? t("patientPortal.notifications.subtitle", {
                  count: unreadCount,
                })
              : t("patientPortal.notifications.caughtUp")}
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<CheckCheck size={14} />}
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            {t("patientPortal.notifications.markAllRead")}
          </Button>
        ) : null}
      </header>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            title={t("patientPortal.notifications.empty")}
            icon={<Bell size={20} className="text-text-muted" />}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const data = parseNotificationData(n.data);
              const Icon = iconForPatientNotification(n.type, data);
              const href = resolvePatientPortalHref(n.type, data);

              const row = (
                <div
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-colors group",
                    !n.read && "bg-sky-50/30",
                    href && "hover:bg-surface-2/70"
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      n.read ? "bg-surface-2 text-text-muted" : "bg-sky-50 text-sky-600"
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[13px] truncate",
                          n.read ? "font-medium text-text-soft" : "font-bold text-text"
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />}
                    </div>
                    {n.body ? (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    ) : null}
                    <span className="text-[10px] text-text-muted mt-1 block">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Check size={13} />}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {t("patientPortal.notifications.markRead")}
                      </Button>
                    ) : null}
                    {href ? <ChevronRight size={16} className="text-text-muted" /> : null}
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
        )}
      </Card>
    </div>
  );
}
