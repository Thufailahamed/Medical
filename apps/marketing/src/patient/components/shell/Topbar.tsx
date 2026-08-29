"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
import { logout } from "@/portal/lib/auth";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";
import { cn } from "@/portal/lib/utils";

const TOP_LINKS = [
  { href: "/patient", label: "Dashboard" },
  { href: "/patient/health", label: "Health" },
  { href: "/patient/records", label: "Reports" },
];

/**
 * Greeting + center section nav + profile / date / notifications / logout.
 */
export function Topbar({ user }: { user: AuthUser | null }) {
  const firstName = user?.name?.split(" ")[0] ?? null;
  const unread = useUnreadNotificationsCount();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  async function onLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace("/patient/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header
      className="flex flex-wrap items-center gap-4 bg-surface px-5 py-3.5 sm:px-6"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold tracking-tight text-text sm:text-2xl">
          {firstName ? `Welcome to ${firstName}!` : "Welcome back"}
        </h1>
      </div>

      <nav
        aria-label="Sections"
        className="order-3 flex w-full items-center justify-center gap-1 rounded-pill bg-brand-soft/70 p-1 sm:order-none sm:w-auto"
      >
        {TOP_LINKS.map((link) => {
          const active =
            link.href === "/patient"
              ? pathname === "/patient"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-surface text-brand shadow-sm"
                  : "text-text-soft hover:text-brand"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-text">
            {firstName ? `Hi, ${firstName}` : "Patient"}
          </p>
          <p className="t-micro">{today}</p>
        </div>

        <Link href="/patient/profile" aria-label="Profile">
          <Avatar user={user} />
        </Link>

        <Link
          href="/patient/notifications"
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread`
              : "Notifications"
          }
          className="relative grid h-10 w-10 place-items-center text-text-soft transition-colors hover:bg-brand-soft hover:text-brand"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          <Bell size={18} aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center bg-brand px-1 text-[10px] font-bold text-white"
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={onLogout}
          disabled={signingOut}
          data-testid="logout-button"
          aria-label="Log out"
          title="Log out"
          className="inline-flex h-10 items-center gap-1.5 bg-brand-soft px-3 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white disabled:opacity-60"
          style={{ borderRadius: "var(--radius-pill)" }}
        >
          <LogOut size={16} aria-hidden />
          <span className="hidden sm:inline">
            {signingOut ? "Signing out…" : "Log out"}
          </span>
        </button>
      </div>
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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.photo}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 object-cover ring-2 ring-brand-soft"
        style={{ borderRadius: "var(--radius-pill)" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid h-10 w-10 place-items-center bg-brand-soft text-sm font-bold text-brand"
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {initials}
    </span>
  );
}
