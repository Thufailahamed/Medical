"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  FileText,
  Share2,
  ScrollText,
  LogOut,
  Heart,
  Bell,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { useRealtime } from "@/portal/hooks/useRealtime";
import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

/**
 * (patient) route group layout — the patient-facing web portal.
 *
 * Mirrors the role-gate pattern of (portal)/layout.tsx but with a
 * simpler shell: no Sidebar, just a top strip with nav. The patient
 * mobile app covers most flows; this web surface is a parallel
 * option when the patient doesn't have a phone handy.
 */
const PATIENT_ROLES = ["patient"] as const;

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);

  useRealtime({ token: token ?? null, userId: user?.id ?? null });

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const unreadCount = unread?.count ?? 0;

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/portal/login?next=${next}`);
      return;
    }
    if (user && user.role && !PATIENT_ROLES.includes(user.role as any)) {
      // Clinicians should use the doctor portal.
      router.replace("/portal/403");
    }
  }, [hydrated, token, user, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-soft">
        Loading…
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-surface-1 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-6">
          <Link
            href="/portal/me"
            className="flex items-center gap-2 text-text font-bold tracking-wider"
          >
            <Heart size={18} className="text-primary" />
            HEALTHHUB
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              href="/portal/me"
              icon={<Home size={14} />}
              active={pathname === "/portal/me"}
            >
              Home
            </NavLink>
            <NavLink
              href="/portal/me/records"
              icon={<FileText size={14} />}
              active={pathname?.startsWith("/portal/me/records")}
            >
              Records
            </NavLink>
            <NavLink
              href="/portal/me/share"
              icon={<Share2 size={14} />}
              active={pathname?.startsWith("/portal/me/share")}
            >
              Share
            </NavLink>
            <NavLink
              href="/portal/me/audit"
              icon={<ScrollText size={14} />}
              active={pathname?.startsWith("/portal/me/audit")}
            >
              Audit
            </NavLink>
          </nav>
          <div className="flex-1" />
          <Link
            href="/portal/me/notifications"
            className={cn(
              "relative inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-soft hover:text-text hover:bg-surface-2 transition-colors",
              pathname?.startsWith("/portal/me/notifications") && "bg-primary-soft text-primary"
            )}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/portal/login");
            }}
            className="text-xs text-text-soft hover:text-text inline-flex items-center gap-1"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-text-soft hover:text-text hover:bg-surface-2"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
