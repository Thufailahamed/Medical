"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  HeartPulse,
  CalendarDays,
  Pill,
  FileText,
  Users,
  Sparkles,
  FolderOpen,
  FlaskConical,
  ScanLine,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  HeartHandshake,
  ShieldAlert,
  QrCode,
  Shield,
  Building2,
  ClipboardList,
  MessageSquare,
  Bell,
  StickyNote,
  Share2,
  Store,
  Download,
  Clock3,
  ChevronLeft,
  ChevronDown,
  Settings,
  LogOut,
  User,
  Search,
  X,
} from "lucide-react";

import { useUiStore } from "@/portal/stores/ui";
import { useAuthStore } from "@/portal/stores/auth";
import { logout } from "@/portal/lib/auth";
import { loginHref } from "@/portal/lib/login";
import { cn } from "@/portal/lib/utils";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";

// ─── Grouped navigation structure with ALL patient portal features ───────────
interface NavItem {
  href: string;
  label: string;
  icon: any;
  testId?: string;
  badge?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "health-care",
    label: "Health & Care",
    items: [
      { href: "/patient", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
      { href: "/patient/health", label: "My Health", icon: HeartPulse, testId: "nav-health" },
      { href: "/patient/appointments", label: "Appointments", icon: CalendarDays, testId: "nav-appointments" },
      { href: "/patient/medications", label: "Medications", icon: Pill, testId: "nav-medications" },
      { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText, testId: "nav-prescriptions" },
      { href: "/patient/care-team", label: "Care Team", icon: Users, testId: "nav-care-team" },
      { href: "/patient/ai", label: "AI Assistant", icon: Sparkles, testId: "nav-ai" },
    ],
  },
  {
    id: "records-labs",
    label: "Records & Labs",
    items: [
      { href: "/patient/records", label: "Medical Records", icon: FolderOpen, testId: "nav-records" },
      { href: "/patient/timeline", label: "Timeline", icon: Clock3, testId: "nav-timeline" },
      { href: "/patient/diagnostic-tests", label: "Lab Tests", icon: FlaskConical, testId: "nav-diagnostic-tests" },
      { href: "/patient/diagnostic-tests/bookings", label: "My Lab Bookings", icon: ClipboardList, testId: "nav-diagnostic-bookings" },
      { href: "/patient/imaging", label: "Imaging & Scans", icon: ScanLine, testId: "nav-imaging" },
      { href: "/patient/vaccinations", label: "Vaccinations", icon: ShieldCheck, testId: "nav-vaccinations" },
      { href: "/patient/allergies", label: "Allergies", icon: AlertCircle, testId: "nav-allergies" },
    ],
  },
  {
    id: "family-safety",
    label: "Family & Safety",
    items: [
      { href: "/patient/family", label: "Family Members", icon: UserPlus, testId: "nav-family" },
      { href: "/patient/caretakers", label: "Caretakers", icon: HeartHandshake, testId: "nav-caretakers" },
      { href: "/patient/marketplace", label: "Find a Caretaker", icon: Store, testId: "nav-caretaker-marketplace" },
      { href: "/patient/emergency", label: "Emergency Card", icon: ShieldAlert, testId: "nav-emergency" },
      { href: "/patient/health-id", label: "Health ID (QR)", icon: QrCode, testId: "nav-health-id" },
    ],
  },
  {
    id: "insurance",
    label: "Insurance",
    items: [
      { href: "/patient/insurance", label: "Policies & Plans", icon: Shield, testId: "nav-insurance" },
      { href: "/patient/insurance/marketplace", label: "Marketplace", icon: Building2, testId: "nav-marketplace" },
      { href: "/patient/insurance/claims", label: "Claims & Quotes", icon: ClipboardList, testId: "nav-claims" },
    ],
  },
  {
    id: "tools",
    label: "Communicate & Tools",
    items: [
      { href: "/patient/messages", label: "Messages", icon: MessageSquare, testId: "nav-messages" },
      { href: "/patient/notifications", label: "Notifications", icon: Bell, testId: "nav-notifications", badge: true },
      { href: "/patient/notes", label: "Personal Notes", icon: StickyNote, testId: "nav-notes" },
      { href: "/patient/share", label: "Share Records", icon: Share2, testId: "nav-share" },
      { href: "/patient/consents", label: "Consents", icon: ShieldCheck, testId: "nav-consents" },
      { href: "/patient/export", label: "Export Data", icon: Download, testId: "nav-export" },
      { href: "/patient/dsar", label: "Data Requests", icon: ClipboardList, testId: "nav-dsar" },
      { href: "/patient/audit", label: "Activity Audit", icon: Clock3, testId: "nav-audit" },
      { href: "/patient/profile", label: "Profile", icon: User, testId: "nav-profile" },
    ],
  },
];

