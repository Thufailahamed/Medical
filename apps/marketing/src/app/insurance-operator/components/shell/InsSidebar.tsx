"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  LogOut,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { INS_NAV_GROUPS } from "./ins-nav";
import { useInsuranceOperatorAuthStore } from "../../stores/auth";
import { useInsuranceOperatorClaims } from "../../hooks/useApi";
import { loginHref } from "@/portal/lib/login";
import { cn } from "@/portal/lib/utils";

export function InsSidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, clearAuth } = useInsuranceOperatorAuthStore();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Live pending-claims count — shares the claims page cache entry.
  const { data: pendingClaims } = useInsuranceOperatorClaims("submitted");
  const pendingCount = pendingClaims?.claims?.length ?? 0;

  const badges: Record<string, { count: number; tone: "amber" | "sky" | "rose" }> = {
    "/insurance-operator/claims": { count: pendingCount, tone: "amber" },
  };

  const term = filter.trim().toLowerCase();

  const visibleGroups = INS_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !term || item.label.toLowerCase().includes(term),
    ),
  })).filter((group) => group.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="relative hidden w-[264px] shrink-0 flex-col overflow-hidden text-slate-300 md:flex [&_a:hover]:no-underline"
      style={{
        background:
          "radial-gradient(420px 300px at 0% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(360px 280px at 100% 100%, rgba(99,102,241,0.12), transparent 60%), #061b2e",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
      }}
      aria-label="Insurance operator navigation"
    >
      {/* Brand */}
      <div className="relative flex h-[64px] shrink-0 items-center gap-3 px-5">
        <div className="relative grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_6px_18px_-4px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/20">
          <ShieldCheck size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-none tracking-[-0.01em] text-white">HealthHub</p>
          <p className="mt-1.5 font-mono text-[9.5px] font-semibold uppercase leading-none tracking-[0.18em] text-sky-300/90">
            Insurer console
          </p>
        </div>
        {pendingCount > 0 ? (
          <Link
            href="/insurance-operator/claims?status=submitted"
            title={`${pendingCount} claims awaiting review`}
            className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-amber-400/15 px-1.5 text-[10.5px] font-bold tabular-nums text-amber-200 ring-1 ring-inset ring-amber-300/30"
          >
            {pendingCount}
          </Link>
        ) : null}
        <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" aria-hidden />
      </div>

      {/* Organisation context */}
      <div className="px-3 pt-3">
        <div className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.05]">
          <div className="grid h-8 w-8 shrink-0 place-content-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400">
            <Building2 size={15} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-slate-200 transition-colors group-hover:text-white">
              {user?.name || "Insurance operator"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
              </span>
              <span className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-sky-400/90">
                Verified insurer
              </span>
            </div>
          </div>
        </div>
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
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {visibleGroups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">No pages match “{filter}”.</p>
        ) : null}
        {visibleGroups.map((group) => {
          const groupHasActive = group.items.some((i) => isActive(i.href));
          const groupCount = group.items.reduce((acc, i) => acc + (badges[i.href]?.count ?? 0), 0);
          const open = term !== "" || groupHasActive || !collapsed[group.label];
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !c[group.label] }))}
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

        {/* Compliance card */}
        <div className="mt-1 rounded-xl border border-sky-500/15 bg-gradient-to-br from-sky-950/40 to-slate-900/40 p-3">
          <div className="flex items-center gap-1.5 text-sky-400">
            <ShieldCheck size={14} strokeWidth={2.2} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wide">IRCSL Registered</span>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
            Claims decisions are audit-logged and visible to the policyholder in real time.
          </p>
        </div>
      </nav>

      {/* Footer: user + sign out */}
      <div className="shrink-0 p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5">
          <div className="relative shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-semibold text-white ring-2 ring-white/10">
              {(user?.name || "I").slice(0, 1).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#061b2e] bg-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.name || "Operator"}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              {(user?.role ?? "insurance operator").replace(/_/g, " ")}
            </p>
          </div>
          <button
            onClick={() => {
              clearAuth();
              router.push(loginHref({ port: "operator" }));
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
