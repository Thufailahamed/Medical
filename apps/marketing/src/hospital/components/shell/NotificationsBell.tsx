"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { relativeTime } from "@/hospital/lib/format";

export function NotificationsBell() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: any[] }>("/notifications?unread=1"),
    refetchInterval: 30_000,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = list.data?.notifications ?? [];
  const tone = unread.length > 0 ? "warning" : "muted";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
        aria-label={tr(locale, "nav.notifications")}
      >
        <span aria-hidden>🔔</span>
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div
          data-app="hospital"
          className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg"
        >
          <div className="border-b border-[var(--border)] p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{tr(locale, "nav.notifications")}</h3>
              {unread.length > 0 && (
                <Pill tone={tone as any}>
                  {tr(locale, "shell.unreadBadge", { count: unread.length })}
                </Pill>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {unread.length === 0 ? (
              <p className="p-4 text-sm text-[var(--text-muted)]">
                {tr(locale, "shell.noUnread")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {unread.map((n: any) => (
                  <li
                    key={n.id}
                    className="cursor-pointer p-3 hover:bg-[var(--bg-surface-2)]"
                    onClick={() => markRead.mutate(n.id)}
                  >
                    <p className="text-sm font-medium">{n.title ?? n.kind}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {n.body ?? relativeTime(n.createdAt, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}