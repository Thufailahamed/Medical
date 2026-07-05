"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Clock4,
  XCircle,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface FollowUp {
  id: string;
  patientId: string;
  title: string;
  notes: string | null;
  followUpDate: string | null;
  status: string;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

type Tab = "upcoming" | "completed" | "all";

export default function FollowUpsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "follow-ups"],
    queryFn: () =>
      api<{ followUps: FollowUp[]; count: number }>(
        "/doctor-portal/follow-ups?limit=200"
      ),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api(`/doctor-portal/follow-ups/${id}/status`, {
        method: "PATCH",
        json: { status },
      });
    },
    onSuccess: () => {
      toast.success(t("toast.saved"), "");
      qc.invalidateQueries({ queryKey: ["doctor", "follow-ups"] });
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const allFollowUps = data?.followUps ?? [];

  const today = new Date().toISOString().split("T")[0];

  const filtered = allFollowUps.filter((f) => {
    if (tab === "completed") return f.status === "completed";
    if (tab === "upcoming") {
      const isFuture = (f.followUpDate || "") >= today;
      return isFuture && f.status !== "cancelled" && f.status !== "completed";
    }
    return true;
  });

  function getStatusMeta(status: string) {
    switch (status) {
      case "completed":
        return { label: t("followUps.status.completed"), tone: "success" as const, icon: Check };
      case "cancelled":
        return { label: t("followUps.status.cancelled"), tone: "danger" as const, icon: XCircle };
      default:
        return { label: t("followUps.status.scheduled"), tone: "warn" as const, icon: Clock4 };
    }
  }

  const TABS: { value: Tab; label: string }[] = [
    { value: "upcoming", label: t("followUps.tabs.upcoming") },
    { value: "completed", label: t("followUps.tabs.completed") },
    { value: "all", label: t("followUps.tabs.all") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("followUps.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("followUps.subtitle")}</p>
      </div>

      {/* Tabs */}
      <Card padding={false}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "px-2.5 h-7 rounded-md text-xs border transition-colors",
                tab === t.value
                  ? "bg-brand-soft text-brand border-brand/30"
                  : "bg-surface text-text-soft border-border hover:bg-surface-2"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Follow-ups List */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-32 w-full" />
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <Empty
              title={
                tab === "upcoming"
                  ? t("followUps.empty.upcoming")
                  : tab === "completed"
                  ? t("followUps.empty.completed")
                  : t("followUps.empty.all")
              }
              className="py-8"
            />
          </Card>
        ) : (
          filtered.map((f) => {
            const meta = getStatusMeta(f.status);
            const StatusIcon = meta.icon;
            const isDone = f.status === "completed";
            const isCancelled = f.status === "cancelled";
            const isPending = f.status === "pending";

            return (
              <Card key={f.id} padding={false}>
                <div className="p-4 flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        isDone
                          ? "bg-success-soft text-success"
                          : isCancelled
                          ? "bg-danger-soft text-danger"
                          : "bg-brand-soft text-brand"
                      )}
                    >
                      <StatusIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {f.title}
                      </div>
                      <div className="text-xs text-text-soft truncate">
                        {f.patient?.name || t("followUps.unknownPatient")}
                      </div>
                    </div>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2">
                    <Pill tone={f.followUpDate && f.followUpDate >= today ? "brand" : "neutral"}>
                      {f.followUpDate || t("followUps.noDate")}
                    </Pill>
                    {isPending && f.followUpDate && f.followUpDate >= today && (
                      <span className="text-xs text-text-muted">{t("followUps.scheduled")}</span>
                    )}
                  </div>

                  {/* Notes */}
                  {f.notes && (
                    <p className="text-xs text-text-muted line-clamp-2">{f.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<Check size={14} />}
                          onClick={() =>
                            updateStatus.mutate({ id: f.id, status: "completed" })
                          }
                          loading={updateStatus.isPending}
                        >
                          {t("followUps.markCompleted")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<XCircle size={14} />}
                          onClick={() =>
                            updateStatus.mutate({ id: f.id, status: "cancelled" })
                          }
                          loading={updateStatus.isPending}
                        >
                          {t("followUps.cancel")}
                        </Button>
                      </>
                    )}
                    {(isDone || isCancelled) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<RotateCcw size={14} />}
                        onClick={() =>
                          updateStatus.mutate({ id: f.id, status: "pending" })
                        }
                        loading={updateStatus.isPending}
                      >
                        {t("followUps.reopen")}
                      </Button>
                    )}
                    {f.patientId && (
                      <Link
                        href={`/portal/patients/${f.patientId}`}
                        className="ml-auto"
                      >
                        <Button size="sm" variant="ghost" leftIcon={<ChevronRight size={14} />}>
                          {t("patients.openChart")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
