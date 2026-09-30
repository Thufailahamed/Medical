"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Clock,
  AlertTriangle,
  ChevronRight as ChevronRightIcon,
  Video,
  ListOrdered,
  DoorOpen,
  CalendarPlus,
  Stethoscope,
  ExternalLink,
  Play,
  Check,
  Sun,
  Sunrise,
  Moon,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { api, teleconsultApi, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PrimaryLink,
  SecondaryLink,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";

// ─── Types ──────────────────────────────────────────────
interface QueueRow {
  kind: "appointment" | "walkin";
  appointmentId?: string;
  walkInId?: string;
  patientId: string;
  patientName: string | null;
  patientPhoto?: string | null;
  date: string;
  time: string | null;
  status: string;
  queueNumber?: number | null;
  reason?: string | null;
  hospitalName?: string | null;
  mode?: "in_person" | "video" | null;
}

interface QueueResp {
  date: string;
  count: number;
  queue: QueueRow[];
}

// ─── Constants ──────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  {
    tone: "neutral" | "brand" | "success" | "warn" | "danger" | "violet";
    icon: typeof Calendar;
    label: string;
  }
> = {
  scheduled: { tone: "brand", icon: Calendar, label: "Scheduled" },
  confirmed: { tone: "brand", icon: Calendar, label: "Confirmed" },
  in_progress: { tone: "warn", icon: Clock, label: "In Progress" },
  in_consultation: { tone: "warn", icon: Clock, label: "In Consult" },
  completed: { tone: "success", icon: CalendarCheck, label: "Completed" },
  cancelled: { tone: "danger", icon: AlertTriangle, label: "Cancelled" },
  no_show: { tone: "danger", icon: AlertTriangle, label: "No Show" },
};

/** The one obvious next step for each state; the rest live under "More". */
const PRIMARY_NEXT: Record<string, { status: string; label: string }> = {
  scheduled: { status: "confirmed", label: "Confirm" },
  confirmed: { status: "in_progress", label: "Start" },
  in_progress: { status: "completed", label: "Complete" },
};

const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-violet-50 text-violet-700",
  confirmed: "bg-sky-50 text-sky-700",
  in_progress: "bg-amber-50 text-amber-700",
  in_consultation: "bg-amber-50 text-amber-700",
  waiting: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  no_show: "bg-rose-50 text-rose-600",
};

type ModeFilter = "all" | "video" | "in_person";

function localIso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function shiftIso(iso: string, days: number) {
  return localIso(addDays(parseISO(iso), days));
}

