"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  LogOut,
  Settings as SettingsIcon,
  Bell,
  Command,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { Avatar } from "@/portal/components/ui/Avatar";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { TenantSwitcher } from "./TenantSwitcher";
import { logout } from "@/portal/lib/auth";
import { api, qk } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";
import { usePortalPageMeta, topbarShowsPageTitle } from "@/portal/lib/page-meta";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const pageMeta = usePortalPageMeta(pathname);
  const showPageTitle = topbarShowsPageTitle(pathname) && pageMeta;
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Unread notifications — polled at 60s; lightweight and avoids
  // re-hydrating the persisted UI store with server-derived counts.
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: qk.unreadCount,
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unreadCount = unread?.count ?? 0;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        searchRef.current?.blur();
        setSearchFocused(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/portal/patients?q=${encodeURIComponent(q)}`);
  }

  async function onLogout() {
    await logout();
    router.replace("/portal/login");
  }

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  return (
    <header
      className={cn(
        "portal-topbar shrink-0 min-h-[var(--topbar-h,64px)] h-[var(--topbar-h,64px)] flex items-center gap-3 md:gap-4 px-4 md:px-6 lg:px-8 transition-shadow duration-300",
        "bg-white border-b border-border shadow-sm",
        searchFocused && "shadow-md"
      )}
    >
      {showPageTitle ? (
        <div className="flex items-center gap-2.5 shrink-0 min-w-0 max-w-[min(220px,28vw)]">
          <div className="h-9 w-9 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
            {pageMeta.icon}
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-bold text-text truncate leading-tight">
              {pageMeta.title}
            </h1>
            {pageMeta.subtitle ? (
              <p className="text-[11px] text-text-muted truncate leading-tight mt-0.5">
                {pageMeta.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <form onSubmit={onSubmitSearch} className="flex-1 min-w-0 max-w-xl">
        <div
          className={cn(
            "portal-input-search-wrap rounded-xl transition-all duration-200",
            searchFocused
              ? "ring-2 ring-brand/20 border-brand/40 bg-white shadow-sm"
              : "border-border/80 bg-surface-2/50 hover:bg-surface-2/80 hover:border-border",
            "border"
          )}
        >
          <Search
            size={15}
            className={cn(
              "portal-input-search-icon",
              searchFocused ? "text-brand" : "text-text-muted"
            )}
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search patients, NIC, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              "portal-input portal-input-icon-left h-10 !border-0 !bg-transparent",
              "!shadow-none focus:!shadow-none focus:!border-transparent",
              search ? "portal-input-clearable pr-10" : "pr-20"
            )}
            aria-label="Search"
          />

          {/* ⌘K hint */}
          {!searchFocused && !search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-[1]">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-surface border border-border text-[10px] font-semibold text-text-muted leading-none">
                <Command size={10} />K
              </kbd>
            </div>
          )}

          {/* Clear button */}
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              className="portal-input-clear-btn"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      </form>

      {/* ── Right section ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <LocaleSwitcher />
        <TenantSwitcher />

        {/* Notifications */}
        <Link
          href="/portal/notifications"
          className="relative h-10 w-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2/60 border border-transparent hover:border-border/40 transition-all duration-200"
          aria-label={t("notifications.bell.aria")}
          title={
            unreadCount > 0
              ? t("notifications.bell.unread", { count: unreadCount })
              : t("shell.noUnread")
          }
        >
          <Bell size={17} strokeWidth={1.8} />
          {unreadCount > 0 ? (
            <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white inline-flex items-center justify-center border-[1.5px] border-surface">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>

        {/* Separator */}
        <div className="h-5 w-px bg-border mx-1 hidden md:block" />

        {/* ── User menu ───────────────────────────────────────────────────── */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-xl transition-all duration-200 border border-transparent",
              menuOpen
                ? "bg-surface-2 border-border shadow-sm"
                : "hover:bg-surface-2/60 hover:border-border/40"
            )}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {/* Avatar with online dot */}
            <div className="relative">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                style={{
                  background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                }}
              >
                {initials}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                style={{
                  background: "linear-gradient(135deg, #34D399, #10B981)",
                  boxShadow: "0 0 6px rgba(52,211,153,0.5)",
                }}
              />
            </div>

            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-semibold text-text truncate max-w-[140px]">
                {user?.name ?? "Doctor"}
              </span>
              <span className="text-[10px] text-text-muted capitalize font-medium">
                {user?.role ?? "doctor"}
              </span>
            </div>

            <ChevronDown
              size={13}
              className={cn(
                "hidden sm:block text-text-muted transition-transform duration-200",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          {/* ── Dropdown ───────────────────────────────────────────────────── */}
          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-border/80 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] z-30 overflow-hidden animate-in">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-border/60" style={{
                background: "linear-gradient(135deg, rgba(14,165,233,0.04) 0%, rgba(2,132,199,0.02) 100%)",
              }}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                      boxShadow: "0 4px 12px rgba(14,165,233,0.25)",
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-text truncate">
                      {user?.name ?? "Doctor"}
                    </div>
                    <div className="text-[11px] text-text-muted truncate mt-0.5">
                      {user?.email ?? user?.phone ?? ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <Link
                  href="/portal/settings"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-surface-2/60 flex items-center gap-2.5 transition-colors group"
                >
                  <span className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center group-hover:bg-sky-50 transition-colors">
                    <SettingsIcon size={14} className="text-text-muted group-hover:text-sky-600 transition-colors" />
                  </span>
                  <span className="text-text">Settings</span>
                </Link>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium hover:bg-red-50/60 flex items-center gap-2.5 transition-colors group"
                >
                  <span className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center group-hover:bg-red-50 transition-colors">
                    <LogOut size={14} className="text-text-muted group-hover:text-red-500 transition-colors" />
                  </span>
                  <span className="text-red-600">Sign out</span>
                </button>
              </div>

              {/* Footer branding */}
              <div className="px-4 py-2.5 border-t border-border/60 flex items-center gap-1.5" style={{
                background: "rgba(248,250,252,0.6)",
              }}>
                <Sparkles size={10} className="text-sky-400" />
                <span className="text-[10px] font-semibold text-text-muted tracking-wide">HEALTHHUB</span>
                <span className="text-[10px] text-text-muted/60">· Doctor Portal</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
