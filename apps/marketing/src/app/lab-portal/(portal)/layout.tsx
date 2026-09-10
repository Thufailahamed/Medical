"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  TestTube2,
  PackageOpen,
  Users,
  Bell,
  Search,
  LogOut,
  Settings,
  ChevronRight,
  FlaskConical,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useLabAuthStore, getLabSessionUser } from "../stores/auth";
import { loginHref } from "@/portal/lib/login";

const emptySubscribe = () => () => {};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/lab-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lab-portal/bookings", label: "Bookings", icon: ClipboardList, badge: "live" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/lab-portal/catalog", label: "Test Catalog", icon: TestTube2 },
      { href: "/lab-portal/packages", label: "Packages", icon: PackageOpen },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/lab-portal/phlebotomists", label: "Phlebotomists", icon: Users },
    ],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  "/lab-portal/dashboard": "Dashboard",
  "/lab-portal/bookings": "Bookings",
  "/lab-portal/catalog": "Test Catalog",
  "/lab-portal/packages": "Test Packages",
  "/lab-portal/phlebotomists": "Phlebotomists",
};

function resolveCurrentLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/lab-portal/bookings/")) return "Booking Detail";
  return "Lab Portal";
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearAuth } = useLabAuthStore();
  const displayUser = user ?? getLabSessionUser();
  const [search, setSearch] = useState("");

  // Defer rendering until the client has mounted to avoid hydration mismatches
  // with Zustand persist in localStorage.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) {
      router.push(loginHref({ port: "facility", next: pathname || "/lab-portal/dashboard" }));
    }
  }, [mounted, isAuthenticated, router, pathname]);

  const initials = useMemo(() => {
    const name = displayUser?.name || "Lab";
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [displayUser?.name]);

  const currentLabel = resolveCurrentLabel(pathname || "/lab-portal/dashboard");
  const labName = displayUser?.name?.includes("Lab")
    ? displayUser.name
    : displayUser?.name || "Test Lab";

  // Match server (renders nothing) on the very first client paint to
  // avoid a hydration mismatch; the second effect then either renders
  // the chrome or redirects to login.
  if (!mounted) return null;
  if (!isAuthenticated()) return null;

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="lab-sidebar" aria-label="Lab portal navigation">
        {/* Brand Header */}
        <div className="lab-sidebar-brand">
          <div className="lab-sidebar-mark" aria-hidden="true">
            <FlaskConical size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="lab-sidebar-name">HealthHub</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                Lab
              </span>
            </div>
            <div className="lab-sidebar-sub">Diagnostic Console</div>
          </div>
        </div>

        {/* Facility Context Card */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] p-2.5 hover:bg-white/[0.05] transition-all group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 grid place-content-center flex-shrink-0 group-hover:bg-emerald-500/15 transition-colors">
              <Building2 size={15} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                {labName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="lab-mono text-[9px] tracking-[0.12em] uppercase text-emerald-400/90 font-medium">
                  Verified Facility
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="lab-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="lab-sidebar-group-label">{group.label}</div>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/lab-portal/dashboard" &&
                      pathname.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      data-active={isActive}
                      onClick={() => router.push(item.href)}
                      className="lab-sidebar-link"
                    >
                      <span className="lab-sidebar-link-icon">
                        <Icon size={17} strokeWidth={isActive ? 2.2 : 1.9} />
                      </span>
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span
                          className="lab-sidebar-link-badge"
                          data-variant={item.badge}
                        >
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                          </span>
                          <span className="capitalize">{item.badge}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Diagnostic Integrity Card */}
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-emerald-950/25 to-slate-900/40 border border-emerald-500/15">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck size={14} strokeWidth={2.2} />
              <span className="text-[10px] font-bold tracking-wide uppercase font-mono">ISO 15189 Certified</span>
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400 leading-relaxed">
              Real-time specimen tracking and laboratory diagnostic integrity active.
            </p>
          </div>
        </nav>

        {/* Footer: user + sign out */}
        <div className="lab-sidebar-foot">
          <div className="lab-sidebar-user">
            <div className="lab-sidebar-user-avatar">{initials}</div>
            <div className="lab-sidebar-user-body">
              <div className="lab-sidebar-user-name">{displayUser?.name || "Lab Admin"}</div>
              <div className="lab-sidebar-user-role">{displayUser?.role || "Facility Staff"}</div>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Settings"
                title="Settings"
                className="lab-sidebar-icon-btn"
                onClick={() => router.push("/lab-portal/dashboard")}
              >
                <Settings size={14} />
              </button>
              <button
                type="button"
                aria-label="Sign out"
                title="Sign out"
                className="lab-sidebar-icon-btn"
                onClick={() => {
                  clearAuth();
                  router.push(loginHref({ port: "facility" }));
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
              v2.4.1
            </span>
            <span className="text-slate-500">Encrypted Console</span>
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col bg-[var(--lab-bg)] lab-bg-grain">
        {/* Topbar */}
        <header className="lab-topbar">
          <div className="lab-breadcrumb">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lab-ink-faint)]">
              Lab Portal
            </span>
            <ChevronRight size={13} className="text-[var(--lab-ink-faint)]" />
            <span className="lab-breadcrumb-current">{currentLabel}</span>
          </div>

          <div className="lab-topbar-search">
            <Search size={14} className="lab-topbar-search-icon" />
            <input
              type="search"
              placeholder="Search bookings, tests, packages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Global search"
            />
          </div>

          <div className="lab-topbar-actions">
            <button
              type="button"
              aria-label="Notifications"
              className="lab-icon-btn"
            >
              <Bell size={16} />
              <span className="lab-icon-btn-dot" />
            </button>
            <button
              type="button"
              aria-label="Settings"
              className="lab-icon-btn"
              onClick={() => router.push("/lab-portal/dashboard")}
            >
              <Settings size={16} />
            </button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-[var(--lab-border)]">
              <div className="lab-avatar">{initials}</div>
              <div className="hidden lg:block leading-tight">
                <div className="text-[12px] font-bold text-[var(--lab-night)]">
                  {displayUser?.name?.split(" ")[0] || "Lab"}
                </div>
                <div className="text-[10.5px] text-[var(--lab-ink-faint)] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
