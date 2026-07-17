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
  Zap,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Timer,
  UserRound,
  FileText,
  CalendarPlus,
  Phone,
  ScanLine,
} from "lucide-react";
import Link from "next/link";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Button } from "@/portal/components/ui/Button";
import { useAuthStore } from "@/portal/stores/auth";
import { useT } from "@/portal/i18n";
import { formatLkr, formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed:   { label: "Completed",   color: "text-emerald-700",  bg: "bg-emerald-50 border-emerald-200/60",  icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "text-sky-700",      bg: "bg-sky-50 border-sky-200/60",         icon: Activity },
  confirmed:   { label: "Confirmed",   color: "text-blue-700",     bg: "bg-blue-50 border-blue-200/60",       icon: CheckCircle2 },
  booked:      { label: "Booked",      color: "text-violet-700",   bg: "bg-violet-50 border-violet-200/60",   icon: Calendar },
  cancelled:   { label: "Cancelled",   color: "text-red-600",      bg: "bg-red-50 border-red-200/60",         icon: AlertCircle },
  no_show:     { label: "No Show",     color: "text-amber-700",    bg: "bg-amber-50 border-amber-200/60",     icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; dotColor: string }> = {
  urgent:  { color: "text-red-700",  bg: "bg-red-50 border-red-200/60",  dotColor: "bg-red-500" },
  high:    { color: "text-amber-700", bg: "bg-amber-50 border-amber-200/60", dotColor: "bg-amber-500" },
  normal:  { color: "text-sky-700",   bg: "bg-sky-50 border-sky-200/60",  dotColor: "bg-sky-500" },
  low:     { color: "text-slate-600", bg: "bg-slate-50 border-slate-200/60", dotColor: "bg-slate-400" },
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "Doctor";

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

  // Imaging tile — pulls the latest 200 imaging records and counts
  // those dated within the last 7 days. Filters client-side because
  // /doctor-portal/records doesn't accept a `from` date param; for the
  // 7-day stat we cap at 200 which is generous for the typical panel.
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

  const completedToday = today.filter((a) => a.status === "completed").length;
  const upcomingToday = today.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 65%)",
        }} />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 60%)",
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none opacity-10" style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 50%)",
        }} />

        {/* Glass overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getGreetingEmoji()}</span>
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/50">
                  {getTodayFormatted()}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {firstName}
              </h1>
              <p className="text-sm text-white/60 mt-1.5 max-w-lg leading-relaxed">
                {t("dashboard.subtitle")}
              </p>

              {/* Quick stats row */}
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <Calendar size={11} />
                  </span>
                  <span className="font-semibold text-white">{upcomingToday}</span> remaining today
                </div>
                <div className="h-3 w-px bg-white/15" />
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <CheckCircle2 size={11} />
                  </span>
                  <span className="font-semibold text-white">{completedToday}</span> completed
                </div>
                {waiting.length > 0 && (
                  <>
                    <div className="h-3 w-px bg-white/15" />
                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                      <span className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: "rgba(251,191,36,0.2)" }}>
                        <DoorOpen size={11} className="text-amber-300" />
                      </span>
                      <span className="font-semibold text-amber-300">{waiting.length}</span> waiting
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Specialization badge + Quick actions */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border" style={{
                background: "rgba(255,255,255,0.1)",
                borderColor: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
              }}>
                <Sparkles size={11} className="text-sky-300" />
                {dash?.doctor?.specialization ?? "Clinician"}
              </div>

              {/* Quick action buttons */}
              <div className="flex items-center gap-2">
                <Link
                  href="/portal/schedule"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <CalendarPlus size={12} />
                  Schedule
                </Link>
                <Link
                  href="/portal/patients"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <UserRound size={12} />
                  Patients
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Calendar size={18} />}
          label={t("dashboard.statAppointments")}
          value={dashLoading ? "…" : String(dash?.stats.todayAppointments ?? 0)}
          sublabel="scheduled today"
          href="/portal/schedule"
          gradient="from-sky-500 to-blue-600"
          lightBg="bg-sky-50/80"
          accentColor="text-sky-600"
        />
        <StatCard
          icon={<DoorOpen size={18} />}
          label={t("dashboard.statWalkIns")}
          value={String(waiting.length)}
          sublabel="waiting now"
          href="/portal/walk-ins"
          gradient="from-violet-500 to-purple-600"
          lightBg="bg-violet-50/80"
          accentColor="text-violet-600"
          pulse={waiting.length > 0}
        />
        <StatCard
          icon={<MessageSquare size={18} />}
          label={t("dashboard.statUnread")}
          value={String(msgs?.totalUnread ?? 0)}
          sublabel="unread messages"
          href="/portal/messages"
          gradient="from-amber-500 to-orange-500"
          lightBg="bg-amber-50/80"
          accentColor="text-amber-600"
          pulse={(msgs?.totalUnread ?? 0) > 0}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label={t("dashboard.statEarnings")}
          value={earnings ? formatLkr(earnings.thisWeek) : "…"}
          sublabel="this week"
          href="/portal/earnings"
          gradient="from-emerald-500 to-teal-600"
          lightBg="bg-emerald-50/80"
          accentColor="text-emerald-600"
        />
        <StatCard
          icon={<ScanLine size={18} />}
          label="Imaging"
          value={String(recentImagingCount)}
          sublabel="new studies (7d)"
          href="/portal/imaging"
          gradient="from-rose-500 to-pink-600"
          lightBg="bg-rose-50/80"
          accentColor="text-rose-600"
        />
      </div>

      {/* ── Two-column: Schedule + Inbox ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Today's schedule — takes 3 cols */}
        <Card className="lg:col-span-3 dashboard-card" padding={false}>
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-sky-50 flex items-center justify-center">
                  <Clock size={15} className="text-sky-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text tracking-tight">{t("dashboard.sectionToday")}</div>
                  <div className="text-[11px] text-text-muted">{today.length} appointments</div>
                </div>
              </div>
              <Link href="/portal/schedule">
                <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={13} />}>
                  {t("dashboard.openSchedule")}
                </Button>
              </Link>
            </div>
          </div>

          {dashLoading ? (
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : today.length === 0 ? (
            <Empty
              title={t("dashboard.emptyToday")}
              icon={<Calendar size={20} className="text-text-muted" />}
              className="py-12"
            />
          ) : (
            <ul className="flex flex-col gap-1 p-3 pt-3">
              {today.map((a, idx) => {
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.booked;
                const StatusIcon = cfg.icon;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/portal/patients/${a.patientId}`}
                      className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-surface-2/60"
                    >
                      {/* Timeline dot + line */}
                      <div className="flex flex-col items-center gap-1 shrink-0 self-stretch">
                        <div className={cn(
                          "h-2 w-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125",
                          a.status === "completed" ? "bg-emerald-400" :
                          a.status === "in_progress" ? "bg-sky-500 animate-pulse" :
                          "bg-slate-300"
                        )} />
                        {idx < today.length - 1 && (
                          <div className="w-px flex-1 bg-border/60" />
                        )}
                      </div>

                      {/* Time */}
                      <div className="w-14 shrink-0">
                        <div className="font-mono text-[13px] font-semibold tabular-nums text-text leading-none">
                          {formatTime(`1970-01-01T${a.time}`)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text truncate leading-tight">
                          {a.reason ?? "Consultation"}
                        </div>
                        {a.queueNumber != null ? (
                          <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                            <span className="font-mono">#{a.queueNumber}</span>
                            <span>· Queue</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Status */}
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0",
                        cfg.bg, cfg.color
                      )}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </div>

                      {/* Arrow */}
                      <ChevronRight
                        size={14}
                        className="text-text-muted/40 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text-muted"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Inbox preview — takes 2 cols */}
        <Card className="lg:col-span-2 dashboard-card" padding={false}>
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center relative">
                  <MessageSquare size={15} className="text-violet-600" />
                  {(msgs?.totalUnread ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center shadow-sm">
                      {msgs!.totalUnread > 9 ? "9+" : msgs!.totalUnread}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-text tracking-tight">{t("dashboard.sectionInbox")}</div>
                  <div className="text-[11px] text-text-muted">
                    {(msgs?.totalUnread ?? 0) > 0
                      ? `${msgs!.totalUnread} unread`
                      : "all caught up"}
                  </div>
                </div>
              </div>
              <Link href="/portal/messages">
                <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={13} />}>
                  {t("dashboard.openInbox")}
                </Button>
              </Link>
            </div>
          </div>

          {recent.length === 0 ? (
            <Empty
              title={t("dashboard.emptyInbox")}
              icon={<MessageSquare size={20} className="text-text-muted" />}
              className="py-12"
            />
          ) : (
            <ul className="flex flex-col gap-1 p-3 pt-3">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/messages/${c.id}`}
                    className={cn(
                      "group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                      c.doctorUnread > 0
                        ? "bg-sky-50/50 hover:bg-sky-50"
                        : "hover:bg-surface-2/60"
                    )}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      <Avatar name={c.patient.name} src={c.patient.photo} size="sm" />
                      {c.doctorUnread > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-sky-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-[13px] truncate leading-tight",
                          c.doctorUnread > 0 ? "font-bold text-text" : "font-medium text-text"
                        )}>
                          {c.patient.name}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
                          {relativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className={cn(
                        "text-xs truncate mt-0.5 leading-relaxed",
                        c.doctorUnread > 0 ? "text-text-soft font-medium" : "text-text-muted"
                      )}>
                        {c.lastMessagePreview ?? "No preview"}
                      </div>
                    </div>
                    {c.doctorUnread > 0 && (
                      <span className="h-5 min-w-[20px] px-1 rounded-full bg-sky-500 text-[10px] font-bold text-white flex items-center justify-center shrink-0 mt-1">
                        {c.doctorUnread}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Walk-in queue ────────────────────────────────────────────────── */}
      <Card className="dashboard-card" padding={false}>
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center",
                waiting.length > 0 ? "bg-amber-50" : "bg-surface-2"
              )}>
                <DoorOpen size={15} className={waiting.length > 0 ? "text-amber-600" : "text-text-muted"} />
              </div>
              <div>
                <div className="text-sm font-bold text-text tracking-tight">{t("dashboard.sectionQueue")}</div>
                <div className="text-[11px] text-text-muted">
                  {waiting.length > 0
                    ? `${waiting.length} patient${waiting.length > 1 ? "s" : ""} waiting`
                    : "queue is clear"}
                </div>
              </div>
            </div>
            <Link href="/portal/walk-ins">
              <Button size="sm" variant="ghost" rightIcon={<ArrowRight size={13} />}>
                {t("dashboard.openQueue")}
              </Button>
            </Link>
          </div>
        </div>

        {waiting.length === 0 ? (
          <Empty
            title={t("dashboard.emptyQueue")}
            description="No patients in the waiting room right now"
            icon={<DoorOpen size={20} className="text-text-muted" />}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col gap-1 p-3 pt-3">
            {waiting.map((w, idx) => {
              const pCfg = PRIORITY_CONFIG[w.priority] ?? PRIORITY_CONFIG.normal;
              return (
                <li key={w.id}>
                  <Link
                    href={`/portal/patients/${w.patientId}`}
                    className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-surface-2/60"
                  >
                    {/* Timeline */}
                    <div className="flex flex-col items-center gap-1 shrink-0 self-stretch">
                      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", pCfg.dotColor, w.priority === "urgent" && "animate-pulse")} />
                      {idx < waiting.length - 1 && (
                        <div className="w-px flex-1 bg-border/60" />
                      )}
                    </div>

                    {/* Priority badge */}
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 capitalize",
                      pCfg.bg, pCfg.color
                    )}>
                      {w.priority === "urgent" && <AlertCircle size={9} />}
                      {w.priority}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text truncate leading-tight">
                        {w.reason ?? "Walk-in visit"}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                        <Timer size={10} />
                        Arrived {relativeTime(w.arrivedAt)}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={14}
                      className="text-text-muted/40 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text-muted"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sublabel,
  href,
  gradient,
  lightBg,
  accentColor,
  pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  href: string;
  gradient: string;
  lightBg: string;
  accentColor: string;
  pulse?: boolean;
}) {
  return (
    <Link href={href} className="group flex">
      <div className={cn(
        "w-full rounded-2xl border border-border/60 p-4 md:p-5 transition-all duration-300",
        "bg-surface hover:shadow-[var(--shadow-md)] hover:border-border-strong/60 hover:-translate-y-0.5",
        "relative overflow-hidden"
      )}>
        {/* Decorative corner gradient */}
        <div className={cn(
          "absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.12]",
          `bg-gradient-to-br ${gradient}`
        )} />

        <div className="relative z-10 flex items-start gap-3">
          {/* Icon badge */}
          <div className={cn(
            "relative h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105",
            lightBg
          )}>
            <div className={cn("absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300", `bg-gradient-to-br ${gradient}`)} style={{ mixBlendMode: "overlay" }} />
            <span className={cn(accentColor, "relative z-10")}>{icon}</span>
            {pulse && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-surface animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-text-muted leading-none mb-1.5 uppercase tracking-wide">{label}</div>
            <div className="text-[22px] font-extrabold text-text leading-none tabular-nums tracking-tight">
              {value}
            </div>
            <div className="text-[11px] text-text-muted mt-1">{sublabel}</div>
          </div>
        </div>

        {/* Bottom shine line on hover */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          `bg-gradient-to-r ${gradient}`
        )} />
      </div>
    </Link>
  );
}
