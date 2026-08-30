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
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import type { AuthUser } from "@/portal/stores/auth";
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
  { match: "/patient/ai", title: "AI Assistant", subtitle: "Ask with context" },
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
      className="shrink-0 min-h-[64px] h-[64px] flex items-center px-4 md:px-8 bg-white border-b border-border shadow-xs z-30 transition-shadow"
      data-testid="patient-topbar"
      style={{
        backgroundColor: "#ffffff",
      }}
    >
      <div className="relative z-10 flex items-center justify-between w-full gap-3 sm:gap-4">
        {/* Page context */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-text sm:text-base">
            {page.title}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-text-soft">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={11} aria-hidden className="text-text-muted" />
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
            className="group relative grid h-10 w-10 place-items-center text-text-soft transition-colors hover:bg-brand-soft hover:text-brand"
            style={{ borderRadius: "var(--radius-pill)" }}
          >
            <Bell size={18} aria-hidden />
            {unread > 0 ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center bg-danger px-1 text-[10px] font-bold text-white"
                style={{ borderRadius: "var(--radius-pill)" }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <div
            className="mx-0.5 hidden h-6 w-px bg-border sm:block"
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
      className="hidden h-10 w-10 place-items-center text-text-soft transition-colors hover:bg-brand-soft hover:text-brand sm:grid"
      style={{ borderRadius: "var(--radius-pill)" }}
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
        className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-[2px] text-[10.5px] font-semibold text-success"
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
          "group flex items-center gap-2 py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-surface-2",
          menuOpen && "bg-surface-2",
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
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{
              backgroundColor: "#ffffff",
              boxShadow:
                "0 20px 50px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(59, 111, 245, 0.15)",
            }}
          >
            <div
              className="border-b border-slate-100 px-4 py-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,111,245,0.06) 0%, rgba(124,108,255,0.04) 100%)",
              }}
            >
              <div className="flex items-center gap-3">
                <Avatar user={user} initialsSource={initialsSource} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {fullName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
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
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 hover:text-blue-600"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Settings size={14} />
                </span>
                <span>Profile & Settings</span>
              </Link>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                disabled={signingOut}
                data-testid="logout-button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <LogOut size={14} />
                </span>
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>

            <div
              className="flex items-center gap-1.5 border-t border-slate-100 px-3.5 py-2"
              style={{ background: "rgba(248,250,252,0.7)" }}
            >
              <Sparkles size={10} className="text-sky-500" />
              <span className="text-[10px] font-bold tracking-wide text-slate-500">
                HEALTHHUB
              </span>
              <span className="text-[10px] text-slate-400">· Patient Portal</span>
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
          boxShadow:
            "0 4px 10px -3px rgba(59,111,245,0.5), inset 0 0 0 1px rgba(255,255,255,0.18)",
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
