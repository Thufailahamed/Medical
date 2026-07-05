"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface QueueRow {
  kind: "appointment" | "walkin";
  appointmentId?: string;
  walkInId?: string;
  patientId: string;
  patientName: string | null;
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

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger" | "violet"> = {
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

export default function AppointmentsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

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
          <h1 className="text-2xl font-semibold text-text">{t("appointments.title")}</h1>
          <p className="text-sm text-text-soft mt-1">
            {format(parseISO(date), "EEEE, MMM d, yyyy")} · {rows.length} entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<ChevronLeft size={14} />}
            onClick={() => setDate((d) => addDays(parseISO(d), -1).toISOString().slice(0, 10))}
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
            onClick={() => setDate((d) => addDays(parseISO(d), 1).toISOString().slice(0, 10))}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDate(new Date().toISOString().slice(0, 10))}
          >
            Today
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
              const acting = update.isPending && update.variables?.id === (r.appointmentId ?? r.walkInId);
              const nextStatuses: string[] = r.appointmentId
                ? ALLOWED_TRANSITIONS[r.status] ?? []
                : [];
              return (
                <li
                  key={`${r.kind}-${r.appointmentId ?? r.walkInId ?? i}`}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  {r.kind === "appointment" ? (
                    <Calendar size={14} className="text-brand shrink-0" />
                  ) : (
                    <CalendarCheck size={14} className="text-violet shrink-0" />
                  )}
                  <span className="font-mono text-xs tabular-nums text-text-soft w-12 shrink-0">
                    {r.time ? formatTime(`1970-01-01T${r.time}`) : "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        {r.patientName ?? t("walkins.unknownPatient")}
                      </span>
                      {r.queueNumber ? (
                        <Pill tone="neutral">Q#{r.queueNumber}</Pill>
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
                    Open
                  </Link>
                  {r.appointmentId && nextStatuses.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && r.appointmentId) {
                          update.mutate({ id: r.appointmentId, status: e.target.value });
                        }
                      }}
                      disabled={acting}
                      className={cn(
                        "h-7 px-2 rounded-md border border-border bg-surface text-xs text-text focus-ring",
                        acting && "opacity-50"
                      )}
                    >
                      <option value="">Transition…</option>
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
    </div>
  );
}