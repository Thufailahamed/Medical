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
} from "lucide-react";
import Link from "next/link";

import { api, qk } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
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

export default function DashboardPage() {
  const t = useT();
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

  const completedToday = today.filter((a) => a.status === "completed").length;
  const upcomingToday = today.filter((a) => a.status !== "completed" && a.status !== "cancelled").length;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Doctor Command Hero ───────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Stethoscope size={12} className="text-sky-300" />
                {dash?.doctor?.specialization ?? "Specialist Clinician"} · Clinical Workspace
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {getGreeting()}, Dr. {firstName} {getGreetingEmoji()}
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                {getTodayFormatted()} · Manage live consultation queues, write electronic prescriptions, and review diagnostic lab telemetry.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/portal/schedule"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <CalendarPlus size={13} />
                <span>+ New Booking</span>
              </Link>
              <Link
                href="/portal/walk-ins"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <DoorOpen size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Check-In Walk-In</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Calendar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Today&apos;s Consults
                </p>
                <p className="text-base font-extrabold text-white">
                  {upcomingToday} Booked · {completedToday} Done
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <DoorOpen size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Walk-In E-Queue
                </p>
                <p className="text-base font-extrabold text-white">
                  {waiting.length} In Waiting Room
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <MessageSquare size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Triage Inbox
                </p>
                <p className="text-base font-extrabold text-white">
                  {msgs?.totalUnread ?? 0} Unread Messages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Activity size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Clinical Status
                </p>
                <p className="text-base font-extrabold text-white">
                  Ready · Telehealth HD
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Five Metric KPI Tiles ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          icon={<Calendar size={20} />}
          label="Today's Appointments"
          value={dashLoading ? "…" : String(dash?.stats.todayAppointments ?? 0)}
          sublabel="scheduled for today"
          href="/portal/schedule"
          gradient="from-sky-500 to-blue-600"
          lightBg="bg-sky-50 text-sky-700 border-sky-100"
          accentColor="text-sky-600"
        />
        <StatCard
          icon={<DoorOpen size={20} />}
          label="Walk-In E-Queue"
          value={String(waiting.length)}
          sublabel="waiting in reception"
          href="/portal/walk-ins"
          gradient="from-amber-500 to-orange-600"
          lightBg="bg-amber-50 text-amber-700 border-amber-100"
          accentColor="text-amber-600"
          pulse={waiting.length > 0}
        />
        <StatCard
          icon={<MessageSquare size={20} />}
          label="Unread Inquiries"
          value={String(msgs?.totalUnread ?? 0)}
          sublabel="patient refill / advice"
          href="/portal/messages"
          gradient="from-purple-500 to-indigo-600"
          lightBg="bg-purple-50 text-purple-700 border-purple-100"
          accentColor="text-purple-600"
          pulse={(msgs?.totalUnread ?? 0) > 0}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Week's Earnings"
          value={earnings ? formatLkr(earnings.thisWeek) : "LKR 0"}
          sublabel="current payout cycle"
          href="/portal/earnings"
          gradient="from-emerald-500 to-teal-600"
          lightBg="bg-emerald-50 text-emerald-700 border-emerald-100"
          accentColor="text-emerald-600"
        />
        <StatCard
          icon={<ScanLine size={20} />}
          label="PACS & Imaging"
          value={String(recentImagingCount)}
          sublabel="new radiology (7d)"
          href="/portal/imaging"
          gradient="from-rose-500 to-pink-600"
          lightBg="bg-rose-50 text-rose-700 border-rose-100"
          accentColor="text-rose-600"
        />
      </div>

      {/* ── 3. Two-Column Consultations & Triage Grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Today's Schedule (Takes 7 Cols) */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 shadow-2xs">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Today&apos;s Consultation Schedule
                </h3>
                <p className="text-[11px] text-slate-400">
                  {today.length} booked encounter{today.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Link
              href="/portal/schedule"
              className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Full Schedule</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {today.length === 0 ? (
            /* Rich Empty State for Consultations */
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 sm:p-8 flex flex-col items-center text-center gap-3.5 my-2">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 text-sky-600 flex items-center justify-center shadow-xs">
                <Calendar size={22} />
              </div>
              <div className="max-w-md">
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                  No Appointments Scheduled Today
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Your appointment calendar for today is completely clear. You can open additional booking slots, accept walk-in patients, or schedule a follow-up consultation.
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-2">
                <Link
                  href="/portal/schedule"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Open Time Slots</span>
                </Link>
                <Link
                  href="/portal/patients"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Book Patient Follow-up
                </Link>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {today.map((a, idx) => {
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.booked;
                const StatusIcon = cfg.icon;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/portal/patients/${a.patientId}`}
                      className="group flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-sky-50/40 hover:border-sky-300 transition-all shadow-2xs"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <div className="font-mono text-xs font-bold tabular-nums text-slate-900">
                          {formatTime(`1970-01-01T${a.time}`)}
                        </div>
                      </div>

                      <div className="h-6 w-px bg-slate-200" />

                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {a.reason ?? "Clinical Consultation"}
                        </div>
                        {a.queueNumber != null && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Token #{a.queueNumber} · Consultation Queue
                          </div>
                        )}
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0",
                          cfg.bg,
                          cfg.color,
                        )}
                      >
                        <StatusIcon size={10} />
                        {cfg.label}
                      </div>

                      <ChevronRight size={14} className="text-slate-400 group-hover:text-sky-600 transition-colors shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent Messages & Triage (Takes 5 Cols) */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shadow-2xs">
                <MessageSquare size={16} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Patient Inquiries
                </h3>
                <p className="text-[11px] text-slate-400">
                  {msgs?.totalUnread ?? 0} unread triage messages
                </p>
              </div>
            </div>
            <Link
              href="/portal/messages"
              className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200/60 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Inbox</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {recent.length === 0 ? (
            /* Rich Empty State for Messages */
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 flex flex-col items-center text-center gap-3 my-2">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 text-purple-600 flex items-center justify-center shadow-xs">
                <CheckCircle2 size={22} />
              </div>
              <div className="max-w-xs">
                <h4 className="font-bold text-slate-900 text-sm">
                  Clinical Inbox Triage Complete
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  You are all caught up! No unread patient inquiries, symptom follow-ups, or prescription refills are awaiting review.
                </p>
              </div>
              <Link
                href="/portal/messages"
                className="mt-1 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                Open Messages Inbox
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/messages/${c.id}`}
                    className="p-3 rounded-xl border border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/30 transition-all flex items-start gap-3 shadow-2xs group"
                  >
                    <Avatar name={c.patient.name} src={c.patient.photo} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                          {c.patient.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {relativeTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {c.lastMessagePreview ?? "No message preview available"}
                      </p>
                    </div>
                    {c.doctorUnread > 0 && (
                      <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-purple-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0 shadow-2xs">
                        {c.doctorUnread}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── 4. Live Walk-In E-Queue & Reception Stage ──────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shadow-2xs">
              <DoorOpen size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Live Reception &amp; Walk-In Triage Queue
              </h3>
              <p className="text-[11px] text-slate-400">
                {waiting.length > 0 ? `${waiting.length} patients waiting in reception` : "Waiting room is clear"}
              </p>
            </div>
          </div>
          <Link
            href="/portal/walk-ins"
            className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Walk-Ins</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {waiting.length === 0 ? (
          /* Rich Empty State for Walk-Ins */
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 sm:p-8 flex flex-col items-center text-center gap-3.5 my-2">
            <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 text-amber-600 flex items-center justify-center shadow-xs">
              <DoorOpen size={22} />
            </div>
            <div className="max-w-md">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Waiting Room is Currently Clear
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                No walk-in patients are waiting in the queue. When reception checks in an arriving patient or a patient scans their HealthHub QR code, their triage token will appear here.
              </p>
            </div>
            <div className="flex items-center gap-2.5 mt-2">
              <Link
                href="/portal/walk-ins"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Plus size={13} strokeWidth={3} />
                <span>Check In Arriving Patient</span>
              </Link>
              <Link
                href="/portal/walk-ins"
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Scan Patient Health ID
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {waiting.map((w) => {
              const pCfg = PRIORITY_CONFIG[w.priority] ?? PRIORITY_CONFIG.normal;
              return (
                <li key={w.id}>
                  <Link
                    href={`/portal/patients/${w.patientId}`}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-sky-400 hover:shadow-xs transition-all flex flex-col gap-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border uppercase tracking-wider",
                          pCfg.bg,
                          pCfg.color,
                        )}
                      >
                        {w.priority}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Timer size={11} />
                        {relativeTime(w.arrivedAt)}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {w.reason ?? "Walk-in Consultation"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Patient #{w.patientId.slice(0, 8)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600">
                      <span>Call to Room</span>
                      <ChevronRight size={13} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── 5. Clinical Quick Tools Hub ────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Clinical Command Shortcuts
            </h3>
            <p className="text-xs text-slate-400">
              Instant 1-click tools for your daily clinical encounters
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <Link
            href="/portal/prescriptions/new"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-sky-50/50 hover:border-sky-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200">
              <Pill size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-sky-800 transition-colors">
                New Rx
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">E-Prescription</p>
            </div>
          </Link>

          <Link
            href="/portal/lab-orders/new"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-purple-50/50 hover:border-purple-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <TestTube2 size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-800 transition-colors">
                Order Lab
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Pathology Test</p>
            </div>
          </Link>

          <Link
            href="/portal/clinical-notes/new"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FileText size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                Clinical Note
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">SOAP / Progress</p>
            </div>
          </Link>

          <Link
            href="/portal/imaging"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-rose-50/50 hover:border-rose-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
              <ScanLine size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-rose-800 transition-colors">
                Imaging PACS
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">DICOM Radiography</p>
            </div>
          </Link>

          <Link
            href="/portal/patients"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-amber-50/50 hover:border-amber-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                Patient Registry
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Search EHR</p>
            </div>
          </Link>

          <Link
            href="/portal/schedule"
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-teal-50/50 hover:border-teal-300 transition-all flex flex-col gap-2 group cursor-pointer shadow-2xs hover:scale-[1.02]"
          >
            <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200">
              <Calendar size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                My Schedule
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Roster &amp; Slots</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── High-Contrast Stat Card Component ───────────────────────────────────────
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
      <div
        className={cn(
          "w-full rounded-2xl border border-slate-200/90 p-4 sm:p-5 transition-all duration-200",
          "bg-white hover:border-sky-300 hover:shadow-xs hover:-translate-y-0.5",
          "relative overflow-hidden shadow-2xs",
        )}
      >
        <div className="relative z-10 flex items-start gap-3.5">
          {/* Icon Badge */}
          <div
            className={cn(
              "relative h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 shadow-2xs",
              lightBg,
            )}
          >
            <span className={cn(accentColor, "relative z-10")}>{icon}</span>
            {pulse && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-white animate-ping" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold text-slate-400 leading-none mb-1.5 uppercase tracking-wider">
              {label}
            </div>
            <div className="text-2xl font-black text-slate-900 leading-none tabular-nums tracking-tight">
              {value}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {sublabel}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
