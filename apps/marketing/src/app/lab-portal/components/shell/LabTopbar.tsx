"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CornerDownLeft,
  FlaskConical,
  Inbox,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { LAB_NAV_GROUPS, findNavItem } from "./lab-nav";
import { useLabAuthStore, getLabSessionUser } from "../../stores/auth";
import { useLabBookings } from "../../hooks/useApi";
import { api } from "../../lib/api";
import { loginHref } from "@/portal/lib/login";
import { relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
};

/** Close a popover when clicking outside it or pressing Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function LabTopbar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, clearAuth } = useLabAuthStore();
  const displayUser = user ?? getLabSessionUser();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingBookings } = useLabBookings("pending");
  const pending = pendingBookings?.total ?? pendingBookings?.bookings?.length ?? 0;

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
    retry: false,
  });
  const unreadCount = unread?.count ?? 0;

  const { data: notes } = useQuery({
    queryKey: ["notifications", "me"],
    queryFn: () => api<{ notifications: Notification[] }>("/notifications/me"),
    enabled: bellOpen,
    retry: false,
  });

  // ⌘K / Ctrl+K opens the jump palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const userRef = useDismiss(userOpen, () => setUserOpen(false));

  const match = findNavItem(pathname);
  const groupLabel = match?.group.label ?? null;
  const pageLabel = match?.item.label ?? null;
  const PageIcon = match?.item.icon;

  const visibleGroups = useMemo(() => LAB_NAV_GROUPS, []);

  const signOut = () => {
    clearAuth();
    window.location.href = loginHref({ port: "facility" });
  };

  const initial = (displayUser?.name || "L").slice(0, 1).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b border-slate-900/[0.06] bg-white/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65 md:px-6 [&_a:hover]:no-underline">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            href="/lab-portal/dashboard"
            className="hidden items-center gap-1.5 rounded-lg px-1.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-emerald-700 sm:inline-flex"
          >
            <FlaskConical size={13} className="text-emerald-600" aria-hidden />
            Lab
          </Link>
          {groupLabel ? (
            <>
              <ChevronRight size={13} className="hidden shrink-0 text-slate-300 sm:block" aria-hidden />
              <span className="hidden font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:inline">
                {groupLabel}
              </span>
              <ChevronRight size={13} className="hidden shrink-0 text-slate-300 lg:block" aria-hidden />
            </>
          ) : null}
          {pageLabel && match ? (
            match.isDetail ? (
              <>
                <Link
                  href={match.item.href}
                  className="inline-flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {PageIcon ? <PageIcon size={14} className="shrink-0 text-slate-400" /> : null}
                  <span className="truncate">{pageLabel}</span>
                </Link>
                <ChevronRight size={13} className="shrink-0 text-slate-300" aria-hidden />
                <span className="truncate font-semibold text-slate-900" aria-current="page">
                  Details
                </span>
              </>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-2 px-1.5 font-semibold text-slate-900" aria-current="page">
                {PageIcon ? (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600">
                    <PageIcon size={14} />
                  </span>
                ) : null}
                <span className="truncate">{pageLabel}</span>
              </span>
            )
          ) : null}
        </nav>

        <div className="flex-1" />

        {/* Jump / search trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group hidden h-9 w-64 items-center gap-2 rounded-xl bg-slate-100/80 px-3 text-left text-[13px] text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)] transition-all hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] md:flex lg:w-72"
        >
          <Search size={14} className="shrink-0" aria-hidden />
          <span className="flex-1 truncate">Jump to a page…</span>
          <kbd className="rounded-md bg-white px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Jump to a page"
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 md:hidden"
        >
          <Search size={17} />
        </button>

        {/* Pending bookings shortcut */}
        {pending > 0 ? (
          <Link
            href="/lab-portal/bookings?status=pending"
            className="hidden h-9 items-center gap-2 rounded-xl bg-amber-50 px-3 text-xs font-semibold text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)] transition-colors hover:bg-amber-100 lg:inline-flex"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            {pending} pending
          </Link>
        ) : null}

        {/* Notifications */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => {
              setBellOpen((o) => !o);
              setUserOpen(false);
            }}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={bellOpen}
            className={cn(
              "relative grid h-9 w-9 place-items-center rounded-xl transition-all",
              bellOpen ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Bell size={17} />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          {bellOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35),inset_0_0_0_1px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                {unreadCount ? (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{unreadCount} unread</span>
                ) : (
                  <span className="text-[11px] text-slate-400">All caught up</span>
                )}
              </div>
              <ul className="max-h-[340px] overflow-y-auto px-2 pb-2">
                {!notes ? (
                  [0, 1, 2].map((i) => <li key={i} className="mx-2 my-1.5 h-12 animate-pulse rounded-xl bg-slate-100" />)
                ) : notes.notifications.length === 0 ? (
                  <li className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <Inbox size={20} className="text-slate-300" />
                    <span className="text-xs text-slate-400">No notifications yet</span>
                  </li>
                ) : (
                  notes.notifications.slice(0, 6).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setBellOpen(false);
                          router.push("/lab-portal/bookings");
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50",
                          !n.read && "bg-emerald-50/50",
                        )}
                      >
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-slate-200" : "bg-emerald-500")} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[13px]", n.read ? "text-slate-600" : "font-semibold text-slate-900")}>{n.title}</span>
                          {n.body ? <span className="mt-0.5 line-clamp-1 block text-xs text-slate-400">{n.body}</span> : null}
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-slate-400">{relativeTime(n.createdAt)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/lab-portal/bookings"
                onClick={() => setBellOpen(false)}
                className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Open bookings queue
                <ArrowRight size={13} />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Account */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => {
              setUserOpen((o) => !o);
              setBellOpen(false);
            }}
            aria-expanded={userOpen}
            aria-label="Account menu"
            className="flex h-9 items-center gap-2 rounded-xl pl-1 pr-2 transition-colors hover:bg-slate-100"
          >
            <span className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-xs font-semibold text-white">
              {initial}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden />
            </span>
            <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-slate-800 xl:block">{displayUser?.name ?? "Lab"}</span>
            <ChevronDown size={14} className={cn("hidden text-slate-400 transition-transform sm:block", userOpen && "rotate-180")} />
          </button>
          {userOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35),inset_0_0_0_1px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-sm font-semibold text-white">{initial}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-900">{displayUser?.name ?? "Lab Admin"}</span>
                  <span className="block truncate text-[11px] text-slate-400">{displayUser?.email ?? ""}</span>
                  <span className="mt-1 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                    {(displayUser?.role ?? "facility staff").replace(/_/g, " ")}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-col">
                <MenuLink href="/lab-portal/bookings?status=pending" icon={<ClipboardList size={15} />} onClick={() => setUserOpen(false)}>
                  Pending bookings
                  {pending ? <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pending}</span> : null}
                </MenuLink>
                <MenuLink href="/lab-portal/catalog" icon={<FlaskConical size={15} />} onClick={() => setUserOpen(false)}>
                  Test catalog
                </MenuLink>
              </div>
              <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {paletteOpen ? (
        <JumpPalette
          pending={pending}
          onClose={() => setPaletteOpen(false)}
          onGo={(href) => {
            setPaletteOpen(false);
            router.push(href);
          }}
        />
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col overflow-y-auto bg-[#07190f] p-4 text-slate-300 [&_a:hover]:no-underline">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                  <FlaskConical size={18} />
                </span>
                <span className="text-sm font-semibold text-white">HealthHub lab</span>
              </span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            {visibleGroups.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{g.label}</p>
                {g.items.map((i) => {
                  const Icon = i.icon;
                  const active = pathname === i.href || pathname.startsWith(i.href + "/");
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-lg px-2 text-[13px]",
                        active ? "bg-emerald-400/15 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon size={16} className={active ? "text-emerald-300" : "text-slate-500"} />
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      <span className="text-slate-400">{icon}</span>
      {children}
    </Link>
  );
}

/** ⌘K jump-to-page palette over the lab nav. */
function JumpPalette({
  pending,
  onClose,
  onGo,
}: {
  pending: number;
  onClose: () => void;
  onGo: (href: string) => void;
}) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const term = q.trim().toLowerCase();
  const results = LAB_NAV_GROUPS.flatMap((g) =>
    g.items
      .filter((i) => !term || i.label.toLowerCase().includes(term) || g.label.toLowerCase().includes(term))
      .map((i) => ({ ...i, group: g.label })),
  );
  const safeIndex = Math.min(index, Math.max(0, results.length - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Jump to a page">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-[0_40px_100px_-30px_rgba(15,23,42,0.6),inset_0_0_0_1px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={17} className="shrink-0 text-slate-400" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[safeIndex]) {
                onGo(results[safeIndex].href);
              } else if (e.key === "Enter" && term) {
                onGo(`/lab-portal/bookings?q=${encodeURIComponent(term)}`);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Jump to a page, or search bookings…"
            aria-label="Search pages"
            className="h-14 flex-1 border-0 bg-transparent text-[15px] text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:shadow-none focus:outline-none focus:ring-0"
          />
          <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-400">Esc</kbd>
        </div>

        {pending > 0 && !term ? (
          <button
            type="button"
            onClick={() => onGo("/lab-portal/bookings?status=pending")}
            className="mx-2 mt-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-left text-[13px] font-semibold text-amber-900 transition-colors hover:bg-amber-100"
          >
            <ClipboardList size={15} className="text-amber-600" />
            Review {pending} pending booking{pending === 1 ? "" : "s"}
            <ArrowRight size={14} className="ml-auto text-amber-600" />
          </button>
        ) : null}

        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {term && results.length === 0 ? (
            <li>
              <button
                type="button"
                onClick={() => onGo(`/lab-portal/bookings?q=${encodeURIComponent(term)}`)}
                className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-left transition-colors hover:bg-emerald-100"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                  <Search size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-emerald-900">Search bookings for “{q}”</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-600/70">Requisition lookup</span>
                </span>
              </button>
            </li>
          ) : null}
          {results.map((r, i) => {
            const Icon = r.icon;
            const on = i === safeIndex;
            return (
              <li key={r.href}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onGo(r.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    on ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13.5px] font-medium", on ? "text-emerald-900" : "text-slate-800")}>{r.label}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{r.group}</span>
                  </span>
                  {on ? <CornerDownLeft size={14} className="shrink-0 text-emerald-500" /> : null}
                </button>
              </li>
            );
          })}
          {results.length === 0 && !term ? (
            <li className="px-4 py-10 text-center text-sm text-slate-400">No pages available.</li>
          ) : null}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
          <span><kbd className="font-sans font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans font-semibold">↵</kbd> open</span>
          <span className="ml-auto">{results.length} page{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