export function Sidebar({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsedPref = useUiStore((s) => s.sidebarCollapsed);
  const collapsed = collapsedPref && !forceExpanded;
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const unreadNotifications = useUnreadNotificationsCount();
  const [signingOut, setSigningOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "PT";

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace(loginHref({ port: "patient" }));
    } finally {
      setSigningOut(false);
    }
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter groups and items if user is searching
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS;
    const query = searchQuery.toLowerCase().trim();
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(query)),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col shrink-0 relative overflow-hidden select-none",
        "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        collapsed ? "w-[72px]" : "w-[264px]"
      )}
      style={{
        background: "var(--color-surface)",
        borderRight: "1px solid rgba(19, 32, 68, 0.10)",
      }}
      aria-label="Primary navigation"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden"
        aria-hidden="true"
      />

      {/* ── Top Brand Header ────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 pt-4 pb-3.5 shrink-0 border-b border-ink/[0.08]",
          collapsed ? "justify-center px-0" : "px-4"
        )}
      >
        <Link
          href="/patient"
          className="flex items-center gap-3 group focus-visible:outline-none"
          title="HealthHub Patient Portal"
        >
          {/* Logo icon with glow */}
          <div className="relative flex-shrink-0">
            <div
              className="relative h-9 w-9 rounded-xl flex items-center justify-center shadow-brand transition-transform duration-200 group-hover:scale-105"
              style={{
                background: "var(--color-brand)",
              }}
            >
              <HeartPulse size={18} className="text-white" strokeWidth={2.4} />
            </div>
            {/* Live Security Pulse */}
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success"
            />
          </div>

          {/* Wordmark & Portal Tag */}
          {!collapsed && (
            <div className="min-w-0 leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-text tracking-tight">
                  HealthHub
                </span>
                <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand border border-border">
                  Patient
                </span>
              </div>
              <div className="text-[10px] font-medium text-text-muted mt-1 flex items-center gap-1.5">
                <span className="pt-dot bg-success inline-block" />
                <span className="tracking-wide">Personal Care</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* ── Quick Search / Filter (Expanded Only) ────────────────────────── */}
      {!collapsed && (
        <div className="relative z-10 px-3 pt-3 pb-1">
          <div className="relative flex items-center">
            <Search
              size={13}
              className="absolute left-2.5 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick find..."
              className="w-full h-8 pl-8 pr-7 bg-surface-2 border border-transparent hover:border-border focus:border-brand rounded-lg text-xs text-text placeholder:text-text-muted outline-none transition-all duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-text-muted hover:text-text p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation groups ────────────────────────────────────────────── */}
      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-3 sidebar-scroll">
        <div className={cn("flex flex-col", collapsed ? "gap-1 px-2" : "gap-3 px-3")}>
          {filteredGroups.map((group) => {
            const isGroupCollapsed = !collapsed && !!collapsedGroups[group.id] && !searchQuery;

            return (
              <div key={group.id} className="flex flex-col">
                {/* Group label */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="sidebar-group-label-light group/label flex items-center justify-between text-[10px] font-bold tracking-[0.12em] uppercase mb-1 px-2 py-1 rounded hover:bg-ink/[0.03] transition-colors"
                  >
                    <span className="text-text-muted group-hover/label:text-text-soft transition-colors">
                      {group.label}
                    </span>
                    <span className="flex items-center gap-1.5 opacity-60 group-hover/label:opacity-100 transition-opacity">
                      <ChevronDown
                        size={11}
                        className={cn(
                          "transition-transform duration-200 text-text-muted",
                          isGroupCollapsed ? "-rotate-90" : "rotate-0"
                        )}
                      />
                    </span>
                  </button>
                )}

                {/* Items List */}
                {!isGroupCollapsed && (
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active =
                        item.href === "/patient"
                          ? pathname === "/patient"
                          : pathname?.startsWith(item.href) ?? false;
                      const Icon = item.icon;
                      const hasBadge = item.badge && unreadNotifications > 0;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            data-testid={item.testId}
                            title={collapsed ? item.label : undefined}
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium sidebar-link-light",
                              collapsed
                                ? "justify-center h-10 w-10 mx-auto"
                                : "h-[36px] px-2.5"
                            )}
                          >
                            {/* Active left glowing bar */}
                            {active && !collapsed && (
                              <span
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-brand"
                              />
                            )}

                            {/* Icon container */}
                            <span
                              className={cn(
                                "relative z-10 flex-shrink-0 flex items-center justify-center transition-all duration-180",
                                active ? "text-brand" : "text-text-muted group-hover:text-text"
                              )}
                            >
                              <Icon
                                size={collapsed ? 18 : 16}
                                strokeWidth={active ? 2.3 : 1.8}
                              />
                            </span>

                            {/* Item label */}
                            {!collapsed && (
                              <span
                                className={cn(
                                  "relative z-10 flex-1 truncate transition-colors duration-180",
                                  active
                                    ? "text-text font-semibold"
                                    : "text-text-soft group-hover:text-text"
                                )}
                              >
                                {item.label}
                              </span>
                            )}

                            {/* Unread badge count */}
                            {hasBadge && (
                              <span
                                className={cn(
                                  "relative z-10 text-[10px] font-bold rounded-full flex items-center justify-center text-white bg-brand",
                                  collapsed
                                    ? "absolute top-1.5 right-1.5 h-2 w-2 p-0"
                                    : "px-1.5 min-w-[18px] h-[18px]"
                                )}
                              >
                                {!collapsed ? unreadNotifications : null}
                              </span>
                            )}

                            {/* Collapsed active dot */}
                            {active && collapsed && !hasBadge && (
                              <span
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rotate-45 bg-brand"
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Patient Profile Footer ────────────────────────────────────────── */}
      <div className="relative z-10 mt-auto shrink-0 border-t border-ink/[0.08]">
        {/* Collapse toggle row — desktop rail only */}
        {!forceExpanded && (
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "w-full flex items-center gap-2 h-7 rounded-lg text-text-muted hover:text-text hover:bg-ink/[0.04] transition-all duration-150",
              collapsed ? "justify-center px-0" : "px-2.5"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className={cn(
                "flex items-center justify-center transition-transform duration-200",
                collapsed ? "rotate-180" : ""
              )}
            >
              <ChevronLeft size={13} strokeWidth={2.2} />
            </span>
            {!collapsed && (
              <span className="text-[11px] font-medium tracking-wide">
                Collapse sidebar
              </span>
            )}
          </button>
        </div>
        )}

        {/* Patient Profile Card */}
        <div
          className={cn(
            "p-2.5",
            collapsed ? "flex justify-center" : "flex items-center gap-2.5"
          )}
        >
          {/* Avatar — ink square with mono initials, VYRO style */}
          <div className="relative flex-shrink-0">
            <div
              title={user?.name ?? undefined}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono bg-ink text-brand-soft shadow-sm"
            >
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-text truncate leading-tight">
                {user?.name ?? "Patient"}
              </div>
              <div className="text-[10px] text-text-muted leading-tight truncate mt-0.5 font-mono">
                {user?.email ?? user?.phone ?? "HealthHub"}
              </div>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1">
              <Link
                href="/patient/profile"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-ink/[0.06] transition-colors"
                title="Profile & Settings"
              >
                <Settings size={13} strokeWidth={2} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                data-testid="sidebar-logout"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
                title="Sign out"
              >
                <LogOut size={13} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Mono meta line — VYRO footer signature */}
        {!collapsed && (
          <div className="flex items-center justify-between px-4 pb-2.5 text-[9px] font-mono uppercase tracking-[0.14em] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="pt-dot bg-success" />
              Secured
            </span>
            <span>HealthHub</span>
          </div>
        )}
      </div>
    </aside>
  );
}
