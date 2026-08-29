"use client";

import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";

/**
 * Greeting + nav pill + avatar + bell.
 *
 * The nav pill is a brand-soft chip showing the section name. It's
 * decorative, not interactive — it visually anchors the row without
 * adding another selectable target next to the sidebar.
 */
export function Topbar({ user }: { user: AuthUser | null }) {
  const firstName = user?.name?.split(" ")[0] ?? null;
  const unread = useUnreadNotificationsCount();

  return (
    <header
      className="flex items-center gap-6 bg-surface px-6 py-4"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="t-label">Patient portal</p>
        <h1 className="truncate text-lg font-semibold text-text">
          {firstName ? `Good morning, ${firstName}` : "Welcome back"}
        </h1>
      </div>

      <button
        type="button"
        className="grid h-10 w-10 place-items-center text-text-soft hover:bg-surface-2"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <ChevronDown size={18} aria-hidden />
      </button>

      <Link
        href="/patient/notifications"
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        className="relative grid h-10 w-10 place-items-center text-text-soft hover:bg-surface-2"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute right-2 top-2 grid h-4 min-w-[16px] place-items-center bg-brand px-1 text-[10px] font-semibold text-white"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>

      <Avatar user={user} />
    </header>
  );
}

function Avatar({ user }: { user: AuthUser | null }) {
  const initials = user?.name
    ? user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  if (user?.photo) {
    return (
      <img
        src={user.photo}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 object-cover"
        style={{ borderRadius: "var(--radius-pill)" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid h-10 w-10 place-items-center bg-surface-3 text-sm font-semibold text-text-soft"
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {initials}
    </span>
  );
}