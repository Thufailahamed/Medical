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
} from "lucide-react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { api, teleconsultApi, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
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
      <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-sky-50/50 border border-sky-200/80">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center text-sm font-extrabold shadow-sm">
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
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400">Date</div>
          <div className="text-sm font-bold text-slate-900 mt-1">
            {format(parseISO(date), "EEE, MMM d, yyyy")}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400">Scheduled Time</div>
          <div className="text-sm font-bold text-slate-900 mt-1">
            {row.time ? formatTime(`1970-01-01T${row.time}`) : "Not specified"}
          </div>
        </div>
      </div>

      {row.reason && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400">Reason for Visit</div>
          <div className="text-sm text-slate-800 mt-1">{row.reason}</div>
        </div>
      )}

      {/* Pre-visit AI Briefing */}
      <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/40 flex flex-col gap-3">
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
            className="px-3 py-1 rounded-xl text-xs font-bold text-sky-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
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
        <div className="p-4 rounded-2xl border border-sky-300 bg-sky-50/60 flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">Reschedule Consultation</h4>
          <Input
            type="date"
            label="New Date"
            value={newDate}
            min={new Date().toISOString().slice(0, 10)}
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
              className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <Video size={15} />
              <span>Launch Teleconsultation Session</span>
            </button>
          )}

        {canReschedule && !showReschedule && (
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            className="w-full h-10 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
            className="w-full h-10 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
  const router = useRouter();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null);

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

  const startVideoVisit = useMutation({
    mutationFn: (appointmentId: string) =>
      teleconsultApi.createSession(appointmentId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.teleconsultActive });
      router.push(`/portal/teleconsult/${data.roomId}`);
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Doctor Appointments Hero ─────────────────── */}
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
                <Calendar size={12} className="text-sky-300" />
                Scheduled Encounters &amp; Telehealth
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Patient Appointments
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                {format(parseISO(date), "EEEE, MMMM d, yyyy")} · Manage booked consultations, launch encrypted video visits, and review AI pre-visit clinical summaries.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {/* Date Controls */}
              <div className="flex items-center gap-1 bg-white/15 border border-white/25 rounded-xl p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setDate((d) => addDays(parseISO(d), -1).toISOString().slice(0, 10))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-white/20 text-xs font-bold text-white border-0 focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setDate((d) => addDays(parseISO(d), 1).toISOString().slice(0, 10))}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                  className="px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20 rounded-lg transition-all cursor-pointer ml-0.5"
                >
                  Today
                </button>
              </div>

              <Link
                href="/portal/schedule"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <CalendarPlus size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Manage Slots</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <CalendarCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Bookings
                </p>
                <p className="text-base font-extrabold text-white">
                  {rows.length} Scheduled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Video size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-purple-200 truncate">
                  Telehealth HD
                </p>
                <p className="text-base font-extrabold text-white">
                  {videoRows.length} Video Visit{videoRows.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-emerald-200 truncate">
                  In-Person Clinic
                </p>
                <p className="text-base font-extrabold text-white">
                  {inPersonRows.length} At Hospital
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <DoorOpen size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Live Queue
                </p>
                <p className="text-base font-extrabold text-white">
                  Realtime Synced
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Appointments List Stage ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              Encounter Roster ({rows.length})
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {format(parseISO(date), "EEEE, MMMM d")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/portal/queue"
              className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors flex items-center gap-1"
            >
              <ListOrdered size={13} />
              <span>Combined Queue</span>
            </Link>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="p-5 flex flex-col gap-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : rows.length === 0 ? (
            /* Rich Clinical Empty State */
            <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
                <CalendarCheck size={26} />
              </div>
              <div className="max-w-md">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  No Appointments for This Date
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {format(parseISO(date), "EEEE, MMMM d, yyyy")} · Your consultation calendar is clear. You can open booking slots on your schedule, check in arriving walk-in patients, or review the combined queue.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <Link
                  href="/portal/schedule"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  <CalendarPlus size={14} />
                  <span>Open Schedule Slots</span>
                </Link>
                <Link
                  href="/portal/walk-ins"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <DoorOpen size={14} />
                  <span>Check-In Walk-In</span>
                </Link>
                <Link
                  href="/portal/queue"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ListOrdered size={14} />
                  <span>Live Queue</span>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const acting =
                  update.isPending &&
                  update.variables?.id === (r.appointmentId ?? r.walkInId);
                const nextStatuses: string[] = r.appointmentId
                  ? ALLOWED_TRANSITIONS[r.status] ?? []
                  : [];
                const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.scheduled;
                const isVideoActive =
                  r.mode === "video" &&
                  (r.status === "scheduled" ||
                    r.status === "confirmed" ||
                    r.status === "in_progress");

                return (
                  <li
                    key={`${r.kind}-${r.appointmentId ?? r.walkInId ?? i}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-sky-50/30 transition-all group"
                  >
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center text-sm font-extrabold shadow-2xs shrink-0">
                      {(r.patientName ?? "?").slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(r)}
                          className="text-sm font-bold text-slate-900 truncate hover:text-sky-700 hover:underline text-left cursor-pointer"
                        >
                          {r.patientName ?? "Walk-In Patient"}
                        </button>
                        {r.queueNumber != null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Token #{r.queueNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-mono tabular-nums font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.time ? formatTime(`1970-01-01T${r.time}`) : "Time not set"}
                        </span>
                        <span>·</span>
                        <span className="truncate">{r.reason ?? "General clinical encounter"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Pill tone={cfg.tone}>{r.status.replace("_", " ")}</Pill>

                      {r.mode === "video" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-100 text-sky-800 flex items-center gap-1">
                          <Video size={10} /> Video Telehealth
                        </span>
                      ) : r.mode === "in_person" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                          In-Person
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {isVideoActive && r.appointmentId && (
                        <button
                          type="button"
                          disabled={startVideoVisit.isPending}
                          onClick={() => startVideoVisit.mutate(r.appointmentId!)}
                          className="h-8 px-3 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                          }}
                        >
                          <Video size={12} />
                          <span>Video Visit</span>
                        </button>
                      )}

                      {r.appointmentId && nextStatuses.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value && r.appointmentId) {
                              update.mutate({ id: r.appointmentId, status: e.target.value });
                            }
                          }}
                          disabled={acting}
                          className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-sky-300 cursor-pointer focus:outline-none"
                        >
                          <option value="">Actions…</option>
                          {nextStatuses.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      )}

                      <Link
                        href={`/portal/patients/${r.patientId}/overview`}
                        className="h-8 px-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1"
                        title="Open Patient Chart"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Drawer
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title="Appointment Details"
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
