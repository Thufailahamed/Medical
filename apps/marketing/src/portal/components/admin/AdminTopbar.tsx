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
    <header className="h-[60px] bg-surface border-b border-border flex items-center px-6 gap-3">
      <div className="flex items-center gap-1.5 text-text-soft text-sm">
        <span className="font-semibold text-text">Admin</span>
        <ChevronRight size={14} className="text-text-muted" />
        <span>{currentLabel}</span>
      </div>
      <div className="flex-1" />
      <Link
        href="/admin/inbox"
        className="relative inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-soft hover:text-text hover:bg-surface-2 transition-colors"
        aria-label="Notifications inbox"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
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
