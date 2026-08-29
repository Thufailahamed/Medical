"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  HeartPulse,
  Home,
  LogOut,
  Moon,
  Search,
  ScrollText,
  ShieldCheck,
  Sun,
  Sunrise,
} from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
import { logout } from "@/portal/lib/auth";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";
import { useActiveFamilyMember } from "@/patient/hooks/useActiveFamilyMember";
import { useMedicationStats, useWellness } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

import { ActiveMemberPill } from "./ActiveMemberPill";

type TopLink = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Tiny description shown on hover / on mobile sheets. */
  hint?: string;
};

const TOP_LINKS: TopLink[] = [
  { href: "/patient", label: "Dashboard", icon: Home, hint: "Today's overview" },
  { href: "/patient/health", label: "Health", icon: HeartPulse, hint: "Vitals & trends" },
  { href: "/patient/records", label: "Reports", icon: ScrollText, hint: "Records & labs" },
];

function timeGreeting(now = new Date()): {
  text: string;
  Icon: typeof Sun;
  // Subtle context used in the meta line — friendly, not over-cute.
  vibe: string;
} {
  const hour = now.getHours();
  if (hour < 5) return { text: "Up late", Icon: Moon, vibe: "Rest well" };
  if (hour < 12) return { text: "Good morning", Icon: Sunrise, vibe: "Fresh start" };
  if (hour < 17) return { text: "Good afternoon", Icon: Sun, vibe: "Stay hydrated" };
  if (hour < 21) return { text: "Good evening", Icon: Sun, vibe: "Wind down gently" };
  return { text: "Good night", Icon: Moon, vibe: "Rest well" };
}

function formatLongDate(now: Date) {
  return now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Patient topbar — greeting + section nav + identity / actions.
 *
 * Composed in three zones inside a floating plate:
 *  1. Greeting block: time-aware greeting, day context, wellness chip
 *  2. Section pill nav with icons and active-state shine
 *  3. Quick actions: search, notifications (with pulsing dot), profile
 *     chip, logout
 *
 * Sticky inside the main column so the nav stays visible while the
 * dashboard cards scroll. Honours `prefers-reduced-motion` via the
 * shared `anim-rise` class.
 */
export function Topbar({ user }: { user: AuthUser | null }) {
  const firstName = user?.name?.split(" ")[0] ?? null;
  const initialsSource = user?.name?.trim() || null;
  const unread = useUnreadNotificationsCount();
  const wellness = useWellness();
  const medicationStats = useMedicationStats(7);
  // Hydrate the active-FM store from the server column on every mount.
  useActiveFamilyMember();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const now = new Date();
  const greeting = timeGreeting(now);
  const greetingLine = firstName
    ? `${greeting.text}, ${firstName}`
    : greeting.text;
  const today = formatLongDate(now);
  const fullName = user?.name?.trim() || "Patient";
  const showName = firstName ?? (user?.name ?? "Patient");

  async function onLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace("/patient/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header
      className="anim-rise sticky top-3 z-30 overflow-hidden"
      style={{
        borderRadius: "var(--radius-card)",
        background:
          "linear-gradient(120deg, rgba(255,255,255,0.95) 0%, rgba(244,247,255,0.92) 60%, rgba(232,239,255,0.92) 100%)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--color-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Decorative gradient orb — softens the right edge and gives the
          bar a brand-tinted glow without adding visual weight. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,111,245,0.22), rgba(59,111,245,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,108,255,0.16), rgba(124,108,255,0) 70%)",
        }}
      />

      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5 sm:py-3.5">
        {/* ── Zone 1: Greeting block ─────────────────────────────── */}
        <div className="flex min-w-0 flex-1 items-center gap-3 basis-[16rem]">
          <span
            aria-hidden
            className="hidden h-11 w-11 shrink-0 place-items-center sm:grid"
            style={{
              borderRadius: "var(--radius-inner)",
              background:
                "linear-gradient(145deg, var(--color-brand-soft) 0%, rgba(124,108,255,0.18) 100%)",
              color: "var(--color-brand-strong)",
              boxShadow: "inset 0 0 0 1px rgba(59,111,245,0.18)",
            }}
          >
            <greeting.Icon size={20} strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight text-text sm:text-lg">
                {greetingLine}
              </h1>
              {user?.verified ? (
                <span
                  title="Verified patient"
                  aria-label="Verified patient"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-success"
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  <ShieldCheck size={15} strokeWidth={2.4} aria-hidden />
                </span>
              ) : null}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-text-soft">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} aria-hidden className="text-text-muted" />
                {today}
              </span>
              {greeting.vibe ? (
                <>
                  <span aria-hidden className="text-text-muted">·</span>
                  <span>{greeting.vibe}</span>
                </>
              ) : null}
              <span aria-hidden className="text-text-muted">·</span>
               <WellnessChip streak={medicationStats.data?.streakDays} score={wellness.data?.score} />
            </div>
          </div>
        </div>

        {/* ── Zone 2: Section nav ────────────────────────────────── */}
        <nav
          aria-label="Sections"
          className="order-3 mx-auto flex w-full max-w-md items-center gap-0.5 bg-surface/80 p-1 sm:order-none sm:mx-0 sm:w-auto sm:max-w-none"
          style={{
            borderRadius: "var(--radius-pill)",
            boxShadow: "inset 0 0 0 1px var(--color-border)",
            backdropFilter: "blur(6px)",
          }}
        >
          {TOP_LINKS.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/patient"
                ? pathname === "/patient"
                : pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.hint}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-all",
                  active
                    ? "text-white"
                    : "text-text-soft hover:text-brand"
                )}
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
                        boxShadow:
                          "0 6px 14px -6px rgba(59,111,245,0.55), inset 0 0 0 1px rgba(255,255,255,0.18)",
                      }
                    : undefined
                }
              >
                <Icon
                  size={15}
                  strokeWidth={active ? 2.2 : 1.9}
                  aria-hidden
                  className={cn(
                    "transition-transform",
                    !active && "group-hover:-translate-y-px"
                  )}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Zone 3: Quick actions ──────────────────────────────── */}
        <div className="flex flex-1 basis-[16rem] items-center justify-end gap-1.5">
          <ActiveMemberPill />
          <IconAction
            href="/patient/records?focus=search"
            label="Search records"
            icon={<Search size={17} aria-hidden />}
          />

          <Link
            href="/patient/notifications"
            aria-label={
              unread > 0
                ? `Notifications, ${unread} unread`
                : "Notifications"
            }
            className="group relative grid h-10 w-10 place-items-center text-text-soft transition-colors hover:bg-brand-soft hover:text-brand"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            <Bell size={18} aria-hidden />
            {unread > 0 ? (
              <>
                <span
                  aria-hidden
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger"
                  style={{ boxShadow: "0 0 0 4px rgba(224,70,75,0.18)" }}
                >
                  <span className="absolute inset-0 anim-pulse-soft rounded-full bg-danger" />
                </span>
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center bg-danger px-1 text-[10px] font-bold text-white"
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              </>
            ) : null}
          </Link>

          <ProfileChip
            user={user}
            fullName={fullName}
            showName={showName}
            initialsSource={initialsSource}
            menuOpen={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            onClose={() => setMenuOpen(false)}
            onLogout={onLogout}
            signingOut={signingOut}
          />
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────── */

function IconAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="hidden h-10 w-10 place-items-center text-text-soft transition-colors hover:bg-brand-soft hover:text-brand sm:grid"
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      {icon}
    </Link>
  );
}

