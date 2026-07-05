"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, DoorOpen, Filter } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface WalkIn {
  id: string;
  patientId: string;
  patientName: string | null;
  patientPhone?: string | null;
  doctorId: string;
  doctorName: string | null;
  arrivedAt: string;
  reason: string | null;
  priority: string;
  status: string;
  notes?: string | null;
  hospitalName?: string | null;
}

type StatusFilter = "all" | "waiting" | "in_consultation" | "completed" | "no_show";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger" | "violet"> = {
  waiting: "warn",
  in_consultation: "brand",
  completed: "success",
  no_show: "danger",
};

export default function WalkInsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("waiting");

  const { data, isLoading } = useQuery({
    queryKey: ["walk-ins", "queue", status],
    queryFn: () =>
      api<{ walkIns: WalkIn[] }>(`/walk-ins?status=${status}&limit=200`),
  });

  const transitions = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      api(`/walk-ins/${vars.id}`, {
        method: "PATCH",
        json: { status: vars.status },
      }),
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${vars.status.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  const rows = data?.walkIns ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("walkins.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("walkins.subtitle")}</p>
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {(["waiting", "in_consultation", "completed", "no_show", "all"] as StatusFilter[]).map((s) => {
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "px-2.5 h-7 rounded-md text-xs border transition-colors",
                  active
                    ? "bg-brand-soft text-brand border-brand/30"
                    : "bg-surface text-text-soft border-border hover:bg-surface-2"
                )}
              >
                {t(`walkins.status.${s}`)}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("walkins.empty", { status })} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((w) => {
              const acting = transitions.isPending && transitions.variables?.id === w.id;
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  <DoorOpen size={14} className="text-violet shrink-0" />
                  <span className="font-mono text-xs text-text-soft w-12 tabular-nums shrink-0">
                    {formatTime(w.arrivedAt)}
                  </span>
                  <Pill tone={w.priority === "urgent" ? "danger" : "neutral"}>
                    {w.priority}
                  </Pill>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">
                      <span className="font-medium">{w.patientName ?? t("walkins.unknownPatient")}</span>
                      {w.patientPhone ? (
                        <span className="text-text-muted"> · {w.patientPhone}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-text-soft truncate">
                      {w.reason ?? t("walkins.noReason")} · {w.doctorName ?? "—"}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Arrived {relativeTime(w.arrivedAt)}
                    </div>
                  </div>
                  <Pill tone={STATUS_TONE[w.status] ?? "neutral"}>
                    {w.status.replace("_", " ")}
                  </Pill>
                  {w.status === "waiting" ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={acting}
                        onClick={() =>
                          transitions.mutate({ id: w.id, status: "in_consultation" })
                        }
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => transitions.mutate({ id: w.id, status: "no_show" })}
                      >
                        <X size={12} />
                      </Button>
                    </>
                  ) : null}
                  {w.status === "in_consultation" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Check size={12} />}
                      loading={acting}
                      onClick={() => transitions.mutate({ id: w.id, status: "completed" })}
                    >
                      Complete
                    </Button>
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