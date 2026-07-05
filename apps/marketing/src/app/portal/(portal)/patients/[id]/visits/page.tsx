"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, DoorOpen } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDateTime, relativeTime } from "@/portal/lib/format";

interface Appt {
  id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  reason?: string | null;
  type?: string;
}

interface WalkIn {
  id: string;
  patientId: string;
  arrivedAt: string;
  reason?: string | null;
  status: string;
  priority: string;
}

interface VisitsResponse {
  appointments: Appt[];
  walkIns: WalkIn[];
}

export default function VisitsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data: aptData, isLoading: aptLoading } = useQuery({
    queryKey: ["appointments", "patient", id],
    queryFn: () => api<{ appointments: Appt[] }>(`/appointments?patientId=${id}&limit=50`),
  });
  const { data: walkData, isLoading: walkLoading } = useQuery({
    queryKey: ["walk-ins", "patient", id],
    queryFn: () => api<{ walkIns: WalkIn[] }>(`/walk-ins?patientId=${id}&limit=50`),
  });

  const apts = aptData?.appointments ?? [];
  const walks = walkData?.walkIns ?? [];
  const merged = [
    ...apts.map((a) => ({
      kind: "appointment" as const,
      id: a.id,
      when: a.scheduledAt,
      reason: a.reason,
      status: a.status,
      meta: a.type,
    })),
    ...walks.map((w) => ({
      kind: "walk_in" as const,
      id: w.id,
      when: w.arrivedAt,
      reason: w.reason,
      status: w.status,
      meta: w.priority,
    })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  const isLoading = aptLoading || walkLoading;

  return (
    <Card>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : merged.length === 0 ? (
        <Empty title={t("visits.empty")} />
      ) : (
        <ul className="flex flex-col">
          {merged.map((v) => {
            const Icon = v.kind === "appointment" ? Calendar : DoorOpen;
            return (
              <li
                key={`${v.kind}-${v.id}`}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <Icon
                  size={14}
                  className={v.kind === "appointment" ? "text-brand" : "text-violet"}
                />
                <Pill tone={v.kind === "appointment" ? "brand" : "violet"}>
                  {v.kind === "appointment" ? "Appt" : "Walk-in"}
                </Pill>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{v.reason ?? "Visit"}</div>
                  <div className="text-xs text-text-muted">{relativeTime(v.when)}</div>
                </div>
                <Pill
                  tone={
                    v.status === "completed"
                      ? "success"
                      : v.status === "cancelled" || v.status === "no_show"
                        ? "danger"
                        : v.status === "in_progress"
                          ? "brand"
                          : "neutral"
                  }
                >
                  {v.status.replace("_", " ")}
                </Pill>
                <span className="text-xs text-text-muted shrink-0">
                  {formatDateTime(v.when)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}