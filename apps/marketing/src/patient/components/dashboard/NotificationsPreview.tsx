"use client";

import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useNotifications } from "@/patient/hooks";
import type { PatientNotification } from "@/patient/hooks/notifications-feed";
import { cn } from "@/portal/lib/utils";

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
  info: "bg-sky-500",
  warn: "bg-amber-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  error: "bg-rose-500",
  success: "bg-emerald-500",
};

export function NotificationsPreview({ className }: { className?: string }) {
  const q = useNotifications();
  const loading = q.isLoading;
  const items: PatientNotification[] = (q.data?.notifications ?? []).slice(0, 5);

  return (
    <section aria-labelledby="notif-heading" className={cn("anim-rise anim-rise-delay-1 rounded-2xl border border-border bg-white p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-text-muted" aria-hidden />
          <h2 id="notif-heading" className="t-card-title">Notifications</h2>
        </div>
        <Link href="/patient/notifications" className="text-xs font-bold text-brand hover:underline">View all →</Link>
      </header>

      {loading ? (
        <ul data-testid="notif-skeleton" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 rounded-lg bg-slate-50 animate-pulse" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-slate-50 p-4 text-sm text-text-muted">
          <CheckCircle2 size={16} className="text-emerald-500" aria-hidden />
          You&apos;re all caught up.
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((n) => (
            <li
              key={n.id}
              data-testid="notif-row"
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", SEVERITY[n.type] ?? "bg-slate-400")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-text">{n.title}</span>
                {n.body ? <span className="block truncate text-xs text-text-muted">{n.body}</span> : null}
              </span>
              <span className="text-[11px] text-text-muted shrink-0">{relativeTime(n.createdAt)}</span>
              {!n.read ? <span className="h-2 w-2 rounded-full bg-brand" aria-label="unread" /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