function WellnessChip({ streak, score }: { streak?: number; score?: number }) {
  if (streak == null && score == null) return null;
  const label = streak != null ? `${streak}-day adherence` : `Wellness ${score}`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-[2px] text-[10.5px] font-semibold text-success"
      title={label}
    >
      <HeartPulse size={11} aria-hidden />
      {label}
    </span>
  );
}

function ProfileChip({
  user,
  fullName,
  showName,
  initialsSource,
  menuOpen,
  onToggle,
  onClose,
  onLogout,
  signingOut,
}: {
  user: AuthUser | null;
  fullName: string;
  showName: string;
  initialsSource: string | null;
  menuOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Open account menu"
        className={cn(
          "group flex items-center gap-2 pl-1 pr-2.5 py-1 text-left transition-colors hover:bg-surface-2",
          menuOpen && "bg-surface-2"
        )}
        style={{ borderRadius: "var(--radius-pill)" }}
      >
        <Avatar user={user} initialsSource={initialsSource} />
        <span className="hidden min-w-0 leading-tight md:flex md:flex-col">
          <span className="truncate text-[12.5px] font-semibold text-text">
            {showName}
          </span>
          <span className="truncate text-[10.5px] font-medium text-text-muted">
            Patient
          </span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "hidden text-text-muted transition-transform md:block",
            menuOpen && "rotate-180"
          )}
        />
      </button>

      {menuOpen ? (
        <>
          {/* Click-away layer */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="fixed inset-0 z-20 cursor-default"
            tabIndex={-1}
          />
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 overflow-hidden bg-surface"
            style={{
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-float)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="px-4 py-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,111,245,0.10) 0%, rgba(124,108,255,0.10) 100%)",
              }}
            >
              <p className="truncate text-sm font-bold text-text">{fullName}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-text-soft">
                {user?.email ?? user?.phone ?? "Patient account"}
              </p>
            </div>

            <div className="p-1.5">
              <MenuItem href="/patient/profile" label="Profile" />
              <MenuItem href="/patient/appointments" label="Appointments" />
              <MenuItem href="/patient/messages" label="Messages" />
              <MenuItem href="/patient/insurance" label="Insurance" />
              <MenuItem href="/patient/imaging" label="Imaging" />
              <MenuItem href="/patient/share" label="Share access" />
              <MenuItem href="/patient/export" label="Export my data" />
              <MenuItem href="/patient/audit" label="Activity and audit" />
              <MenuItem href="/patient/family" label="Family" />
              <MenuItem href="/patient/care-team" label="Care team" />
              <MenuItem href="/patient/emergency" label="Emergency profile" />
              <div
                className="my-1 border-t"
                style={{ borderColor: "var(--color-border)" }}
              />
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={signingOut}
                data-testid="logout-button"
                className="flex w-full items-center gap-2.5 rounded-inner px-3 py-2 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
              >
                <LogOut size={15} aria-hidden />
                {signingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="block rounded-inner px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2 hover:text-brand"
    >
      {label}
    </Link>
  );
}

function Avatar({
  user,
  initialsSource,
}: {
  user: AuthUser | null;
  initialsSource: string | null;
}) {
  const initials = initialsSource
    ? initialsSource
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  // Online dot: shows the user is signed in.
  const online = Boolean(user);

  if (user?.photo) {
    return (
      <span className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.photo}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-cover ring-2 ring-white"
          style={{ borderRadius: "var(--radius-pill)" }}
        />
        {online ? <OnlineDot /> : null}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center text-sm font-bold text-white"
        style={{
          borderRadius: "var(--radius-pill)",
          background:
            "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
          boxShadow: "0 4px 10px -3px rgba(59,111,245,0.5), inset 0 0 0 1px rgba(255,255,255,0.18)",
        }}
      >
        {initials}
      </span>
      {online ? <OnlineDot /> : null}
    </span>
  );
}

function OnlineDot() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white"
    />
  );
}
