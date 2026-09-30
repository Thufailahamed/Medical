"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  DoorOpen,
  Clock,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Timer,
  FileText,
  CalendarPlus,
  ScanLine,
  Pill,
  TestTube2,
  Stethoscope,
  Plus,
  QrCode,
  Video,
  Wallet,
  Hash,
  ListOrdered,
} from "lucide-react";
import Link from "next/link";

import { api, qk } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { useAuthStore } from "@/portal/stores/auth";
import { formatLkr, formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PrimaryLink,
  SecondaryLink,
  StatTile,
} from "@/portal/components/doctor/Workspace";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardResponse {
  doctor: {
    id: string;
    specialization: string;
    hospitalId?: string | null;
  };
  stats: { todayAppointments: number; totalPatients: number };
  todaysAppointments: Array<{
    id: string;
    patientId: string;
    time: string;
    status: string;
    reason?: string | null;
    queueNumber?: number | null;
  }>;
}

type Appointment = DashboardResponse["todaysAppointments"][number];

interface ConversationsResponse {
  conversations: Array<{
    id: string;
    patientId: string;
    patient: { id: string; userId: string; name: string; photo: string | null };
    lastMessageAt: string;
    lastMessagePreview: string | null;
    doctorUnread: number;
  }>;
  totalUnread: number;
}

interface WalkInsResponse {
  walkIns: Array<{
    id: string;
    patientId: string;
    arrivedAt: string;
    reason: string | null;
    priority: string;
    status: string;
  }>;
}

