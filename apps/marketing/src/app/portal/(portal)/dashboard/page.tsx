"use client";

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
} from "lucide-react";
import Link from "next/link";

import { api, qk } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
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
  SOFT_TILE,
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

function getGreetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return "☀️";
  if (h < 17) return "🌤";
  return "🌙";
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; tone: string; dot: string; icon: typeof CheckCircle2 }> = {
  completed:   { label: "Completed",   tone: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  in_progress: { label: "In progress", tone: "bg-sky-50 text-sky-700",         dot: "bg-sky-500",     icon: Activity },
  confirmed:   { label: "Confirmed",   tone: "bg-blue-50 text-blue-700",       dot: "bg-blue-500",    icon: CheckCircle2 },
  booked:      { label: "Booked",      tone: "bg-violet-50 text-violet-700",   dot: "bg-violet-500",  icon: Calendar },
  cancelled:   { label: "Cancelled",   tone: "bg-red-50 text-red-600",         dot: "bg-red-400",     icon: AlertCircle },
  no_show:     { label: "No show",     tone: "bg-amber-50 text-amber-700",     dot: "bg-amber-500",   icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { tone: string; bar: string }> = {
  urgent: { tone: "bg-red-50 text-red-700",     bar: "bg-red-500" },
  high:   { tone: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  normal: { tone: "bg-sky-50 text-sky-700",     bar: "bg-sky-500" },
  low:    { tone: "bg-slate-100 text-slate-600", bar: "bg-slate-300" },
};

const QUICK_TOOLS = [
  { href: "/portal/prescriptions/new", label: "New Rx", hint: "E-prescription", icon: Pill, tone: "bg-sky-50 text-sky-600" },
  { href: "/portal/lab-orders/new", label: "Order lab", hint: "Pathology test", icon: TestTube2, tone: "bg-violet-50 text-violet-600" },
  { href: "/portal/clinical-notes/new", label: "Clinical note", hint: "SOAP / progress", icon: FileText, tone: "bg-emerald-50 text-emerald-600" },
  { href: "/portal/imaging", label: "Imaging", hint: "DICOM studies", icon: ScanLine, tone: "bg-rose-50 text-rose-500" },
  { href: "/portal/patients", label: "Patients", hint: "Search EHR", icon: Users, tone: "bg-amber-50 text-amber-600" },
  { href: "/portal/schedule", label: "Schedule", hint: "Roster & slots", icon: Calendar, tone: "bg-teal-50 text-teal-600" },
] as const;

export default function DashboardPage() {
  const t = useT();
  void t;
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.replace(/^Dr\.\s*/i, "").split(" ")[0] ?? "Doctor";

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
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = imaging?.records ?? [];
    return rows.filter((r) => {
      const stamp = r.date ? Date.parse(r.date) : r.createdAt ? Date.parse(r.createdAt) : 0;
      return stamp >= cutoff;
    }).length;
  })();

  const today = dash?.todaysAppointments ?? [];
  const waiting = walkins?.walkIns ?? [];
  const recent = (msgs?.conversations ?? []).slice(0, 5);
  const unread = msgs?.totalUnread ?? 0;

  const completedToday = today.filter((a) => a.status === "completed").length;
  const activeToday = today.filter((a) => a.status !== "cancelled").length;
  const upcomingToday = today.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
  const nextUp = today.find((a) => a.status !== "completed" && a.status !== "cancelled") ?? null;
  const completionPct = activeToday > 0 ? Math.round((completedToday / activeToday) * 100) : 0;
  const urgentWaiting = waiting.filter((w) => w.priority === "urgent" || w.priority === "high").length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Stethoscope size={13} aria-hidden />}
          kicker={dash?.doctor?.specialization ?? "Clinical workspace"}
          kickerMeta={getTodayFormatted()}
          title={
            <>
              {getGreeting()}, Dr. {firstName} <span aria-hidden>{getGreetingEmoji()}</span>
            </>
          }
          description={
            dashLoading
              ? "Loading your clinic day…"
              : nextUp
                ? `Next up at ${formatTime(`1970-01-01T${nextUp.time}`)} — ${nextUp.reason ?? "clinical consultation"}.`
                : upcomingToday === 0 && completedToday > 0
                  ? "All of today's consultations are wrapped up. Nice work."
                  : "A clear calendar today — open slots or take walk-ins."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
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
          />
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Today's schedule */}
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
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
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
              <ol className="mt-4 divide-y divide-slate-100">
                {today.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.booked;
                  const isNext = nextUp?.id === a.id;
                  const done = a.status === "completed" || a.status === "cancelled";
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/portal/patients/${a.patientId}`}
                        className={cn(
                          "group -mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50",
                          isNext && "bg-sky-50/60 hover:bg-sky-50",
                        )}
                      >
                        <div className="w-16 shrink-0">
                          <div
                            className={cn(
                              "font-mono text-sm font-semibold tabular-nums",
                              done ? "text-slate-400" : "text-slate-900",
                            )}
                          >
                            {formatTime(`1970-01-01T${a.time}`)}
                          </div>
                          {isNext ? (
                            <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-sky-600">
                              Next
                            </div>
                          ) : null}
                        </div>

                        <span className={cn("h-9 w-1 shrink-0 rounded-full", cfg.dot)} aria-hidden />

                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "truncate text-sm font-semibold",
                              done ? "text-slate-500" : "text-slate-900",
                            )}
                          >
                            {a.reason ?? "Clinical consultation"}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {a.queueNumber != null ? `Token #${a.queueNumber}` : "Scheduled visit"}
                          </div>
                        </div>

                        <span
                          className={cn(
                            "hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold sm:inline-flex",
                            cfg.tone,
                          )}
                        >
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
                  ? `${waiting.length} patient${waiting.length === 1 ? "" : "s"} waiting in reception`
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
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {waiting.map((w, i) => {
                  const pCfg = PRIORITY_CONFIG[w.priority] ?? PRIORITY_CONFIG.normal;
                  return (
                    <li key={w.id}>
                      <Link
                        href={`/portal/patients/${w.patientId}`}
                        className={cn(SOFT_TILE, "group relative flex h-full flex-col gap-3 overflow-hidden p-4")}
                      >
                        <span className={cn("absolute inset-y-0 left-0 w-1", pCfg.bar)} aria-hidden />
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-400">
                            #{String(i + 1).padStart(2, "0")}
                          </span>
                          <span className={cn("rounded-md px-2 py-0.5 text-[10.5px] font-semibold capitalize", pCfg.tone)}>
                            {w.priority}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                            {w.reason ?? "Walk-in consultation"}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                            <Timer size={11} aria-hidden />
                            Arrived {relativeTime(w.arrivedAt)}
                          </p>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-sky-600">
                          Call to room
                          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:col-span-4" aria-label="Clinic tools">
          {/* Quick tools */}
          <section className={PANEL} aria-labelledby="dash-tools">
            <div className="flex items-center justify-between gap-3">
              <h2 id="dash-tools" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                Quick tools
              </h2>
              <span className="text-xs text-slate-400">One click</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className={cn(SOFT_TILE, "group flex flex-col gap-3 p-3.5")}
                  >
                    <span className={cn("grid h-9 w-9 place-items-center rounded-[10px] transition-transform group-hover:scale-105", tool.tone)}>
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{tool.label}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-slate-400">{tool.hint}</span>
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
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-500">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={16} aria-hidden />
                </span>
                You&apos;re all caught up — no inquiries waiting.
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/portal/messages/${c.id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <Avatar name={c.patient.name} src={c.patient.photo} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px] text-slate-900 group-hover:text-sky-700",
                              c.doctorUnread > 0 ? "font-semibold" : "font-medium",
                            )}
                          >
                            {c.patient.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {relativeTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {c.lastMessagePreview ?? "No preview available"}
                        </p>
                      </div>
                      {c.doctorUnread > 0 ? (
                        <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-md bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                          {c.doctorUnread}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Imaging */}
          <Link
            href="/portal/imaging"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-transform hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(244,114,182,0.28), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              boxShadow: "0 18px 40px -18px rgba(49,46,129,0.6)",
            }}
          >
            <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-pink-200">
              <ScanLine size={20} aria-hidden />
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
            <ArrowRight size={16} className="shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>

          {/* Telehealth */}
          <Link
            href="/portal/appointments"
            className={cn(PANEL, "group flex items-center gap-4 transition-transform hover:-translate-y-0.5")}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <Video size={19} aria-hidden />
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
