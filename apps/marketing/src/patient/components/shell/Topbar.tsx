"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  HeartPulse,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
import { useUiStore } from "@/portal/stores/ui";
import { logout } from "@/portal/lib/auth";
import { loginHref } from "@/portal/lib/login";
import { useUnreadNotificationsCount } from "@/patient/hooks/useNotifications";
import { useActiveFamilyMember } from "@/patient/hooks/useActiveFamilyMember";
import { useMedicationStats, useWellness } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

import { ActiveMemberPill } from "./ActiveMemberPill";

/** Longest-prefix match against known patient routes → page title. */
const PAGE_TITLES: { match: string; title: string; subtitle?: string }[] = [
  { match: "/patient/settings", title: "Settings", subtitle: "Account & security" },
  { match: "/patient/profile", title: "Profile", subtitle: "Your details" },
  { match: "/patient/notifications", title: "Notifications", subtitle: "Inbox" },
  { match: "/patient/health", title: "My Health", subtitle: "Vitals & trends" },
  { match: "/patient/appointments", title: "Appointments", subtitle: "Visits & bookings" },
  { match: "/patient/medications", title: "Medications", subtitle: "Doses & refills" },
  { match: "/patient/prescriptions", title: "Prescriptions", subtitle: "Active scripts" },
  { match: "/patient/care-team", title: "Care Team", subtitle: "Your clinicians" },
  { match: "/patient/ai", title: "AI Assistant", subtitle: "Grounded in your record" },
  { match: "/patient/records", title: "Medical Records", subtitle: "Files & reports" },
  { match: "/patient/diagnostic-tests", title: "Lab Tests", subtitle: "Orders & results" },
  { match: "/patient/imaging", title: "Imaging", subtitle: "Scans & studies" },
  { match: "/patient/vaccinations", title: "Vaccinations", subtitle: "Immunisation record" },
  { match: "/patient/allergies", title: "Allergies", subtitle: "Known reactions" },
  { match: "/patient/family", title: "Family", subtitle: "Linked members" },
  { match: "/patient/caretakers", title: "Caretakers", subtitle: "Access sharing" },
  { match: "/patient/emergency", title: "Emergency Card", subtitle: "Critical info" },
  { match: "/patient/health-id", title: "Health ID", subtitle: "QR identity" },
  { match: "/patient/insurance", title: "Insurance", subtitle: "Cover & claims" },
  { match: "/patient/export", title: "Export", subtitle: "Download your data" },
  { match: "/patient/consents", title: "Consents", subtitle: "Sharing permissions" },
  { match: "/patient/dsar", title: "Data requests", subtitle: "Privacy rights" },
  { match: "/patient", title: "Dashboard", subtitle: "Today at a glance" },
];

function pageMeta(pathname: string) {
  const hit = PAGE_TITLES.find(
    (p) => pathname === p.match || pathname.startsWith(`${p.match}/`),
  );
  return hit ?? { title: "HealthHub", subtitle: "Patient portal" };
}

function formatLongDate(now: Date) {
  return now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Patient chrome topbar — page context + utilities only.
 *
 * Greeting lives on the dashboard hero so we do not double-say
 * "Good night" / "Good evening". Section links live in the sidebar.
 */
export function Topbar({ user }: { user: AuthUser | null }) {
  const firstName = user?.name?.split(" ")[0] ?? null;
  const initialsSource = user?.name?.trim() || null;
  const unread = useUnreadNotificationsCount();
  const wellness = useWellness();
  const medicationStats = useMedicationStats(7);
  useActiveFamilyMember();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav);

  const today = formatLongDate(new Date());
  const fullName = user?.name?.trim() || "Patient";
  const showName = firstName ?? (user?.name ?? "Patient");
  const page = pageMeta(pathname);

  async function onLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      router.replace(loginHref({ port: "patient" }));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header
      className="z-30 flex h-16 shrink-0 items-center border-b border-ink/10 bg-surface/90 px-4 backdrop-blur-md transition-shadow md:px-8"
      data-testid="patient-topbar"
    >
      <div className="relative z-10 flex items-center justify-between w-full gap-3 sm:gap-4">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={toggleMobileNav}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-text-soft transition-colors hover:bg-ink/5 hover:text-text lg:hidden"
        >
          <Menu size={19} aria-hidden />
        </button>

        {/* Page context */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-extrabold tracking-tight text-text sm:text-base">
            {page.title}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-text-soft">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted">
              <CalendarDays size={11} aria-hidden />
              {today}
            </span>
            {page.subtitle ? (
              <>
                <span aria-hidden className="text-text-muted">
                  ·
                </span>
                <span className="truncate">{page.subtitle}</span>
              </>
            ) : null}
            <WellnessChip
              streak={medicationStats.data?.streakDays}
              score={wellness.data?.score}
            />
          </div>
        </div>

        {/* Utilities */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
            className="group relative grid h-10 w-10 place-items-center rounded-md text-text-soft transition-colors hover:bg-ink/5 hover:text-text"
          >
            <Bell size={18} aria-hidden />
            {unread > 0 ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-sm bg-brand px-1 font-mono text-[10px] font-semibold text-white"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <div
            className="mx-0.5 hidden h-6 w-px bg-ink/10 sm:block"
            aria-hidden
          />

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
      className="hidden h-10 w-10 place-items-center rounded-md text-text-soft transition-colors hover:bg-ink/5 hover:text-text sm:grid"
    >
      {icon}
    </Link>
  );
}

function WellnessChip({ streak, score }: { streak?: number; score?: number }) {
  if (streak == null && score == null) return null;
  const label =
    streak != null && streak > 0
      ? `${streak}-day adherence`
      : score != null
        ? `Wellness ${score}`
        : null;
  if (!label) return null;
  return (
    <>
      <span aria-hidden className="text-text-muted">
        ·
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-[2px] text-[10.5px] font-semibold text-success"
        title={label}
      >
        <HeartPulse size={11} aria-hidden />
        {label}
      </span>
    </>
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
          "group flex items-center gap-2 rounded-md py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-ink/5",
          menuOpen && "bg-ink/5",
        )}
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
            menuOpen && "rotate-180",
          )}
        />
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
          />
          <div
            role="menu"
            className="pt-floating absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden"
          >
            <div className="border-b border-ink/10 bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar user={user} initialsSource={initialsSource} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">
                    {fullName}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
                    {user?.email ?? user?.phone ?? "Patient account"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-1.5">
              <Link
                role="menuitem"
                href="/patient/profile"
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-ink/5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-text-soft">
                  <Settings size={14} />
                </span>
                <span>Profile & Settings</span>
              </Link>

              <div className="my-1 border-t border-ink/10" />

              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={signingOut}
                data-testid="logout-button"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-danger-soft text-danger">
                  <LogOut size={14} />
                </span>
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-t border-ink/10 bg-surface-2 px-3.5 py-2">
              <Sparkles size={10} className="text-brand" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                HealthHub
              </span>
              <span className="text-[10px] text-text-muted">· Patient Portal</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
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
          className="h-9 w-9 rounded-md object-cover shadow-[inset_0_0_0_1px_rgba(19,32,68,0.12)]"
        />
        {online ? <OnlineDot /> : null}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-md bg-ink font-mono text-xs font-bold text-sky-300"
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
      className="pt-dot absolute -bottom-0.5 -right-0.5 bg-success ring-2 ring-surface"
    />
  );
}
