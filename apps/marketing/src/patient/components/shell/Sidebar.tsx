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
      { href: "/patient/diagnostic-tests", label: "Lab Tests", icon: FlaskConical, testId: "nav-diagnostic-tests" },
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const unreadNotifications = useUnreadNotificationsCount();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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
        background: "linear-gradient(180deg, #070d18 0%, #0a1628 55%, #07101d 100%)",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "4px 0 24px rgba(0, 0, 0, 0.25)",
      }}
      aria-label="Primary navigation"
    >
      {/* ── Ambient Background Lighting ───────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-[20%] -right-[15%] w-[80%] aspect-square rounded-full opacity-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute -bottom-[20%] -left-[15%] w-[70%] aspect-square rounded-full opacity-15 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 65%)",
          }}
        />
        {/* Architectural subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* ── Top Brand Header ────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 pt-4 pb-3.5 shrink-0 border-b border-white/[0.06]",
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
              className="relative h-9 w-9 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%)",
                boxShadow: "0 4px 14px rgba(14,165,233,0.35), 0 0 0 1px rgba(255,255,255,0.2)",
              }}
            >
              <HeartPulse size={18} className="text-white" strokeWidth={2.4} />
            </div>
            {/* Live Security Pulse */}
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#070d18] bg-emerald-400"
              style={{ boxShadow: "0 0 8px #34d399" }}
            />
          </div>

          {/* Wordmark & Portal Tag */}
          {!collapsed && (
            <div className="min-w-0 leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-white tracking-tight">
                  HealthHub
                </span>
                <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25">
                  Patient
                </span>
              </div>
              <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
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
              className="absolute left-2.5 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick find..."
              className="w-full h-8 pl-8 pr-7 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] focus:border-sky-500/50 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none transition-all duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-slate-400 hover:text-white p-0.5"
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
                    className="sidebar-group-label group/label flex items-center justify-between text-[10px] font-bold tracking-[0.12em] uppercase mb-1 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-slate-400 group-hover/label:text-slate-200 transition-colors">
                      {group.label}
                    </span>
                    <span className="flex items-center gap-1.5 opacity-60 group-hover/label:opacity-100 transition-opacity">
                      <ChevronDown
                        size={11}
                        className={cn(
                          "transition-transform duration-200 text-slate-400",
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
                      const isHovered = hoveredItem === item.href;
                      const hasBadge = item.badge && unreadNotifications > 0;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            data-testid={item.testId}
                            title={collapsed ? item.label : undefined}
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            onMouseEnter={() => setHoveredItem(item.href)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium sidebar-link",
                              collapsed
                                ? "justify-center h-10 w-10 mx-auto"
                                : "h-[36px] px-2.5"
                            )}
                          >
                            {/* Active left glowing bar */}
                            {active && !collapsed && (
                              <span
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                                style={{
                                  background: "linear-gradient(180deg, #38bdf8, #0ea5e9)",
                                  boxShadow: "0 0 10px rgba(56, 189, 248, 0.7)",
                                }}
                              />
                            )}

                            {/* Icon container */}
                            <span
                              className={cn(
                                "relative z-10 flex-shrink-0 flex items-center justify-center transition-all duration-180",
                                active ? "text-sky-400" : "text-slate-400 group-hover:text-slate-200"
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
                                    ? "text-white font-semibold"
                                    : "text-slate-300 group-hover:text-white"
                                )}
                              >
                                {item.label}
                              </span>
                            )}

                            {/* Unread badge count */}
                            {hasBadge && (
                              <span
                                className={cn(
                                  "relative z-10 text-[10px] font-bold rounded-full flex items-center justify-center text-white bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]",
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
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-sky-400"
                                style={{ boxShadow: "0 0 6px rgba(56,189,248,0.7)" }}
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
      <div className="relative z-10 mt-auto shrink-0 border-t border-white/[0.08] bg-[#060d18]/80 backdrop-blur-md">
        {/* Collapse toggle row */}
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "w-full flex items-center gap-2 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150",
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

        {/* Patient Profile Card */}
        <div
          className={cn(
            "p-2.5",
            collapsed ? "flex justify-center" : "flex items-center gap-2.5"
          )}
        >
          {/* Avatar with gradient ring */}
          <div className="relative flex-shrink-0">
            <div
              title={user?.name ?? undefined}
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.4), 0 0 0 1.5px rgba(56, 189, 248, 0.3)",
              }}
            >
              {initials}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#060d18] bg-emerald-400"
              style={{ boxShadow: "0 0 6px #34d399" }}
            />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-white truncate leading-tight">
                {user?.name ?? "Patient"}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight truncate mt-0.5 font-mono">
                {user?.email ?? user?.phone ?? "HealthHub"}
              </div>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1">
              <Link
                href="/patient/profile"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Profile & Settings"
              >
                <Settings size={13} strokeWidth={2} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                data-testid="sidebar-logout"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
                title="Sign out"
              >
                <LogOut size={13} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
