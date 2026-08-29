"use client";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useNotifications } from "@/patient/hooks";
import { formatRelative } from "@/patient/lib/format";

export default function NotificationsPage() {
  const query = useNotifications();
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <SectionHeader label="Inbox" title="Notifications" />

      <Card>
        <QueryBoundary
          query={query as any}
          loadingCount={3}
          emptyTitle="You're all caught up"
          emptyDescription="No notifications right now."
        >
          {(data) => (
            <ul className="flex flex-col">
              {(data.items ?? []).map((n: any, i: number) => (
                <li
                  key={n?.id ?? i}
                  className="flex items-start gap-3 border-b border-surface-2 px-2 py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {n?.title ?? "Notification"}
                    </p>
                    {n?.body ? (
                      <p className="truncate text-xs text-text-soft">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                  <span className="t-micro">
                    {formatRelative(n?.createdAt)}
                  </span>
                  <Pill tone={n?.read ? "neutral" : "brand"}>
                    {n?.read ? "Read" : "New"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
