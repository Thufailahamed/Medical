"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-nav";
import { useT } from "@/portal/i18n";
import { api } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";

function flatten(items: { href: string; labelKey: string }[]) {
  return items.map((i) => i);
}

export function AdminTopbar() {
  const pathname = usePathname() || "";
  const t = useT();
  const user = useAuthStore((s) => s.user);
  // Doctor portal link only makes sense for admins who also have a
  // doctor profile (e.g. an admin who is themselves a clinician).
  // Insurance/ambulance operators and super_admin-only operators
  // would 403 on /portal/dashboard.
  const showDoctorPortal = user?.role === "doctor";

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });
  const unreadCount = unread?.count ?? 0;

  // Resolve current page label for the breadcrumb-style title.
  const all = ADMIN_NAV_GROUPS.flatMap((g) => flatten(g.items));
  const current = all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const currentLabel = current
    ? (() => {
        const translated = t(current.labelKey);
        return translated === current.labelKey ? current.labelKey.split(".").pop() : translated;
      })()
    : "";

  return (
    <header className="h-[60px] bg-surface/90 backdrop-blur border-b border-border flex items-center px-6 gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-500/20">
          Admin
        </span>
        <ChevronRight size={14} className="text-text-muted" />
        <span className="font-semibold text-text">{currentLabel}</span>
      </div>
      <div className="flex-1" />
      <Link
        href="/admin/inbox"
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2 hover:border-border-strong transition-all no-underline hover:no-underline"
        aria-label="Notifications inbox"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Link>
      {showDoctorPortal ? (
        <a
          href="/portal/dashboard"
          className="text-xs text-text-soft hover:text-text underline-offset-2 hover:underline"
        >
          ← Doctor portal
        </a>
      ) : null}
    </header>
  );
}
