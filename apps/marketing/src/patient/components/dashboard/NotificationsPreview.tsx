"use client";

import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useNotifications } from "@/patient/hooks";
import type { PatientNotification } from "@/patient/hooks/notifications-feed";
import { cn } from "@/portal/lib/utils";
import { Card } from "@/patient/components/primitives/Card";
import { CardHeader } from "@/patient/components/primitives/CardHeader";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const SEVERITY: Record<string, string> = {
  info: "bg-brand",
  warn: "bg-warn",
  warning: "bg-warn",
  critical: "bg-danger",
  error: "bg-danger",
  success: "bg-success",
};

function notificationHref(n: PatientNotification): string {
  const text = `${n.title} ${n.type}`.toLowerCase();
  if (n.type === "teleconsult" || text.includes("teleconsult") || text.includes("video")) {
    const payload = n.data as { roomId?: unknown } | null | undefined;
    const roomId = payload && typeof payload.roomId === "string" ? payload.roomId : null;
    return roomId ? `/patient/teleconsult/${roomId}` : "/patient/appointments";
  }
  if (text.includes("appoint") || text.includes("visit") || text.includes("doctor")) {
    return "/patient/appointments";
  }
  if (text.includes("med") || text.includes("prescript") || text.includes("dose") || text.includes("refill")) {
    return "/patient/medications";
  }
  if (text.includes("lab") || text.includes("test") || text.includes("scan") || text.includes("result")) {
    return "/patient/records";
  }
  if (text.includes("claim") || text.includes("insurance") || text.includes("policy")) {
    return "/patient/insurance/claims";
  }
  return "/patient/notifications";
}

export function NotificationsPreview({ className }: { className?: string }) {
  const q = useNotifications();
  const loading = q.isLoading;
  const items: PatientNotification[] = (q.data?.notifications ?? []).slice(0, 5);

  const unread = items.filter((n) => !n.read).length;

  return (
    <Card
      as="section"
      className={cn("anim-rise anim-rise-delay-1 flex h-full flex-col", className)}
    >
      <div>
        <CardHeader
          title="Notifications"
          caption={unread > 0 ? `${unread} unread` : "Recent updates & alerts"}
          icon={<Bell size={16} aria-hidden />}
          href="/patient/notifications"
          linkLabel="View all"
        />

        {loading ? (
          <ul data-testid="notif-skeleton" className="mt-4 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-11 rounded-lg patient-shimmer" />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-2 p-3.5 text-sm text-text-soft">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-success-soft text-success">
              <CheckCircle2 size={16} aria-hidden />
            </span>
            <span>You&apos;re all caught up. No unread alerts.</span>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={notificationHref(n)}
                  data-testid="notif-row"
                  className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      SEVERITY[n.type] ?? "bg-text-muted",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[13px] text-text transition-colors group-hover:text-brand",
                        n.read ? "font-medium" : "font-semibold",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {n.body}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] text-text-muted">
                    {relativeTime(n.createdAt)}
                    {!n.read ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="unread" />
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end pt-4">
        <Link
          href="/patient/notifications"
          className="text-xs font-medium text-text-muted hover:text-brand"
        >
          Notification settings
        </Link>
      </div>
    </Card>
  );
}
