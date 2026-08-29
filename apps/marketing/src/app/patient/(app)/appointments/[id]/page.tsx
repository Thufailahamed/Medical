"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useAppointmentRecords,
  useCancelAppointment,
  useRescheduleAppointment,
} from "@/patient/hooks";
import { formatDayLabel, formatTime, humanize } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const query = useAppointmentRecords(id);
  const cancel = useCancelAppointment();
  const reschedule = useRescheduleAppointment();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Your calendar"
        title="Appointment details"
        description="Review this visit, manage its time, and open related records."
      />
      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="Appointment not found"
          emptyDescription="This appointment may have been cancelled or is no longer available."
        >
          {(data) => {
            const appointment = data.appointment;
            const canManage = ["scheduled", "confirmed"].includes(appointment.status);
            const onCancel = async () => {
              if (!window.confirm("Cancel this appointment?")) return;
              setActionError(null);
              try {
                await cancel.mutateAsync(id);
                router.replace("/patient/appointments");
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "Could not cancel appointment.");
              }
            };
            const onReschedule = async (event: React.FormEvent) => {
              event.preventDefault();
              if (!date || !time) return;
              setActionError(null);
              try {
                await reschedule.mutateAsync({ id, date, time });
                setEditing(false);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "Could not reschedule appointment.");
              }
            };

            return (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(appointment.status)}>{humanize(appointment.status)}</Pill>
                  <Pill tone={appointment.mode === "video" ? "brand" : "neutral"}>
                    {humanize(appointment.mode)}
                  </Pill>
                  {appointment.paymentStatus ? <Pill tone="info">{humanize(appointment.paymentStatus)}</Pill> : null}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text">
                    {appointment.doctorName ?? "Doctor"}
                  </h1>
                  <p className="mt-1 text-sm text-text-soft">
                    {appointment.doctorSpecialization ?? "Care team visit"}
                    {appointment.hospitalName ? ` · ${appointment.hospitalName}` : ""}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-text">
                    {formatDayLabel(appointment.date)} · {formatTime(appointment.time)}
                  </p>
                  {appointment.reason ? <p className="mt-2 text-sm text-text-soft">{appointment.reason}</p> : null}
                </div>

                {actionError ? <p role="alert" className="text-sm text-danger">{actionError}</p> : null}

                {canManage && !editing ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDate(appointment.date);
                        setTime(appointment.time);
                        setEditing(true);
                      }}
                      className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={reschedule.isPending || cancel.isPending}
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-pill bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                      disabled={reschedule.isPending || cancel.isPending}
                    >
                      {cancel.isPending ? "Cancelling…" : "Cancel appointment"}
                    </button>
                  </div>
                ) : null}

                {editing ? (
                  <form onSubmit={onReschedule} className="flex flex-wrap items-end gap-3 rounded-inner bg-surface-2 p-4">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">
                      Date
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        required
                        className="h-10 rounded-inner border border-border bg-surface px-3 text-sm text-text"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">
                      Time
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        required
                        className="h-10 rounded-inner border border-border bg-surface px-3 text-sm text-text"
                      />
                    </label>
                    <button type="submit" disabled={reschedule.isPending} className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {reschedule.isPending ? "Saving…" : "Save time"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded-pill border border-border px-4 py-2 text-sm font-semibold text-text-soft">
                      Keep current time
                    </button>
                  </form>
                ) : null}

                <div className="border-t border-surface-3 pt-4">
                  <p className="t-label">Related records</p>
                  {data.records.length ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {data.records.map((record) => (
                        <li key={record.id}>
                          <button
                            type="button"
                            onClick={() => router.push(`/patient/records/${record.id}`)}
                            className="flex w-full items-center gap-3 rounded-inner bg-surface-2 px-3 py-3 text-left hover:bg-surface-3"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{record.title}</span>
                            <Pill tone="info">{humanize(record.recordType)}</Pill>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-text-soft">No records are attached to this appointment yet.</p>
                  )}
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

function statusTone(status: string): "success" | "warn" | "danger" | "neutral" | "info" {
  if (status === "confirmed" || status === "completed") return "success";
  if (status === "scheduled") return "info";
  if (status === "in_progress") return "warn";
  if (status === "cancelled" || status === "no_show") return "danger";
  return "neutral";
}
