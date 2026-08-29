"use client";

import { useState } from "react";
import { Check, CheckCheck } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";

export default function NotificationsPage() {
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const notifications = query.data?.notifications ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          label="Inbox"
          title="Notifications"
          description="Alerts and updates from your care team."
        />
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="shrink-0 rounded-pill border border-border px-3 py-2 text-xs font-semibold text-text-soft hover:bg-surface-2 disabled:opacity-60"
          >
            {markAllRead.isPending ? "Marking…" : "Mark all read"}
          </button>
        ) : null}
      </div>

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="You're all caught up"
          emptyDescription="No notifications right now."
        >
          {(data) => (
            <ul className="flex flex-col">
              {data.notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="flex items-start gap-3 border-b border-surface-2 px-2 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {notification.title}
                    </p>
                    {notification.body ? (
                      <p className="truncate text-xs text-text-soft">
                        {notification.body}
                      </p>
                    ) : null}
                    <span className="t-micro">
                      {formatRelative(notification.createdAt)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={notification.read ? "neutral" : "brand"}>
                      {notification.read ? "Read" : "New"}
                    </Pill>
                    {!notification.read ? (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(notification.id)}
                        disabled={markRead.isPending}
                        aria-label={`Mark ${notification.title} as read`}
                        className="rounded-full p-1 text-text-soft hover:bg-surface-2 disabled:opacity-60"
                      >
                        <Check size={15} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
