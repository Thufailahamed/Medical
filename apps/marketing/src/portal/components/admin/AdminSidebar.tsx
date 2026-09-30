"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, Search, Settings as SettingsIcon, ShieldCheck, X } from "lucide-react";
import { ADMIN_NAV_GROUPS, navLabel } from "./admin-nav";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { loginHref } from "@/portal/lib/login";
import { api } from "@/portal/lib/api";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type DashboardCounts = {
  users: { pendingApprovals: number };
  doctors: { slmcUnverified: number };
  operations: {
    pendingPayouts: number;
    openInsuranceClaims: number;
    openDsarRequests: number;
    newDemoRequests: number;
  };
};

export function AdminSidebar() {
  const pathname = usePathname() || "";
  const t = useT();
  const { user, logout } = useAuthStore();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const role = user?.role as string | undefined;
  const isSuperAdmin = role === "super_admin";

  // Live queue counts — shares the dashboard's cache entry, so it's free
  // when the dashboard is open and refreshes on the same 60s cadence.
  const { data: dash } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<DashboardCounts>("/admin/dashboard"),
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
  });

  const badges: Record<string, { count: number; tone: "amber" | "sky" | "rose" }> = {
    "/admin/inbox": { count: unread?.count ?? 0, tone: "sky" },
    "/admin/approvals": { count: dash?.users.pendingApprovals ?? 0, tone: "amber" },
    "/admin/doctors": { count: dash?.doctors.slmcUnverified ?? 0, tone: "amber" },
    "/admin/payouts": { count: dash?.operations.pendingPayouts ?? 0, tone: "amber" },
    "/admin/insurance-claims": { count: dash?.operations.openInsuranceClaims ?? 0, tone: "sky" },
    "/admin/dsar": { count: dash?.operations.openDsarRequests ?? 0, tone: "rose" },
    "/admin/demo-requests": { count: dash?.operations.newDemoRequests ?? 0, tone: "sky" },
  };

  const term = filter.trim().toLowerCase();

  // Filter groups: drop items the role can't see (and non-matches while
  // searching), then drop empty groups.
  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    label: navLabel(t, group.labelKey),
    items: group.items
      .filter((item) => isSuperAdmin || !item.roles || item.roles.includes(role ?? ""))
      .map((item) => ({ ...item, label: navLabel(t, item.labelKey) }))
      .filter((item) => !term || item.label.toLowerCase().includes(term)),
  })).filter((group) => group.items.length > 0);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const totalAttention = Object.entries(badges)
    .filter(([href]) => href !== "/admin/inbox")
    .reduce((acc, [, b]) => acc + b.count, 0);

  return (
    <aside
      className="relative hidden w-[264px] shrink-0 flex-col overflow-hidden text-slate-300 md:flex [&_a:hover]:no-underline"
      style={{
        background:
          "radial-gradient(420px 300px at 0% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(360px 280px at 100% 100%, rgba(20,184,166,0.10), transparent 60%), #061b2e",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
      }}
      aria-label="Admin navigation"
    >
      {/* Brand */}
      <div className="relative flex h-[64px] shrink-0 items-center gap-3 px-5">
        <div className="relative grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_6px_18px_-4px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/20">
          <ShieldCheck size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-none tracking-[-0.01em] text-white">HealthHub</p>
          <p className="mt-1.5 font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.18em] text-sky-300/90">
            {isSuperAdmin ? "Admin console" : "Operator console"}
          </p>
        </div>
        {totalAttention > 0 ? (
          <Link
            href="/admin/dashboard"
            title={`${totalAttention} items need attention`}
            className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-amber-400/15 px-1.5 text-[10.5px] font-bold tabular-nums text-amber-200 ring-1 ring-inset ring-amber-300/30"
          >
            {totalAttention}
          </Link>
        ) : null}
        <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" aria-hidden />
      </div>

      {/* Quick filter */}
      <div className="px-3 pb-1 pt-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFilter("");
            }}
            placeholder="Jump to…"
            aria-label="Filter navigation"
            className="h-9 w-full rounded-[10px] border border-white/[0.07] bg-white/[0.04] pl-8 pr-8 text-[12.5px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/40 focus:bg-white/[0.07]"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-slate-500 hover:text-white"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Nav groups */}
      <nav className="admin-sidebar-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {visibleGroups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">No pages match “{filter}”.</p>
        ) : null}
        {visibleGroups.map((group) => {
          const groupHasActive = group.items.some((i) => isActive(i.href));
          const groupCount = group.items.reduce((acc, i) => acc + (badges[i.href]?.count ?? 0), 0);
          // Searching always expands; otherwise the active group stays open.
          const open = term !== "" || groupHasActive || !collapsed[group.labelKey];
          return (
            <div key={group.labelKey}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.labelKey]: !c[group.labelKey] }))}
                aria-expanded={open}
                className="group/g flex w-full items-center gap-2 rounded-md px-3 py-1 text-left"
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors group-hover/g:text-slate-300">
                  {group.label}
                </span>
                {!open && groupCount > 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label={`${groupCount} pending`} />
                ) : null}
                <span className="h-px flex-1 bg-white/[0.05]" aria-hidden />
                <ChevronDown
                  size={12}
                  className={cn(
                    "text-slate-600 transition-transform group-hover/g:text-slate-400",
                    !open && "-rotate-90",
                    groupHasActive && "opacity-0",
                  )}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    const badge = badges[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] transition-all",
                          active
                            ? "bg-gradient-to-r from-sky-400/[0.16] to-sky-400/[0.04] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(125,211,252,0.14)]"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        )}
                      >
                        {active ? (
                          <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" aria-hidden />
                        ) : null}
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors",
                            active ? "bg-sky-400/20 text-sky-300" : "text-slate-500 group-hover:text-slate-200",
                          )}
                        >
                          <Icon size={15} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {badge && badge.count > 0 ? (
                          <span
                            className={cn(
                              "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums",
                              badge.tone === "amber" && "bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/25",
                              badge.tone === "sky" && "bg-sky-400/15 text-sky-200 ring-1 ring-inset ring-sky-300/25",
                              badge.tone === "rose" && "bg-rose-400/15 text-rose-200 ring-1 ring-inset ring-rose-300/25",
                            )}
                          >
                            {badge.count > 99 ? "99+" : badge.count}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Footer: user + sign out */}
      <div className="shrink-0 p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
          <div className="relative shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-semibold text-white ring-2 ring-white/10">
              {(user?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#061b2e] bg-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.name || "Admin"}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              {(user?.role ?? "—").replace(/_/g, " ")}
            </p>
          </div>
          {isSuperAdmin ? (
            <Link
              href="/admin/settings"
              aria-label="Settings"
              title="Settings"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <SettingsIcon size={15} />
            </Link>
          ) : null}
          <button
            onClick={() => {
              logout();
              window.location.href = loginHref({ port: "operator" });
            }}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
