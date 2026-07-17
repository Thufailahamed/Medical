"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, ChevronRight, UserCheck } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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

export default function AdminInboxPage() {
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
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">Inbox</h1>
          <p className="text-sm text-text-soft mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
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
            Mark all read
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
            title="No notifications yet"
            icon={<Bell size={20} className="text-text-muted" />}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const href = resolveAdminHref(n.type);
              const Icon =
                n.type === "account_pending_review" || n.type === "tenant_pending_review"
                  ? UserCheck
                  : Bell;

              const row = (
                <div
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-colors group",
                    !n.read && "bg-amber-50/40",
                    href && "hover:bg-surface-2/70"
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      n.read ? "bg-surface-2 text-text-muted" : "bg-amber-50 text-amber-700"
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
                      {!n.read && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />}
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
                        Mark read
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
