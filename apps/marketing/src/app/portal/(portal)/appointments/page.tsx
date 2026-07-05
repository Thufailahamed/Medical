"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  UserPlus,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
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
}

interface QueueResp {
  date: string;
  count: number;
  queue: QueueRow[];
}

// ─── Constants ──────────────────────────────────────────

const STATUS_TONE: Record<
  string,
  "neutral" | "brand" | "success" | "warn" | "danger" | "violet"
> = {
  scheduled: "brand",
  confirmed: "brand",
  in_progress: "brand",
  in_consultation: "brand",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
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

  const isActive = !["cancelled", "completed", "no_show"].includes(
    row.status
  );
  const canReschedule =
    isActive && ["scheduled", "confirmed"].includes(row.status);

  // Status transition mutation
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

  // Reschedule mutation
  const reschedule = useMutation({
    mutationFn: () =>
      api(`/doctor-portal/appointments/${row.appointmentId}/reschedule`, {
        method: "PATCH",
        json: { date: newDate, time: newTime },
      }),
    onSuccess: () => {
      toast.success(t("appointments.rescheduled"));
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue", date] });
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "queue", newDate],
      });
      onClose();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Patient info */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2">
        <div className="h-10 w-10 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-semibold">
          {(row.patientName ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">
            {row.patientName ?? t("walkins.unknownPatient")}
          </div>
          <div className="text-xs text-text-soft">
            {row.time ? formatTime(`1970-01-01T${row.time}`) : "—"}
            {row.queueNumber ? ` · Queue #${row.queueNumber}` : ""}
          </div>
        </div>
        <Pill tone={STATUS_TONE[row.status] ?? "neutral"}>
          {row.status.replace("_", " ")}
        </Pill>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-surface-2">
          <div className="text-[10px] uppercase text-text-muted">
            {t("common.date")}
          </div>
          <div className="text-sm font-medium text-text mt-0.5">
            {format(parseISO(date), "EEE, MMM d, yyyy")}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-2">
          <div className="text-[10px] uppercase text-text-muted">
            {t("common.time")}
          </div>
          <div className="text-sm font-medium text-text mt-0.5">
            {row.time
              ? formatTime(`1970-01-01T${row.time}`)
              : "—"}
          </div>
        </div>
      </div>

      {row.reason && (
        <div className="p-3 rounded-lg bg-surface-2">
          <div className="text-[10px] uppercase text-text-muted">
            {t("appointments.reason")}
          </div>
          <div className="text-sm text-text mt-0.5">{row.reason}</div>
        </div>
      )}

      {/* Reschedule form */}
      {showReschedule && (
        <Card className="border-brand">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium text-text">
              {t("appointments.reschedule")}
            </div>
            <Input
              type="date"
              label={t("appointments.newDate")}
              value={newDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <Input
              type="time"
              label={t("appointments.newTime")}
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReschedule(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                loading={reschedule.isPending}
                disabled={
                  reschedule.isPending ||
                  !newDate ||
                  !newTime ||
                  (newDate === date && newTime === row.time)
                }
                onClick={() => reschedule.mutate()}
              >
                {t("appointments.reschedule")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <Link
          href={`/patients/${row.patientId}`}
          className="text-sm text-brand hover:underline"
        >
          {t("appointments.openChart")} →
        </Link>

        {canReschedule && !showReschedule && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Clock size={14} />}
            onClick={() => setShowReschedule(true)}
          >
            {t("appointments.reschedule")}
          </Button>
        )}

        {isActive && row.appointmentId && (
          <Button
            size="sm"
            variant="danger"
            leftIcon={<AlertTriangle size={14} />}
            loading={updateStatus.isPending}
            disabled={updateStatus.isPending}
            onClick={() => {
              if (confirm(t("appointments.cancelConfirm"))) {
                updateStatus.mutate("cancelled");
              }
            }}
          >
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
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            {t("appointments.title")}
          </h1>
          <p className="text-sm text-text-soft mt-1">
            {format(parseISO(date), "EEEE, MMM d, yyyy")} · {rows.length}{" "}
            entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/book-appointment">
            <Button
              size="sm"
              leftIcon={<UserPlus size={14} />}
            >
              {t("appointments.bookForPatient")}
            </Button>
          </Link>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ChevronLeft size={14} />}
            onClick={() =>
              setDate((d) =>
                addDays(parseISO(d), -1).toISOString().slice(0, 10)
              )
            }
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-surface text-sm text-text focus-ring focus:border-brand"
          />
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ChevronRight size={14} />}
            onClick={() =>
              setDate((d) =>
                addDays(parseISO(d), 1).toISOString().slice(0, 10)
              )
            }
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setDate(new Date().toISOString().slice(0, 10))
            }
          >
            {t("common.today")}
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("appointments.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((r, i) => {
              const acting =
                update.isPending &&
                update.variables?.id ===
                  (r.appointmentId ?? r.walkInId);
              const nextStatuses: string[] = r.appointmentId
                ? ALLOWED_TRANSITIONS[r.status] ?? []
                : [];
              return (
                <li
                  key={`${r.kind}-${r.appointmentId ?? r.walkInId ?? i}`}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  {r.kind === "appointment" ? (
                    <Calendar
                      size={14}
                      className="text-brand shrink-0"
                    />
                  ) : (
                    <CalendarCheck
                      size={14}
                      className="text-violet shrink-0"
                    />
                  )}
                  <span className="font-mono text-xs tabular-nums text-text-soft w-12 shrink-0">
                    {r.time
                      ? formatTime(`1970-01-01T${r.time}`)
                      : "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(r)}
                        className="text-sm font-medium text-text truncate hover:text-brand hover:underline text-left"
                      >
                        {r.patientName ??
                          t("walkins.unknownPatient")}
                      </button>
                      {r.queueNumber ? (
                        <Pill tone="neutral">
                          Q#{r.queueNumber}
                        </Pill>
                      ) : null}
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {r.reason ?? "—"}
                    </div>
                  </div>
                  <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {r.status.replace("_", " ")}
                  </Pill>
                  <Link
                    href={`/patients/${r.patientId}`}
                    className="text-xs text-brand hover:underline shrink-0"
                  >
                    {t("common.open")}
                  </Link>
                  {r.appointmentId && nextStatuses.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && r.appointmentId) {
                          update.mutate({
                            id: r.appointmentId,
                            status: e.target.value,
                          });
                        }
                      }}
                      disabled={acting}
                      className={cn(
                        "h-7 px-2 rounded-md border border-border bg-surface text-xs text-text focus-ring",
                        acting && "opacity-50"
                      )}
                    >
                      <option value="">
                        {t("common.actions")}…
                      </option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Appointment detail drawer */}
      <Drawer
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={t("appointments.details")}
        subtitle={
          selectedRow?.patientName ?? undefined
        }
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
