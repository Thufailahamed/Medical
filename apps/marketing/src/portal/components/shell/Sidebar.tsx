"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Stethoscope,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { NAV } from "./nav";
import { useUiStore } from "@/portal/stores/ui";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const t = useT();

  return (
    <aside
      className={cn(
        "bg-surface border-r border-border h-screen sticky top-0 flex flex-col transition-all duration-200 shrink-0",
        collapsed ? "w-[68px]" : "w-[var(--sidebar-w)]"
      )}
      aria-label="Primary navigation"
    >
      <div className="h-[var(--topbar-h)] flex items-center gap-2 px-4 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
          <Stethoscope size={16} />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text leading-none">MedLocker</div>
            <div className="text-[10px] text-text-soft mt-0.5">Doctor Portal</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm transition-colors focus-ring",
                    active
                      ? "bg-brand-soft text-brand-strong font-medium"
                      : "text-text-soft hover:bg-surface-2 hover:text-text"
                  )}
                  title={collapsed ? t(item.labelKey) : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed ? (
                    <span className="truncate">{t(item.labelKey)}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-2 border-t border-border">
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-xs text-text-soft hover:bg-surface-2 focus-ring"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}