function periodOf(time: string | null): "morning" | "afternoon" | "evening" | "unset" {
  if (!time) return "unset";
  const h = Number(time.split(":")[0]);
  if (Number.isNaN(h)) return "unset";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const PERIODS = [
  { key: "morning", label: "Morning", icon: Sunrise },
  { key: "afternoon", label: "Afternoon", icon: Sun },
  { key: "evening", label: "Evening", icon: Moon },
  { key: "unset", label: "No time set", icon: Clock },
] as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["in_progress", "completed", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled", "no_show"],
  waiting: ["in_consultation"],
  in_consultation: ["completed"],
};

// ─── Appointment Detail Drawer ──────────────────────────
function AppointmentDetail({
  row,
  date,
  onClose,
}: {
  row: QueueRow;
  date: string;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(row.time || "");
  const [showPreVisit, setShowPreVisit] = useState(false);

  const preVisit = useQuery({
    queryKey: ["pre-visit-summary", row.appointmentId],
    queryFn: () =>
      api<{
        summary: string;
        snapshot: any;
        generatedAt: string;
        cached: boolean;
      }>(`/doctor-portal/appointments/${row.appointmentId}/pre-visit-summary`),
    enabled: showPreVisit,
  });

  const sendPreVisit = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/appointments/${row.appointmentId}/pre-visit-summary/send`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pre-visit-summary", row.appointmentId] });
      toast.success("Pre-visit clinical summary sent to patient");
    },
  });

  const isActive = !["cancelled", "completed", "no_show"].includes(row.status);
  const canReschedule = isActive && ["scheduled", "confirmed"].includes(row.status);

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/doctor-portal/appointments/${row.appointmentId}/status`, {
        method: "POST",
        json: { status },
      }),
    onSuccess: () => {
      toast.success("Appointment updated");
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
      onClose();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const reschedule = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/appointments/${row.appointmentId}/reschedule`, {
        method: "PATCH",
        json: { date: newDate, time: newTime },
      }),
    onSuccess: () => {
      toast.success("Appointment rescheduled");
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", newDate] });
      onClose();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const router = useRouter();
  const startVideoVisit = useMutation({
    mutationFn: (appointmentId: string) =>
      teleconsultApi.createSession(appointmentId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.teleconsultActive });
      router.push(`/portal/teleconsult/${data.roomId}`);
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.scheduled;

  return (
    <div className="flex flex-col gap-4">
      {/* Patient info card */}
      <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50 p-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#07233a] text-sm font-semibold text-white">
          {(row.patientName ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900 truncate">
            {row.patientName ?? "Consultation Patient"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.time ? formatTime(`1970-01-01T${row.time}`) : "—"}
            {row.queueNumber ? ` · Token #${row.queueNumber}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Pill tone={cfg.tone}>{row.status.replace("_", " ")}</Pill>
          {row.mode === "video" ? (
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-100 text-sky-800 flex items-center gap-1">
              <Video size={10} /> Video Call
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
              In-Person
            </span>
          )}
        </div>
      </div>

      {/* Date & Time Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3.5">
          <div className="text-xs font-medium text-slate-400">Date</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {format(parseISO(date), "EEE, MMM d, yyyy")}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3.5">
          <div className="text-xs font-medium text-slate-400">Scheduled Time</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {row.time ? formatTime(`1970-01-01T${row.time}`) : "Not specified"}
          </div>
        </div>
      </div>

      {row.reason && (
        <div className="rounded-xl bg-slate-50 p-3.5">
          <div className="text-xs font-medium text-slate-400">Reason for Visit</div>
          <div className="text-sm text-slate-800 mt-1">{row.reason}</div>
        </div>
      )}

      {/* Pre-visit AI Briefing */}
      <div className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.25)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-900">Pre-Visit Clinical Briefing</div>
            <div className="text-xs text-slate-500 mt-0.5">
              AI summary of allergies, active meds, and recent lab telemetry.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPreVisit((s) => !s)}
            className="h-8 rounded-lg bg-sky-50 px-3 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
          >
            {showPreVisit ? "Hide" : "View"}
          </button>
        </div>

        {showPreVisit && (
          <div className="pt-2 border-t border-sky-200/60 flex flex-col gap-2.5">
            {preVisit.isLoading ? (
              <div className="text-xs text-slate-400">Synthesizing clinical summary…</div>
            ) : preVisit.data ? (
              <>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {preVisit.data.summary}
                </div>
                {preVisit.data.snapshot?.redBanner?.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                    <strong>Critical Allergies:</strong>{" "}
                    {preVisit.data.snapshot.redBanner.map((a: any) => a.substance).join(", ")}
                  </div>
                )}
                {preVisit.data.snapshot?.chronicConditions?.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <strong>Chronic Conditions:</strong>{" "}
                    {preVisit.data.snapshot.chronicConditions.map((c: any) => c.title).join(", ")}
                  </div>
                )}
                {preVisit.data.snapshot?.activeMedicines?.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <strong>Active Medications:</strong>{" "}
                    {preVisit.data.snapshot.activeMedicines.map((m: any) => m.name).join(", ")}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={sendPreVisit.isPending}
                    onClick={() => sendPreVisit.mutate()}
                    className="text-xs font-bold text-sky-700 hover:underline"
                  >
                    {sendPreVisit.isPending ? "Sending…" : "Re-send Patient Briefing Email"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">No briefing available yet.</div>
            )}
          </div>
        )}
      </div>

      {/* Reschedule Box */}
      {showReschedule && (
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Reschedule Consultation</h4>
          <Input
            type="date"
            label="New Date"
            value={newDate}
            min={localIso(new Date())}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <Input
            type="time"
            label="New Time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={reschedule.isPending || !newDate || !newTime}
              onClick={() => reschedule.mutate()}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs"
            >
              Confirm Reschedule
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
        <Link
          href={`/portal/patients/${row.patientId}/overview`}
          className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1"
        >
          <span>Open Full Patient Electronic Chart</span>
          <ChevronRightIcon size={14} />
        </Link>

        {isActive &&
          row.appointmentId &&
          (row.status === "confirmed" || row.status === "in_progress") && (
            <button
              type="button"
              disabled={startVideoVisit.isPending}
              onClick={() => startVideoVisit.mutate(row.appointmentId!)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#07233a] text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              <Video size={15} />
              <span>Launch Teleconsultation Session</span>
            </button>
          )}

        {canReschedule && !showReschedule && (
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] transition-colors hover:text-sky-700"
          >
            <Clock size={14} />
            <span>Reschedule Appointment</span>
          </button>
        )}

        {isActive && row.appointmentId && (
          <button
            type="button"
            disabled={updateStatus.isPending}
            onClick={() => {
              if (confirm("Are you sure you want to cancel this appointment?")) {
                updateStatus.mutate("cancelled");
              }
            }}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <AlertTriangle size={14} />
            <span>Cancel Appointment</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const t = useT();
  void t;
  const router = useRouter();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => localIso(new Date()));
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);
  const [mode, setMode] = useState<ModeFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "queue", date],
    queryFn: () => api<QueueResp>(`/doctor-portal/queue?date=${date}`),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      api(`/doctor-portal/appointments/${vars.id}/status`, {
        method: "POST",
        json: { status: vars.status },
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Marked as ${vars.status.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const rows = data?.queue ?? [];
  const videoRows = rows.filter((r) => r.mode === "video");
  const inPersonRows = rows.filter((r) => r.mode !== "video");
  const completed = rows.filter((r) => r.status === "completed").length;
  const cancelled = rows.filter((r) => r.status === "cancelled" || r.status === "no_show").length;
  const live = rows.length - cancelled;

  const visible = rows
    .filter((r) => (mode === "all" ? true : mode === "video" ? r.mode === "video" : r.mode !== "video"))
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  const grouped = PERIODS.map((p) => ({ ...p, rows: visible.filter((r) => periodOf(r.time) === p.key) })).filter(
    (g) => g.rows.length > 0,
  );

  const today = localIso(new Date());
  const isToday = date === today;
  const nextUp = isToday
    ? visible.find((r) => r.status === "scheduled" || r.status === "confirmed" || r.status === "in_progress")
    : undefined;

  const startVideoVisit = useMutation({
    mutationFn: (appointmentId: string) =>
      teleconsultApi.createSession(appointmentId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.teleconsultActive });
      router.push(`/portal/teleconsult/${data.roomId}`);
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const dayLabel = isToday
    ? "Today"
    : date === shiftIso(today, 1)
      ? "Tomorrow"
      : date === shiftIso(today, -1)
        ? "Yesterday"
        : format(parseISO(date), "EEEE");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      <div>
        <DoctorHero
          kickerIcon={<Calendar size={13} aria-hidden />}
          kicker="Appointments"
          kickerMeta={format(parseISO(date), "EEEE, MMMM d, yyyy")}
          title={`${dayLabel}'s appointments`}
          description={
            isLoading
              ? "Loading bookings…"
              : rows.length === 0
                ? "No bookings for this day. Open slots from your availability, or move to another date."
                : nextUp
                  ? `${live} booked · next up ${nextUp.time ? formatTime(`1970-01-01T${nextUp.time}`) : ""} with ${nextUp.patientName ?? "a patient"}.`
                  : `${live} booked · ${completed} completed.`
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <Video size={12} className="text-sky-300" aria-hidden />
                {videoRows.length} video
              </span>
              <span className={HERO_CHIP}>
                <Stethoscope size={12} className="text-emerald-300" aria-hidden />
                {inPersonRows.length} in-person
              </span>
            </>
          }
          actions={
            <>
              <div className="flex h-10 items-center gap-0.5 rounded-[10px] border border-white/20 bg-white/[0.06] p-1">
                <button
                  type="button"
                  onClick={() => setDate((d) => shiftIso(d, -1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/15"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Choose date"
                  className="h-8 rounded-lg bg-transparent px-2 text-sm font-semibold text-white [color-scheme:dark] focus:bg-white/10 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDate((d) => shiftIso(d, 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white transition-colors hover:bg-white/15"
                  aria-label="Next day"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDate(today)}
                  disabled={isToday}
                  className="h-8 rounded-lg px-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  Today
                </button>
              </div>
              <Link href="/portal/availability" className={HERO_PRIMARY}>
                <CalendarPlus size={15} className="text-sky-600" aria-hidden />
                Manage slots
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Booked"
            icon={<CalendarCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading ? "…" : String(live)}
            sub={cancelled > 0 ? `${cancelled} cancelled or no-show` : "Active bookings"}
            active={mode === "all"}
            onClick={() => setMode("all")}
          />
          <StatTile
            label="Video visits"
            icon={<Video size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={isLoading ? "…" : String(videoRows.length)}
            sub="Telehealth sessions"
            active={mode === "video"}
            onClick={() => setMode("video")}
          />
          <StatTile
            label="In-person"
            icon={<Stethoscope size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={isLoading ? "…" : String(inPersonRows.length)}
            sub="At the clinic"
            active={mode === "in_person"}
            onClick={() => setMode("in_person")}
          />
          <StatTile
            label="Completed"
            icon={<CheckCircle2 size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={isLoading ? "…" : `${completed}`}
            unit={live > 0 ? `of ${live}` : undefined}
            sub={live > 0 ? `${Math.max(0, live - completed)} still to see` : "Nothing pending"}
            progress={live > 0 ? Math.round((completed / live) * 100) : null}
            href="/portal/queue"
          />
        </HeroOverlap>
      </div>

      <section className={cn(PANEL, "p-0 sm:p-0")} aria-label="Appointments">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
              {format(parseISO(date), "EEEE, MMMM d")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {visible.length} encounter{visible.length === 1 ? "" : "s"}
              {mode !== "all" ? ` · ${mode === "video" ? "video only" : "in-person only"}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<ModeFilter>
              ariaLabel="Visit mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "all", label: "All", count: rows.length },
                { value: "video", label: "Video", count: videoRows.length, icon: <Video size={12} aria-hidden /> },
                { value: "in_person", label: "In-person", count: inPersonRows.length, icon: <Stethoscope size={12} aria-hidden /> },
              ]}
            />
            <Link
              href="/portal/queue"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
            >
              <ListOrdered size={14} aria-hidden />
              Live queue
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyBlock
              className="mt-0 py-12"
              icon={<CalendarCheck size={20} />}
              title={rows.length === 0 ? `No appointments ${isToday ? "today" : `on ${format(parseISO(date), "MMM d")}`}` : "Nothing matches this filter"}
              body={
                rows.length === 0
                  ? "Your calendar is clear. Open booking slots, check in walk-ins, or jump to another date."
                  : "Switch the filter to see the rest of the day."
              }
              actions={
                <>
                  <PrimaryLink href="/portal/availability" icon={<CalendarPlus size={13} />}>
                    Open slots
                  </PrimaryLink>
                  <SecondaryLink href="/portal/walk-ins" icon={<DoorOpen size={13} />}>
                    Check in walk-in
                  </SecondaryLink>
                </>
              }
            />
          </div>
        ) : (
          <div className="pb-2">
            {grouped.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-6">
                    <Icon size={13} className="text-slate-400" aria-hidden />
                    <span className="text-xs font-semibold text-slate-500">{g.label}</span>
                    <span className="text-xs text-slate-400">{g.rows.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {g.rows.map((r, i) => {
                      const acting =
                        update.isPending && update.variables?.id === (r.appointmentId ?? r.walkInId);
                      const primary = r.appointmentId ? PRIMARY_NEXT[r.status] : undefined;
                      const others: string[] = (r.appointmentId ? ALLOWED_TRANSITIONS[r.status] ?? [] : []).filter(
                        (s) => s !== primary?.status,
                      );
                      const isVideoActive =
                        r.mode === "video" &&
                        (r.status === "scheduled" || r.status === "confirmed" || r.status === "in_progress");
                      const done = r.status === "completed" || r.status === "cancelled" || r.status === "no_show";
                      const isNext = nextUp && (nextUp.appointmentId ?? nextUp.walkInId) === (r.appointmentId ?? r.walkInId);

                      return (
                        <li
                          key={`${r.kind}-${r.appointmentId ?? r.walkInId ?? i}`}
                          className={cn(
                            "relative flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 sm:flex-nowrap sm:px-6",
                            isNext && "bg-sky-50/50",
                          )}
                        >
                          {isNext ? (
                            <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sky-500" aria-hidden />
                          ) : null}

                          <div className="w-16 shrink-0">
                            <div className={cn("text-sm font-semibold tabular-nums", done ? "text-slate-400" : "text-slate-900")}>
                              {r.time ? formatTime(`1970-01-01T${r.time}`) : "—"}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-slate-400">
                              {isNext ? <span className="font-semibold uppercase tracking-wider text-sky-600">Next</span> : r.queueNumber != null ? `Token #${r.queueNumber}` : r.kind === "walkin" ? "Walk-in" : " "}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedRow(r)}
                            className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className="relative shrink-0">
                              <Avatar name={r.patientName} src={r.patientPhoto ?? null} size="sm" />
                              {r.mode === "video" ? (
                                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-violet-500 text-white ring-2 ring-white" aria-hidden>
                                  <Video size={9} />
                                </span>
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span className={cn("block truncate text-sm font-semibold group-hover:text-sky-700", done ? "text-slate-500" : "text-slate-900")}>
                                {r.patientName ?? "Walk-in patient"}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {r.reason ?? "General consultation"}
                                {r.hospitalName ? ` · ${r.hospitalName}` : ""}
                              </span>
                            </span>
                          </button>

                          <span className={cn("hidden shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold capitalize md:inline", STATUS_CHIP[r.status] ?? STATUS_CHIP.scheduled)}>
                            {(STATUS_CONFIG[r.status]?.label ?? r.status.replace(/_/g, " ")).toLowerCase()}
                          </span>

                          <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
                            {isVideoActive && r.appointmentId ? (
                              <button
                                type="button"
                                disabled={startVideoVisit.isPending}
                                onClick={() => startVideoVisit.mutate(r.appointmentId!)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
                              >
                                <Video size={13} aria-hidden />
                                Join
                              </button>
                            ) : null}

                            {others.length > 0 ? (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value && r.appointmentId) {
                                    update.mutate({ id: r.appointmentId, status: e.target.value });
                                  }
                                }}
                                disabled={acting}
                                aria-label="More status actions"
                                className="h-8 rounded-lg bg-white px-2 text-xs font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] focus:outline-none"
                              >
                                <option value="">More…</option>
                                {others.map((st) => (
                                  <option key={st} value={st}>
                                    {st.replace(/_/g, " ")}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {primary && r.appointmentId ? (
                              <Button
                                size="sm"
                                variant="primary"
                                leftIcon={primary.status === "completed" ? <Check size={12} /> : primary.status === "in_progress" ? <Play size={11} /> : <CalendarCheck size={12} />}
                                loading={acting}
                                onClick={() => update.mutate({ id: r.appointmentId!, status: primary.status })}
                              >
                                {primary.label}
                              </Button>
                            ) : done ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <CheckCircle2 size={13} aria-hidden />
                                Closed
                              </span>
                            ) : null}

                            <Link
                              href={`/portal/patients/${r.patientId}/overview`}
                              title="Open patient chart"
                              aria-label={`Open ${r.patientName ?? "patient"}'s chart`}
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Drawer
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title="Appointment details"
        subtitle={selectedRow?.patientName ?? undefined}
        size="md"
      >
        {selectedRow && (
          <AppointmentDetail
            row={selectedRow}
            date={date}
            onClose={() => setSelectedRow(null)}
          />
        )}
      </Drawer>
    </div>
  );
}
