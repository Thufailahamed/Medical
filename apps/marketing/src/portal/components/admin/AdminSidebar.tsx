"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, Activity } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-nav";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

function resolveLabel(t: (k: string) => string, key: string): string {
  // `admin.nav.<slug>` keys live under the `admin` namespace. The custom
  // i18n shim doesn't support `defaultValue`, so we fall back to the
  // last path segment when the key is missing.
  const direct = t(key);
  return direct === key ? (key.split(".").pop() ?? key) : direct;
}

export function AdminSidebar() {
  const pathname = usePathname() || "";
  const t = useT();
  const { user, logout } = useAuthStore();

  return (
    <aside
      className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-border bg-surface"
      aria-label="Admin navigation"
    >
      {/* Brand */}
      <div className="h-[60px] flex items-center gap-2.5 px-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-amber-600 text-white flex items-center justify-center">
          <ShieldCheck size={18} strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wider leading-none">HEALTHHUB</p>
          <p className="text-[10px] text-text-muted tracking-widest mt-0.5">ADMIN</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 mb-1.5 text-[10px] font-bold tracking-widest text-text-muted uppercase">
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
                      "flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-amber-50 text-amber-700 font-semibold"
                        : "text-text-soft hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    <Icon size={16} strokeWidth={2} className={active ? "text-amber-600" : "text-text-muted"} />
                    {resolveLabel(t, item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user + sign out */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
            {(user?.name || "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name || "Admin"}</p>
            <p className="text-[11px] text-text-muted truncate flex items-center gap-1">
              <Activity size={10} className="text-emerald-500" />
              super_admin
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.href = "/admin/login";
            }}
            aria-label="Sign out"
            className="h-8 w-8 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}