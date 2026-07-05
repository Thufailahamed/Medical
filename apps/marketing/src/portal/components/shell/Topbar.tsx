"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, LogOut, Settings as SettingsIcon } from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { Avatar } from "@/portal/components/ui/Avatar";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { TenantSwitcher } from "./TenantSwitcher";
import { logout } from "@/portal/lib/auth";
import { cn } from "@/portal/lib/utils";

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/patients?q=${encodeURIComponent(q)}`);
  }

  async function onLogout() {
    await logout();
    router.replace("/portal/login");
  }

  return (
    <header
      className={cn(
        "h-[var(--topbar-h)] bg-surface border-b border-border sticky top-0 z-20 px-4 flex items-center gap-3"
      )}
    >
      <form onSubmit={onSubmitSearch} className="flex-1 max-w-xl relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search patients, NIC, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-9 pr-3 rounded-md border border-border bg-surface-2/40 text-sm text-text placeholder:text-text-muted focus-ring focus:border-brand focus:bg-surface"
          aria-label="Search"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <TenantSwitcher />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 h-8 pl-1.5 pr-2 rounded-md hover:bg-surface-2 focus-ring"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <Avatar name={user?.name} size="sm" />
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs font-medium text-text truncate max-w-[140px]">
                {user?.name ?? "Doctor"}
              </span>
              <span className="text-[10px] text-text-muted capitalize">
                {user?.role ?? "doctor"}
              </span>
            </div>
          </button>

          {open ? (
            <div className="absolute right-0 mt-1 w-56 rounded-md border border-border bg-surface shadow-[var(--shadow-md)] z-30 overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-medium text-text truncate">
                  {user?.name ?? "Doctor"}
                </div>
                <div className="text-[11px] text-text-soft truncate">
                  {user?.email ?? user?.phone ?? ""}
                </div>
              </div>
              <Link
                href="/portal/settings"
                onClick={() => setOpen(false)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 flex items-center gap-2"
              >
                <SettingsIcon size={14} /> Settings
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 flex items-center gap-2 text-danger"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}