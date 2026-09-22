"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-nav";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { loginHref } from "@/portal/lib/login";

function resolveLabel(t: (k: string) => string, key: string): string {
  const direct = t(key);
  if (direct && direct !== key) return direct;
  const lastPart = key.split(".").pop() ?? key;
  return lastPart
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

export function AdminSidebar() {
  const pathname = usePathname() || "";
  const t = useT();
  const { user, logout } = useAuthStore();

  const role = user?.role as string | undefined;
  const isSuperAdmin = role === "super_admin";

  // Filter groups: drop empty ones, and drop items the role can't see.
  const visibleGroups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => isSuperAdmin || !item.roles || item.roles.includes(role ?? ""),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      className="hidden md:flex flex-col w-[260px] shrink-0 bg-slate-950 text-slate-300"
      aria-label="Admin navigation"
    >
      {/* Brand */}
      <div className="h-[60px] flex items-center gap-2.5 px-5 border-b border-white/[0.06]">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-[0_4px_14px_rgba(59,111,245,0.45)]">
          <ShieldCheck size={18} strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-sm font-extrabold tracking-wider leading-none text-white">HEALTHHUB</p>
          <p className="text-[10px] font-semibold tracking-[0.18em] mt-1 text-blue-400/90">
            {isSuperAdmin ? "ADMIN" : "OPERATOR"}
          </p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="admin-sidebar-scroll flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
        {visibleGroups.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
              {resolveLabel(t, group.labelKey)}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] transition-all no-underline hover:no-underline",
                      active
                        ? "bg-blue-500/15 text-blue-300 font-semibold ring-1 ring-inset ring-blue-400/25"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <Icon
                      size={16}
                      strokeWidth={2}
                      className={active ? "text-blue-400" : "text-slate-500"}
                    />
                    {resolveLabel(t, item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user + sign out */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-bold">
            {(user?.name || "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{user?.name || "Admin"}</p>
            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {user?.role ?? "—"}
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = loginHref({ port: "operator" });
            }}
            aria-label="Sign out"
            className="h-8 w-8 shrink-0 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}