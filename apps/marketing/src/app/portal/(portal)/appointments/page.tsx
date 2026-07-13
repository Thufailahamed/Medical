"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  UserPlus,
  Clock,
  AlertTriangle,
  ChevronRight as ChevronRightIcon,
  Video,
} from "lucide-react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { api, teleconsultApi, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
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
}

interface QueueResp {
  date: string;
  count: number;
  queue: QueueRow[];
}

// ─── Constants ──────────────────────────────────────────

const STATUS_CONFIG: Record<string, { tone: "neutral" | "brand" | "success" | "warn" | "danger" | "violet"; icon: typeof Calendar }> = {
  scheduled:    { tone: "brand",   icon: Calendar },
  confirmed:    { tone: "brand",   icon: Calendar },
  in_progress:  { tone: "brand",   icon: Clock },
  in_consultation: { tone: "brand", icon: Clock },
  completed:    { tone: "success", icon: CalendarCheck },
  cancelled:    { tone: "danger",  icon: AlertTriangle },
  no_show:      { tone: "danger",  icon: AlertTriangle },
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

  const isActive = !["cancelled", "completed", "no_show"].includes(row.status);
  const canReschedule = isActive && ["scheduled", "confirmed"].includes(row.status);

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/doctor-portal/appointments/${row.appointmentId}/status`, {
        method: "POST",
        json: { status },
      }),
    onSuccess: () => {
      toast.success(t("appointments.cancelled"));
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
      toast.success(t("appointments.rescheduled"));
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", newDate] });
      onClose();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  // Round 4 — In-App Video Teleconsultation. The "Start video visit"
  // button is only available on confirmed | in_progress appointments
  // (the same gate as the queue row button). Creates a session row
  // and navigates to /portal/teleconsult/[roomId] where the doctor
  // joins the WebRTC room.
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
      {/* Patient info */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-2/60 border border-border/50">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
          {(row.patientName ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text truncate">
            {row.patientName ?? t("walkins.unknownPatient")}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {row.time ? formatTime(`1970-01-01T${row.time}`) : "—"}
            {row.queueNumber ? ` · Queue #${row.queueNumber}` : ""}
          </div>
        </div>
        <Pill tone={cfg.tone}>{row.status.replace("_", " ")}</Pill>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-surface-2/40 border border-border/40">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">{t("common.date")}</div>
          <div className="text-sm font-medium text-text mt-1">{format(parseISO(date), "EEE, MMM d, yyyy")}</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-2/40 border border-border/40">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">{t("common.time")}</div>
          <div className="text-sm font-medium text-text mt-1">{row.time ? formatTime(`1970-01-01T${row.time}`) : "—"}</div>
        </div>
      </div>

      {row.reason && (
        <div className="p-3 rounded-xl bg-surface-2/40 border border-border/40">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">{t("appointments.reason")}</div>
          <div className="text-sm text-text mt-1">{row.reason}</div>
        </div>
      )}

      {/* Reschedule form */}
      {showReschedule && (
        <Card className="border-brand/30 bg-brand-soft/20">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-bold text-text">{t("appointments.reschedule")}</div>
            <Input type="date" label={t("appointments.newDate")} value={newDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setNewDate(e.target.value)} />
            <Input type="time" label={t("appointments.newTime")} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)}>{t("common.cancel")}</Button>
              <Button size="sm" loading={reschedule.isPending} disabled={reschedule.isPending || !newDate || !newTime || (newDate === date && newTime === row.time)} onClick={() => reschedule.mutate()}>{t("appointments.reschedule")}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
        <Link href={`/portal/patients/${row.patientId}`} className="text-sm text-brand font-medium hover:underline flex items-center gap-1">
          {t("appointments.openChart")} <ChevronRightIcon size={14} />
        </Link>
        {isActive &&
          row.appointmentId &&
          (row.status === "confirmed" || row.status === "in_progress") && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Video size={14} />}
              loading={startVideoVisit.isPending}
              disabled={startVideoVisit.isPending}
              onClick={() => startVideoVisit.mutate(row.appointmentId!)}
            >
              {t("consult.startVideoVisit")}
            </Button>
          )}
        {canReschedule && !showReschedule && (
          <Button size="sm" variant="secondary" leftIcon={<Clock size={14} />} onClick={() => setShowReschedule(true)}>{t("appointments.reschedule")}</Button>
        )}
        {isActive && row.appointmentId && (
          <Button size="sm" variant="danger" leftIcon={<AlertTriangle size={14} />} loading={updateStatus.isPending} disabled={updateStatus.isPending} onClick={() => { if (confirm(t("appointments.cancelConfirm"))) updateStatus.mutate("cancelled"); }}>
            {t("appointments.cancelAppointment")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function AppointmentsPage() {
  const t = useT();
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
      toast.success(`Marked ${vars.status.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const rows = data?.queue ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("appointments.title")}
        subtitle={`${format(parseISO(date), "EEEE, MMM d, yyyy")} · ${rows.length} entries`}
        icon={<Calendar size={18} className="text-brand" />}
        actions={
          <>
            <Link href="/portal/book-appointment">
              <Button size="sm" leftIcon={<UserPlus size={14} />}>{t("appointments.bookForPatient")}</Button>
            </Link>
            <div className="flex items-center gap-1.5 ml-2">
              <Button size="sm" variant="secondary" leftIcon={<ChevronLeft size={14} />} onClick={() => setDate((d) => addDays(parseISO(d), -1).toISOString().slice(0, 10))} />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 px-2 rounded-lg border border-border/80 bg-surface text-sm text-text focus-ring focus:border-brand/40" />
              <Button size="sm" variant="secondary" leftIcon={<ChevronRight size={14} />} onClick={() => setDate((d) => addDays(parseISO(d), 1).toISOString().slice(0, 10))} />
              <Button size="sm" variant="secondary" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>{t("common.today")}</Button>
            </div>
          </>
        }
      />

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("appointments.empty")} icon={<Calendar size={20} className="text-text-muted" />} className="py-12" />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r, i) => {
              const acting = update.isPending && update.variables?.id === (r.appointmentId ?? r.walkInId);
              const nextStatuses: string[] = r.appointmentId ? ALLOWED_TRANSITIONS[r.status] ?? [] : [];
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.scheduled;
              return (
                <li key={`${r.kind}-${r.appointmentId ?? r.walkInId ?? i}`} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/30 transition-colors group">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", r.kind === "appointment" ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600")}>
                    {r.kind === "appointment" ? <Calendar size={14} /> : <CalendarCheck size={14} />}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-text-soft w-14 shrink-0 font-medium">
                    {r.time ? formatTime(`1970-01-01T${r.time}`) : "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedRow(r)} className="text-sm font-medium text-text truncate hover:text-brand hover:underline text-left">
                        {r.patientName ?? t("walkins.unknownPatient")}
                      </button>
                      {r.queueNumber && <Pill tone="neutral">Q#{r.queueNumber}</Pill>}
                    </div>
                    <div className="text-xs text-text-muted truncate mt-0.5">{r.reason ?? "—"}</div>
                  </div>
                  <Pill tone={cfg.tone}>{r.status.replace("_", " ")}</Pill>
                  <Link href={`/portal/patients/${r.patientId}`} className="text-xs text-brand font-medium hover:underline shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("common.open")}
                  </Link>
                  {r.appointmentId && nextStatuses.length > 0 && (
                    <select value="" onChange={(e) => { if (e.target.value && r.appointmentId) update.mutate({ id: r.appointmentId, status: e.target.value }); }} disabled={acting} className={cn("h-7 px-2 rounded-lg border border-border/80 bg-surface text-xs text-text focus-ring", acting && "opacity-50")}>
                      <option value="">{t("common.actions")}…</option>
                      {nextStatuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Drawer open={!!selectedRow} onClose={() => setSelectedRow(null)} title={t("appointments.details")} subtitle={selectedRow?.patientName ?? undefined} size="md">
        {selectedRow && <AppointmentDetail row={selectedRow} date={date} onClose={() => setSelectedRow(null)} />}
      </Drawer>
    </div>
  );
}
