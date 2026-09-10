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
    <section
      aria-labelledby="notif-heading"
      className={cn(
        "anim-rise anim-rise-delay-1 flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-card transition-all",
        className,
      )}
    >
      <div>
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-2xs"
              aria-hidden
            >
              <Bell size={16} />
            </div>
            <div>
              <h2 id="notif-heading" className="text-sm font-bold text-slate-900 tracking-tight">
                Notifications
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                Recent updates &amp; alerts
              </p>
            </div>
          </div>
          <Link
            href="/patient/notifications"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
          >
            <span>View all</span>
            <span aria-hidden>→</span>
          </Link>
        </header>

        {loading ? (
          <ul data-testid="notif-skeleton" className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="my-6 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs font-medium text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" aria-hidden />
            <span>You&apos;re all caught up. No unread alerts.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                data-testid="notif-row"
                className="group flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/40 hover:bg-blue-50/30 hover:border-blue-200/80 px-3.5 py-2.5 transition-all"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    SEVERITY[n.type] ?? "bg-slate-400",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs md:text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="block truncate text-[11px] text-slate-500 mt-0.5">
                      {n.body}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-medium text-slate-400 shrink-0">
                  {relativeTime(n.createdAt)}
                </span>
                {!n.read ? (
                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" aria-label="unread" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="text-[10px] text-slate-400">Activity stream</span>
        <Link
          href="/patient/notifications"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Notification settings →
        </Link>
      </div>
    </section>
  );
}