interface EarningsSummary {
  thisWeek: number;
  thisMonth: number;
  total: number;
  pendingPayout: number;
  events: Array<{ amount: number; occurredAt: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Today's Date at the appointment's HH:mm[:ss] wall-clock time. */
function apptDate(time: string): Date {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function fmtApptTime(time: string) {
  return formatTime(`1970-01-01T${time}`);
}

/** "in 25 min" / "in 1h 10m" / "12 min late". */
function countdown(target: Date, now: number): string {
  const mins = Math.round((target.getTime() - now) / 60_000);
  if (Math.abs(mins) < 1) return "now";
  const abs = Math.abs(mins);
  const span = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs} min`;
  return mins > 0 ? `in ${span}` : `${span} late`;
}

/** Re-render every `ms` so countdowns and wait timers stay live. */
function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const STATUS_CONFIG: Record<string, { label: string; tone: string; dot: string; icon: typeof CheckCircle2 }> = {
  completed:   { label: "Completed",   tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/10", dot: "bg-emerald-500", icon: CheckCircle2 },
  in_progress: { label: "In progress", tone: "bg-sky-50 text-sky-700 ring-sky-600/10",             dot: "bg-sky-500",     icon: Activity },
  confirmed:   { label: "Confirmed",   tone: "bg-blue-50 text-blue-700 ring-blue-600/10",          dot: "bg-blue-500",    icon: CheckCircle2 },
  booked:      { label: "Booked",      tone: "bg-violet-50 text-violet-700 ring-violet-600/10",    dot: "bg-violet-500",  icon: Calendar },
  cancelled:   { label: "Cancelled",   tone: "bg-red-50 text-red-600 ring-red-600/10",             dot: "bg-red-400",     icon: AlertCircle },
  no_show:     { label: "No show",     tone: "bg-amber-50 text-amber-700 ring-amber-600/10",       dot: "bg-amber-500",   icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { tone: string; bar: string; rank: number }> = {
  urgent: { tone: "bg-red-50 text-red-700 ring-red-600/15",       bar: "bg-red-500",   rank: 0 },
  high:   { tone: "bg-amber-50 text-amber-700 ring-amber-600/15", bar: "bg-amber-500", rank: 1 },
  normal: { tone: "bg-sky-50 text-sky-700 ring-sky-600/15",       bar: "bg-sky-500",   rank: 2 },
  low:    { tone: "bg-slate-100 text-slate-600 ring-slate-600/10", bar: "bg-slate-300", rank: 3 },
};

const QUICK_TOOLS = [
  { href: "/portal/prescriptions/new", label: "New Rx", hint: "E-prescription", icon: Pill, tone: "from-sky-500 to-sky-600", glow: "shadow-sky-500/30" },
  { href: "/portal/lab-orders/new", label: "Order lab", hint: "Pathology test", icon: TestTube2, tone: "from-violet-500 to-violet-600", glow: "shadow-violet-500/30" },
  { href: "/portal/clinical-notes/new", label: "Clinical note", hint: "SOAP / progress", icon: FileText, tone: "from-emerald-500 to-emerald-600", glow: "shadow-emerald-500/30" },
  { href: "/portal/imaging", label: "Imaging", hint: "DICOM studies", icon: ScanLine, tone: "from-rose-500 to-pink-600", glow: "shadow-rose-500/30" },
  { href: "/portal/patients", label: "Patients", hint: "Search EHR", icon: Users, tone: "from-amber-500 to-orange-500", glow: "shadow-amber-500/30" },
  { href: "/portal/schedule", label: "Schedule", hint: "Roster & slots", icon: Calendar, tone: "from-teal-500 to-cyan-600", glow: "shadow-teal-500/30" },
] as const;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.replace(/^Dr\.\s*/i, "").split(" ")[0] ?? "Doctor";
  const now = useNow();

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardResponse>("/doctor/dashboard"),
  });

  const { data: msgs } = useQuery({
    queryKey: qk.messages({ limit: 5 }),
    queryFn: () => api<ConversationsResponse>("/doctor-messages/conversations?limit=5"),
  });

  const { data: walkins } = useQuery({
    queryKey: qk.walkins({ status: "waiting" }),
    queryFn: () =>
      api<WalkInsResponse>("/walk-ins?status=waiting&limit=10"),
  });

  const { data: earnings } = useQuery({
    queryKey: qk.earningsSummary,
    queryFn: () => api<EarningsSummary>("/doctor-earnings/summary"),
  });

  const { data: imaging } = useQuery({
    queryKey: [...qk.prescriptions({ scope: "imaging-tile" }), "7d"] as const,
    queryFn: () =>
      api<{ records: Array<{ date: string | null; createdAt: string }>; total: number }>(
        "/doctor-portal/records?type=imaging&limit=200"
      ),
  });

  const recentImagingCount = (() => {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const rows = imaging?.records ?? [];
    return rows.filter((r) => {
      const stamp = r.date ? Date.parse(r.date) : r.createdAt ? Date.parse(r.createdAt) : 0;
      return stamp >= cutoff;
    }).length;
  })();

  const today = useMemo(
    () =>
      (dash?.todaysAppointments ?? [])
        .slice()
        .sort((a, b) => apptDate(a.time).getTime() - apptDate(b.time).getTime()),
    [dash],
  );
  // Most urgent first, then longest wait.
  const waiting = useMemo(
    () =>
      (walkins?.walkIns ?? []).slice().sort((a, b) => {
        const pa = PRIORITY_CONFIG[a.priority]?.rank ?? 2;
        const pb = PRIORITY_CONFIG[b.priority]?.rank ?? 2;
        return pa - pb || Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt);
      }),
    [walkins],
  );
  const recent = (msgs?.conversations ?? []).slice(0, 5);
  const unread = msgs?.totalUnread ?? 0;

  const completedToday = today.filter((a) => a.status === "completed").length;
  const activeToday = today.filter((a) => a.status !== "cancelled").length;
  const upcomingToday = today.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
  const nextUp = today.find((a) => a.status !== "completed" && a.status !== "cancelled") ?? null;
  const completionPct = activeToday > 0 ? Math.round((completedToday / activeToday) * 100) : 0;
  const urgentWaiting = waiting.filter((w) => w.priority === "urgent" || w.priority === "high").length;

  // Last 7 days of earnings, oldest → today.
  const earningsDays = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { start: d.getTime(), label: d.toLocaleDateString("en-US", { weekday: "narrow" }), total: 0 };
    });
    for (const e of earnings?.events ?? []) {
      const t = Date.parse(e.occurredAt);
      const day = days.find((d) => t >= d.start && t < d.start + 86_400_000);
      if (day) day.total += e.amount;
    }
    return days;
  }, [earnings]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Stethoscope size={13} aria-hidden />}
          kicker={dash?.doctor?.specialization ?? "Clinical workspace"}
          kickerMeta={getTodayFormatted()}
          title={
            <>
              {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                Dr. {firstName}
              </span>
            </>
          }
          description={
            dashLoading
              ? "Loading your clinic day…"
              : nextUp
                ? `Next up at ${fmtApptTime(nextUp.time)} (${countdown(apptDate(nextUp.time), now)}) — ${nextUp.reason ?? "clinical consultation"}.`
                : upcomingToday === 0 && completedToday > 0
                  ? "All of today's consultations are wrapped up. Nice work."
                  : "A clear calendar today — open slots or take walk-ins."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Telehealth ready
              </span>
              {waiting.length > 0 ? (
                <Link
                  href="/portal/walk-ins"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <DoorOpen size={12} aria-hidden />
                  {waiting.length} in waiting room
                </Link>
              ) : null}
              {unread > 0 ? (
                <Link href="/portal/messages" className={cn(HERO_CHIP, "transition-colors hover:bg-white/10")}>
                  <MessageSquare size={12} className="text-violet-300" aria-hidden />
                  {unread} unread
                </Link>
              ) : null}
            </>
          }
          aside={
            activeToday > 0 ? (
              <DayProgress done={completedToday} total={activeToday} pct={completionPct} />
            ) : null
          }
          actions={
            <>
              <Link href="/portal/schedule" className={HERO_GHOST}>
                <CalendarPlus size={15} aria-hidden />
                New booking
              </Link>
              <Link href="/portal/walk-ins" className={HERO_PRIMARY}>
                <DoorOpen size={15} className="text-sky-600" aria-hidden />
                Check in walk-in
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            href="/portal/schedule"
            label="Today's consults"
            icon={<Calendar size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={dashLoading ? "…" : `${completedToday}/${activeToday}`}
            unit={activeToday > 0 ? "done" : undefined}
            sub={upcomingToday > 0 ? `${upcomingToday} still to see` : "Nothing pending"}
            progress={activeToday > 0 ? completionPct : null}
          />
          <StatTile
            href="/portal/walk-ins"
            label="Waiting room"
            icon={<DoorOpen size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(waiting.length)}
            unit={waiting.length === 1 ? "patient" : "patients"}
            sub={urgentWaiting > 0 ? `${urgentWaiting} high priority` : waiting.length > 0 ? "Checked in at reception" : "Reception is clear"}
            badge={urgentWaiting > 0 ? { text: "Priority", tone: "bg-red-50 text-red-600" } : undefined}
            pulse={waiting.length > 0}
          />
          <StatTile
            href="/portal/messages"
            label="Unread inquiries"
            icon={<MessageSquare size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(unread)}
            sub={unread > 0 ? "Refills & advice requests" : "Inbox is clear"}
            badge={unread > 0 ? { text: "New", tone: "bg-violet-50 text-violet-700" } : undefined}
          />
          <StatTile
            href="/portal/earnings"
            label="This week"
            icon={<TrendingUp size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={earnings ? formatLkr(earnings.thisWeek) : "—"}
            sub={
              earnings && earnings.pendingPayout > 0
                ? `${formatLkr(earnings.pendingPayout)} pending payout`
                : "Current payout cycle"
            }
            chart={earnings ? <Sparkbars values={earningsDays.map((d) => d.total)} /> : undefined}
          />
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Up next spotlight */}
          {nextUp ? <NextPatientCard appt={nextUp} now={now} /> : null}

          {/* Today's schedule — timeline */}
          <section className={PANEL} aria-labelledby="dash-schedule">
            <PanelHeader
              id="dash-schedule"
              icon={<Clock size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Today's schedule"
              caption={
                today.length === 0
                  ? "No booked encounters"
                  : `${today.length} encounter${today.length === 1 ? "" : "s"} · ${completedToday} completed`
              }
              href="/portal/schedule"
              linkLabel="Full schedule"
            />

            {dashLoading ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : today.length === 0 ? (
              <EmptyBlock
                icon={<Calendar size={19} />}
                title="No appointments today"
                body="Your calendar is clear. Open booking slots, take walk-ins, or schedule a follow-up."
                actions={
                  <>
                    <PrimaryLink href="/portal/schedule" icon={<Plus size={13} strokeWidth={2.5} />}>
                      Open time slots
                    </PrimaryLink>
                    <SecondaryLink href="/portal/patients">Book a follow-up</SecondaryLink>
                  </>
                }
              />
            ) : (
              <ScheduleTimeline items={today} nextId={nextUp?.id ?? null} now={now} />
            )}
          </section>

          {/* Walk-in queue */}
          <section className={PANEL} aria-labelledby="dash-walkins">
            <PanelHeader
              id="dash-walkins"
              icon={<DoorOpen size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Walk-in queue"
              caption={
                waiting.length > 0
                  ? `${waiting.length} patient${waiting.length === 1 ? "" : "s"} waiting · sorted by priority`
                  : "Waiting room is clear"
              }
              href="/portal/walk-ins"
              linkLabel="Manage"
            />

            {waiting.length === 0 ? (
              <EmptyBlock
                icon={<DoorOpen size={19} />}
                title="No one is waiting"
                body="When reception checks in a patient or they scan their HealthHub QR, their token appears here."
                actions={
                  <>
                    <PrimaryLink href="/portal/walk-ins" icon={<Plus size={13} strokeWidth={2.5} />}>
                      Check in patient
                    </PrimaryLink>
                    <SecondaryLink href="/portal/walk-ins" icon={<QrCode size={13} />}>
                      Scan Health ID
                    </SecondaryLink>
                  </>
                }
              />
            ) : (
              <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {waiting.map((w, i) => (
                  <WalkInCard key={w.id} walkIn={w} position={i + 1} now={now} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Clinic tools">
          {/* Quick tools */}
          <section className={PANEL} aria-labelledby="dash-tools">
            <div className="flex items-center justify-between gap-3">
              <h2 id="dash-tools" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                Quick tools
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                One click
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105",
                        tool.tone,
                        tool.glow,
                      )}
                    >
                      <Icon size={19} aria-hidden />
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{tool.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{tool.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Patient inquiries */}
          <section className={PANEL} aria-labelledby="dash-inbox">
            <PanelHeader
              id="dash-inbox"
              icon={<MessageSquare size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Patient inquiries"
              caption={unread > 0 ? `${unread} unread` : "Triage inbox"}
              href="/portal/messages"
              linkLabel="Inbox"
            />
            {recent.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-white p-3.5 text-sm text-slate-600 ring-1 ring-inset ring-emerald-600/10">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                  <CheckCircle2 size={16} aria-hidden />
                </span>
                You&apos;re all caught up — no inquiries waiting.
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-0.5">
                {recent.map((c) => {
                  const isUnread = c.doctorUnread > 0;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/portal/messages/${c.id}`}
                        className={cn(
                          "group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors",
                          isUnread ? "bg-violet-50/50 hover:bg-violet-50" : "hover:bg-slate-50",
                        )}
                      >
                        <span className="relative shrink-0">
                          <Avatar name={c.patient.name} src={c.patient.photo} size="sm" className="h-9 w-9" />
                          {isUnread ? (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-violet-600" aria-hidden />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-[13px] text-slate-900 group-hover:text-sky-700",
                                isUnread ? "font-semibold" : "font-medium",
                              )}
                            >
                              {c.patient.name}
                            </span>
                            <span className={cn("shrink-0 text-[11px]", isUnread ? "font-semibold text-violet-600" : "text-slate-400")}>
                              {relativeTime(c.lastMessageAt)}
                            </span>
                          </div>
                          <p className={cn("mt-0.5 truncate text-xs", isUnread ? "text-slate-700" : "text-slate-500")}>
                            {c.lastMessagePreview ?? "No preview available"}
                          </p>
                        </div>
                        {isUnread ? (
                          <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                            {c.doctorUnread}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Earnings */}
          <EarningsPanel earnings={earnings} days={earningsDays} />

          {/* Imaging */}
          <Link
            href="/portal/imaging"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(244,114,182,0.30), transparent 60%), radial-gradient(300px 160px at 0% 100%, rgba(129,140,248,0.25), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
            }}
          >
            <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
            <span className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 rounded-full border border-white/10" aria-hidden />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-pink-200 ring-1 ring-inset ring-white/15 backdrop-blur">
              <ScanLine size={21} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pink-200/80">
                PACS &amp; imaging
              </span>
              <span className="mt-1 block text-lg font-semibold tracking-[-0.01em]">
                {recentImagingCount} new stud{recentImagingCount === 1 ? "y" : "ies"}
              </span>
              <span className="block text-xs text-white/60">Radiology from the last 7 days</span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          {/* Telehealth */}
          <Link
            href="/portal/appointments"
            className={cn(PANEL, "group flex items-center gap-4 transition-all hover:-translate-y-0.5")}
          >
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/30">
              <Video size={20} aria-hidden />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Video consults</span>
              <span className="block text-xs text-slate-400">Start calls from your appointments</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ─── Hero: day progress ring ─────────────────────────────────────────────────
function DayProgress({ done, total, pct }: { done: number; total: number; pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pl-2.5 pr-4 backdrop-blur-md">
      <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="dayRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="url(#dayRing)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <text
          x="28"
          y="28"
          transform="rotate(90 28 28)"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize="13"
          fontWeight="700"
        >
          {pct}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">Day progress</p>
        <p className="mt-0.5 text-sm font-semibold text-white tabular-nums">
          {done} of {total} seen
        </p>
      </div>
    </div>
  );
}

// ─── Stat tile sparkbars ─────────────────────────────────────────────────────
function Sparkbars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span className="flex h-8 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-[5px] rounded-full",
            i === values.length - 1 ? "bg-emerald-500" : v > 0 ? "bg-emerald-200" : "bg-slate-100",
          )}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

