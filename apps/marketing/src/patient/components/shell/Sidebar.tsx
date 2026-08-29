"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  HeartPulse,
  Home,
  LogOut,
  MessageCircle,
  Pill,
  ScrollText,
  User,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { logout } from "@/portal/lib/auth";
import { cn } from "@/portal/lib/utils";

const NAV_ITEMS = [
  { href: "/patient", label: "Dashboard", icon: Home, testId: "nav-dashboard" },
  { href: "/patient/health", label: "My Health", icon: HeartPulse, testId: "nav-health" },
  {
    href: "/patient/appointments",
    label: "Appointments",
    icon: Calendar,
    testId: "nav-appointments",
  },
  {
    href: "/patient/records",
    label: "Medical Records",
    icon: ScrollText,
    testId: "nav-records",
  },
  {
    href: "/patient/medications",
    label: "Medications",
    icon: Pill,
    testId: "nav-medications",
  },
  {
    href: "/patient/messages",
    label: "Messages",
    icon: MessageCircle,
    testId: "nav-messages",
  },
  { href: "/patient/profile", label: "Profile", icon: User, testId: "nav-profile" },
];

/**
 * Floating icon rail. Active route gets a brand circle; logout sits at the foot.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [signingOut, setSigningOut] = useState(false);

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
    <aside
      aria-label="Primary"
      className="sticky top-4 flex flex-col items-center gap-1 self-start bg-surface px-2.5 py-5"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        width: 76,
      }}
    >
      <div
        className="mb-5 grid h-10 w-10 place-items-center text-white"
        style={{
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 15,
          background:
            "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
          boxShadow: "var(--shadow-brand)",
        }}
        aria-hidden
      >
        M
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/patient"
              ? pathname === "/patient"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "grid h-11 w-11 place-items-center transition-all duration-200",
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-text-soft hover:bg-brand-soft hover:text-brand"
              )}
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <Icon size={19} strokeWidth={isActive ? 2.25 : 1.85} aria-hidden />
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        disabled={signingOut}
        data-testid="sidebar-logout"
        aria-label="Log out"
        title="Log out"
        className="mt-4 grid h-11 w-11 place-items-center text-text-soft transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60"
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <LogOut size={18} aria-hidden />
      </button>

      {user?.name ? (
        <p
          className="mt-2 max-w-[60px] truncate text-center text-[10px] font-semibold text-text-muted"
          title={user.name}
        >
          {user.name.split(" ")[0]}
        </p>
      ) : null}
    </aside>
  );
}
