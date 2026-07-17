"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  ChevronLeft,
  LogOut,
  Settings,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { useUiStore } from "@/hospital/stores/ui";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { cn } from "@/hospital/lib/utils";
import { logout } from "@/hospital/lib/auth";
import { visibleNavGroups } from "./nav";
import type { HospitalRole } from "@/hospital/stores/auth";

/**
 * Hospital + clinic sidebar.
 *
 * Same visual language as the doctor portal sidebar so staff moving
 * between the two feels at home, but the nav tree comes from our own
 * `nav.ts` and is filtered by hospital-portal roles.
 */
export function HospitalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const userRole = (user?.role as HospitalRole | undefined) ?? "hospital_admin";

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "HS";

  const visibleGroups = visibleNavGroups(userRole);

  async function handleLogout() {
    await logout();
    router.replace("/hospital/login");
  }

  return (
    <aside
      className={cn(
        "h-full flex flex-col shrink-0 relative overflow-hidden no-print",
        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
      style={{
        background:
          "linear-gradient(180deg, #082B4E 0%, #0C3A6B 35%, #0A3D6E 65%, #0E4A7F 100%)",
      }}
      aria-label="Primary navigation"
    >
      {/* Background orbs */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-[30%] -right-[20%] w-[65%] aspect-square rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.5) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute -bottom-[25%] -left-[15%] w-[55%] aspect-square rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* Logo / wordmark */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 h-[var(--topbar-h,64px)]",
          collapsed ? "justify-center px-0" : "px-5"
        )}
      >
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
            <Building2 size={18} className="text-white" strokeWidth={2.2} />
          </div>
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#082B4E]"
            style={{
              background: "linear-gradient(135deg, #34D399, #10B981)",
              boxShadow: "0 0 8px rgba(52,211,153,0.6)",
            }}
          />
        </div>

        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-extrabold text-white tracking-wide">
                {t("shell.wordmark")}
              </span>
              <Sparkles size={11} className="text-sky-300 opacity-70" />
            </div>
            <div
              className="text-[10px] font-semibold mt-1 tracking-[0.2em] uppercase"
              style={{ color: "rgba(125,211,252,0.7)" }}
            >
              {t("shell.wordmarkSubtitle")}
            </div>
          </div>
        )}
      </div>

      <div
        className="relative z-10 mx-4 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.25) 50%, transparent 100%)",
        }}
      />

      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-3 sidebar-scroll">
        <div className={cn("flex flex-col", collapsed ? "gap-1 px-2" : "gap-4 px-3")}>
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.labelKey}>
              {!collapsed && (
                <div className="sidebar-group-label text-[10px] font-bold tracking-[0.2em] uppercase mb-2 px-3 flex items-center gap-2">
                  <span>{t(`nav.${group.labelKey}`)}</span>
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
                    pathname === item.href ||
                    (pathname?.startsWith(item.href) ?? false);
                  const Icon = item.icon;
                  const isHovered = hoveredItem === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? t(`nav.${item.labelKey}`) : undefined}
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

                        {isHovered && !active && (
                          <span
                            className="absolute inset-0 rounded-xl transition-opacity duration-200"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          />
                        )}

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
                          <span className="relative z-10 truncate leading-none text-white/90 transition-colors duration-200">
                            {t(`nav.${item.labelKey}`)}
                          </span>
                        )}

                        {active && collapsed && (
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

              {groupIdx < visibleGroups.length - 1 && (
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

      {/* Footer */}
      <div className="relative z-10">
        <div
          className="h-px mx-4"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.2) 50%, transparent 100%)",
          }}
        />

        <div
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 100%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 sidebar-btn transition-all duration-200 text-white/80",
              collapsed ? "justify-center px-0" : "px-4"
            )}
            aria-label={collapsed ? t("shell.expand") : t("shell.collapse")}
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
                {t("shell.collapse")}
              </span>
            )}
          </button>

          <div
            className={cn(
              "flex items-center gap-3 pb-3",
              collapsed ? "justify-center px-0 pt-2" : "px-4 pt-2"
            )}
          >
            <div className="relative flex-shrink-0">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  boxShadow:
                    "0 2px 10px rgba(14,165,233,0.3), 0 0 0 2px rgba(56,189,248,0.2)",
                }}
              >
                {initials}
              </div>
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
                  {user?.name ?? "Staff"}
                </div>
                <div className="text-[10px] leading-tight truncate mt-0.5 text-white/60 flex items-center gap-1">
                  <span className="truncate">
                    {user?.email ?? user?.phone ?? ""}
                  </span>
                </div>
              </div>
            )}

            {!collapsed && (
              <div className="flex items-center gap-1">
                <Link
                  href="/hospital/settings"
                  className="h-7 w-7 rounded-lg flex items-center justify-center sidebar-footer-btn transition-all duration-200 text-white/70 hover:text-white"
                  title={t("shell.settings")}
                >
                  <Settings size={13} strokeWidth={2} />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-7 w-7 rounded-lg flex items-center justify-center sidebar-footer-btn sidebar-footer-btn-danger transition-all duration-200 text-white/70 hover:text-red-300"
                  title={t("shell.logout")}
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