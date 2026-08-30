"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  Settings,
  LogOut,
  User,
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
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
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
    label: "Family & Safety",
    items: [
      { href: "/patient/family", label: "Family Members", icon: UserPlus, testId: "nav-family" },
      { href: "/patient/caretakers", label: "Caretakers", icon: HeartHandshake, testId: "nav-caretakers" },
      { href: "/patient/emergency", label: "Emergency Card", icon: ShieldAlert, testId: "nav-emergency" },
      { href: "/patient/health-id", label: "Health ID (QR)", icon: QrCode, testId: "nav-health-id" },
    ],
  },
  {
    label: "Insurance",
    items: [
      { href: "/patient/insurance", label: "Policies & Plans", icon: Shield, testId: "nav-insurance" },
      { href: "/patient/insurance/marketplace", label: "Marketplace", icon: Building2, testId: "nav-marketplace" },
      { href: "/patient/insurance/claims", label: "Claims & Quotes", icon: ClipboardList, testId: "nav-claims" },
    ],
  },
  {
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

  return (
    <aside
      className={cn(
        "h-full flex flex-col shrink-0 relative overflow-hidden",
        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
      style={{
        background:
          "linear-gradient(180deg, #082B4E 0%, #0C3A6B 35%, #0A3D6E 65%, #0E4A7F 100%)",
      }}
      aria-label="Primary navigation"
    >
      {/* ── Decorative background orbs ──────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Top-right glow */}
        <div
          className="absolute -top-[30%] -right-[20%] w-[65%] aspect-square rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.5) 0%, transparent 65%)",
          }}
        />
        {/* Bottom-left glow */}
        <div
          className="absolute -bottom-[25%] -left-[15%] w-[55%] aspect-square rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 60%)",
          }}
        />
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
      </div>

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 pt-4 pb-3 shrink-0",
          collapsed ? "justify-center px-0" : "px-5"
        )}
      >
        {/* Logo icon with gradient + glow */}
        <div className="relative flex-shrink-0">
          <div
            className="relative h-10 w-10 rounded-[13px] flex items-center justify-center shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #0284C7 100%)",
              boxShadow:
                "0 4px 16px rgba(14,165,233,0.35), 0 0 0 1px rgba(255,255,255,0.15)",
            }}
          >
            <HeartPulse size={19} className="text-white" strokeWidth={2.2} />
          </div>
          {/* Pulse dot */}
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#082B4E]"
            style={{
              background: "linear-gradient(135deg, #34D399, #10B981)",
              boxShadow: "0 0 8px rgba(52,211,153,0.6)",
            }}
          />
        </div>

        {/* Wordmark */}
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-extrabold text-white tracking-wide">
                HEALTHHUB
              </span>
              <Sparkles size={11} className="text-sky-300 opacity-70" />
            </div>
            <div
              className="text-[10px] font-semibold mt-1 tracking-[0.2em] uppercase"
              style={{ color: "rgba(125,211,252,0.7)" }}
            >
              Patient Portal
            </div>
          </div>
        )}
      </div>

      {/* ── Thin gradient separator ──────────────────────────────────────── */}
      <div
        className="relative z-10 mx-4 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.25) 50%, transparent 100%)",
        }}
      />

      {/* ── Navigation groups ────────────────────────────────────────────── */}
      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-3 sidebar-scroll">
        <div className={cn("flex flex-col", collapsed ? "gap-1 px-2" : "gap-4 px-3")}>
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.label}>
              {/* Group label — hidden when collapsed */}
              {!collapsed && (
                <div className="sidebar-group-label text-[10px] font-bold tracking-[0.2em] uppercase mb-2 px-3 flex items-center gap-2">
                  <span>{group.label}</span>
                  <span
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(125,211,252,0.15), transparent)",
                    }}
                  />
                </div>
              )}

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
                            ? "justify-center h-10 w-11 mx-auto"
                            : "h-[38px] px-3"
                        )}
                      >
                        {/* Active indicator — animated pill background */}
                        {active && (
                          <span
                            className="absolute inset-0 rounded-xl sidebar-active-indicator"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(14,165,233,0.08) 100%)",
                              border: "1px solid rgba(56,189,248,0.2)",
                              boxShadow: "0 0 20px rgba(14,165,233,0.08)",
                            }}
                          />
                        )}

                        {/* Hover glow */}
                        {isHovered && !active && (
                          <span
                            className="absolute inset-0 rounded-xl transition-opacity duration-200"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                            }}
                          />
                        )}

                        {/* Active left accent bar with glow */}
                        {active && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{
                              background:
                                "linear-gradient(180deg, #38BDF8, #0EA5E9)",
                              boxShadow: "0 0 8px rgba(56,189,248,0.5)",
                            }}
                          />
                        )}

                        {/* Icon container */}
                        <span
                          className={cn(
                            "relative z-10 flex-shrink-0 flex items-center justify-center transition-all duration-200",
                            active ? "h-6 w-6 rounded-lg" : "h-5 w-5"
                          )}
                        >
                          <Icon
                            size={collapsed ? 17 : 15}
                            strokeWidth={active ? 2.3 : 1.8}
                            className="transition-all duration-200"
                          />
                        </span>

                        {!collapsed && (
                          <span className="relative z-10 flex-1 truncate leading-none transition-colors duration-200">
                            {item.label}
                          </span>
                        )}

                        {/* Badge counter */}
                        {hasBadge && (
                          <span
                            className={cn(
                              "relative z-10 text-[10px] font-bold rounded-full flex items-center justify-center text-white",
                              collapsed
                                ? "absolute top-1 right-1 h-2 w-2 p-0 bg-sky-400"
                                : "px-1.5 py-0.2 min-w-[18px] h-[18px] bg-sky-500 shadow-sm"
                            )}
                          >
                            {!collapsed ? unreadNotifications : null}
                          </span>
                        )}

                        {/* Collapsed active dot indicator */}
                        {active && collapsed && !hasBadge && (
                          <span
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
                            style={{
                              background: "#38BDF8",
                              boxShadow: "0 0 6px rgba(56,189,248,0.6)",
                            }}
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Divider between groups */}
              {groupIdx < NAV_GROUPS.length - 1 && (
                <div
                  className={cn(
                    collapsed ? "my-2 mx-auto w-8 h-px" : "my-3 mx-3 h-px"
                  )}
                  style={{
                    background: collapsed
                      ? "rgba(125,211,252,0.1)"
                      : "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.12) 50%, transparent 100%)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* ── Patient Profile Footer ────────────────────────────────────────── */}
      <div className="relative z-10 mt-auto shrink-0">
        {/* Top gradient separator */}
        <div
          className="h-px mx-4"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.2) 50%, transparent 100%)",
          }}
        />

        <div
          className="sidebar-footer-bg"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 sidebar-btn transition-all duration-200",
              collapsed ? "justify-center px-0" : "px-4"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className={cn(
                "flex items-center justify-center h-5 w-5 rounded-md transition-transform duration-200",
                collapsed ? "rotate-180" : ""
              )}
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <ChevronLeft size={12} strokeWidth={2.2} />
            </span>
            {!collapsed && (
              <span className="text-[11px] font-medium tracking-wide opacity-70">
                Collapse
              </span>
            )}
          </button>

          {/* Patient Card */}
          <div
            className={cn(
              "flex items-center gap-3 pb-3",
              collapsed ? "justify-center px-0 pt-1" : "px-4 pt-1"
            )}
          >
            {/* Avatar with gradient ring */}
            <div className="relative flex-shrink-0">
              <div
                title={user?.name ?? undefined}
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  boxShadow:
                    "0 2px 10px rgba(14,165,233,0.3), 0 0 0 2px rgba(56,189,248,0.2)",
                }}
              >
                {initials}
              </div>
              {/* Online indicator */}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                style={{
                  borderColor: "#082B4E",
                  background: "linear-gradient(135deg, #34D399, #10B981)",
                  boxShadow: "0 0 6px rgba(52,211,153,0.5)",
                }}
              />
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-white truncate leading-tight">
                  {user?.name ?? "Patient"}
                </div>
                <div className="text-[10px] leading-tight truncate mt-0.5 sidebar-patient-email flex items-center gap-1">
                  <span className="truncate">
                    {user?.email ?? user?.phone ?? "HealthHub"}
                  </span>
                </div>
              </div>
            )}

            {!collapsed && (
              <div className="flex items-center gap-1">
                <Link
                  href="/patient/profile"
                  className="h-7 w-7 rounded-lg flex items-center justify-center sidebar-footer-btn transition-all duration-200"
                  title="Profile & Settings"
                >
                  <Settings size={13} strokeWidth={2} />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  data-testid="sidebar-logout"
                  className="h-7 w-7 rounded-lg flex items-center justify-center sidebar-footer-btn sidebar-footer-btn-danger transition-all duration-200 disabled:opacity-50"
                  title="Sign out"
                >
                  <LogOut size={13} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
