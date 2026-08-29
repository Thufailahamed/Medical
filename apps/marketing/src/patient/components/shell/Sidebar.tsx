"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Calendar,
  Home,
  MessageCircle,
  Pill,
  ScrollText,
  User,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";

const NAV_ITEMS = [
  { href: "/patient", label: "Dashboard", icon: Home, testId: "nav-dashboard" },
  { href: "/patient/health", label: "My Health", icon: Activity, testId: "nav-health" },
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
 * Floating icon rail with a circular active state.
 *
 * Two states are wired deliberately: the active route gets a dark
 * circle (the spec calls this out as the only place in the shell
 * where the full-strength `--color-ink` appears), and the active
 * label sits BELOW the rail in muted ink rather than inside it, so
 * the rail stays visually quiet.
 */
export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <aside
      aria-label="Primary"
      className="flex flex-col items-center gap-1 bg-surface px-3 py-6"
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        width: 84,
      }}
    >
      <div
        className="mb-4 grid h-9 w-9 place-items-center bg-ink text-white"
        style={{ borderRadius: "var(--radius-pill)", fontWeight: 700 }}
        aria-hidden
      >
        M
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
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
                "grid h-11 w-11 place-items-center transition-colors",
                isActive
                  ? "bg-ink text-white"
                  : "text-text-soft hover:bg-surface-2"
              )}
              style={{ borderRadius: "var(--radius-pill)" }}
            >
              <Icon size={20} aria-hidden />
            </Link>
          );
        })}
      </nav>

      {user?.name ? (
        <p
          className="mt-4 max-w-[68px] truncate text-center text-[11px] font-medium text-text-muted"
          title={user.name}
        >
          {user.name}
        </p>
      ) : null}
    </aside>
  );
}