// ─── Up next spotlight ───────────────────────────────────────────────────────
function NextPatientCard({ appt, now }: { appt: Appointment; now: number }) {
  const at = apptDate(appt.time);
  const late = at.getTime() < now - 60_000;
  const inProgress = appt.status === "in_progress";
  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(2,132,199,0.18)]"
      aria-label="Up next"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(500px 200px at 0% 0%, rgba(14,165,233,0.10), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-600 px-4 py-3 text-white shadow-lg shadow-sky-600/25 min-w-[92px]">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100/80">
            {inProgress ? "Now" : "Up next"}
          </span>
          <span className="mt-0.5 text-xl font-bold tabular-nums leading-tight">{fmtApptTime(appt.time)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                inProgress
                  ? "bg-sky-50 text-sky-700 ring-sky-600/15"
                  : late
                    ? "bg-amber-50 text-amber-700 ring-amber-600/15"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  inProgress ? "bg-sky-500 animate-pulse" : late ? "bg-amber-500" : "bg-emerald-500",
                )}
                aria-hidden
              />
              {inProgress ? "In consultation" : countdown(at, now)}
            </span>
            {appt.queueNumber != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <Hash size={10} aria-hidden />
                Token {appt.queueNumber}
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate text-lg font-semibold tracking-[-0.01em] text-slate-900">
            {appt.reason ?? "Clinical consultation"}
          </p>
          <p className="text-xs text-slate-400">Scheduled appointment</p>
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Link
            href="/portal/queue"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 sm:flex-none"
          >
            <ListOrdered size={15} aria-hidden />
            Queue
          </Link>
          <Link
            href={`/portal/patients/${appt.patientId}/overview`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 sm:flex-none"
          >
            Open chart
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Schedule timeline ───────────────────────────────────────────────────────
function ScheduleTimeline({
  items,
  nextId,
  now,
}: {
  items: Appointment[];
  nextId: string | null;
  now: number;
}) {
  // Insert a "now" marker before the first appointment that is still ahead.
  const nowIndex = items.findIndex((a) => apptDate(a.time).getTime() > now);
  const showNow = nowIndex > 0;

  return (
    <ol className="relative mt-5">
      <span className="absolute bottom-3 left-[88px] top-3 w-px bg-slate-200 max-sm:hidden" aria-hidden />
      {items.map((a, i) => {
        const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.booked;
        const isNext = nextId === a.id;
        const done = a.status === "completed" || a.status === "cancelled";
        return (
          <li key={a.id}>
            {showNow && i === nowIndex ? (
              <div className="relative my-1.5 flex items-center gap-3 max-sm:hidden" aria-label="Current time">
                <span className="w-[68px] text-right font-mono text-[10.5px] font-bold uppercase tracking-wider text-rose-500">
                  Now
                </span>
                <span className="relative z-10 grid h-4 w-4 shrink-0 place-items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100" />
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-rose-300 to-transparent" />
              </div>
            ) : null}
            <Link
              href={`/portal/patients/${a.patientId}/overview`}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl py-2.5 pr-2 transition-colors",
                isNext ? "bg-sky-50/70 hover:bg-sky-50" : "hover:bg-slate-50",
              )}
            >
              <span
                className={cn(
                  "w-[68px] shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums",
                  done ? "text-slate-400" : "text-slate-900",
                )}
              >
                {fmtApptTime(a.time)}
              </span>

              <span className="relative z-10 grid h-4 w-4 shrink-0 place-items-center max-sm:hidden" aria-hidden>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full ring-4",
                    cfg.dot,
                    isNext ? "ring-sky-100" : "ring-white",
                  )}
                />
              </span>

              <div className="min-w-0 flex-1 pl-1">
                <div
                  className={cn(
                    "truncate text-sm font-semibold",
                    done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900",
                  )}
                >
                  {a.reason ?? "Clinical consultation"}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  {a.queueNumber != null ? <span>Token #{a.queueNumber}</span> : <span>Scheduled visit</span>}
                  {isNext ? (
                    <span className="font-semibold text-sky-600">· Next · {countdown(apptDate(a.time), now)}</span>
                  ) : null}
                </div>
              </div>

              <span
                className={cn(
                  "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset sm:inline-flex",
                  cfg.tone,
                )}
              >
                <cfg.icon size={11} aria-hidden />
                {cfg.label}
              </span>
              <ChevronRight
                size={15}
                className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Walk-in card ────────────────────────────────────────────────────────────
function WalkInCard({
  walkIn: w,
  position,
  now,
}: {
  walkIn: WalkInsResponse["walkIns"][number];
  position: number;
  now: number;
}) {
  const pCfg = PRIORITY_CONFIG[w.priority] ?? PRIORITY_CONFIG.normal;
  const mins = Math.max(0, Math.round((now - Date.parse(w.arrivedAt)) / 60_000));
  const waitLabel = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const waitTone =
    mins >= 45 ? "text-rose-600" : mins >= 20 ? "text-amber-600" : "text-slate-900";

  return (
    <li>
      <Link
        href={`/portal/patients/${w.patientId}/overview`}
        className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(15,23,42,0.08)]"
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", pCfg.bar)} aria-hidden />
        <div className="flex items-center justify-between gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white">
            {String(position).padStart(2, "0")}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ring-1 ring-inset", pCfg.tone)}>
            {w.priority}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">
            {w.reason ?? "Walk-in consultation"}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Timer size={12} aria-hidden />
            Waiting <span className={cn("font-semibold tabular-nums", waitTone)}>{waitLabel}</span>
          </p>
        </div>
        <span className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-sky-600">
          Call to room
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

// ─── Earnings panel ──────────────────────────────────────────────────────────
function EarningsPanel({
  earnings,
  days,
}: {
  earnings: EarningsSummary | undefined;
  days: Array<{ label: string; total: number }>;
}) {
  const max = Math.max(...days.map((d) => d.total), 1);
  return (
    <section className={PANEL} aria-labelledby="dash-earnings">
      <PanelHeader
        id="dash-earnings"
        icon={<Wallet size={16} />}
        tone="bg-emerald-50 text-emerald-600"
        title="Earnings"
        caption="Last 7 days"
        href="/portal/earnings"
        linkLabel="Details"
      />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-medium text-slate-500">This month</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-slate-900">
            {earnings ? formatLkr(earnings.thisMonth) : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50/70 p-3">
          <p className="text-[11px] font-medium text-emerald-700/80">Pending payout</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-emerald-800">
            {earnings ? formatLkr(earnings.pendingPayout) : "—"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex h-24 items-end gap-2" role="img" aria-label="Daily earnings, last 7 days">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={i} className="group flex flex-1 flex-col items-center gap-1.5" title={formatLkr(d.total)}>
              <div className="flex h-[72px] w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-md transition-all",
                    isToday
                      ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm shadow-emerald-500/30"
                      : d.total > 0
                        ? "bg-emerald-100 group-hover:bg-emerald-200"
                        : "bg-slate-100",
                  )}
                  style={{ height: `${Math.max(6, (d.total / max) * 100)}%` }}
                />
              </div>
              <span className={cn("text-[10.5px] font-semibold", isToday ? "text-emerald-700" : "text-slate-400")}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
