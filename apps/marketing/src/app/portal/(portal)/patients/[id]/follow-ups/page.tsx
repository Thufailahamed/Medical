"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Plus, Check, X } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { FollowUpForm } from "@/portal/components/followups/FollowUpForm";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
import { followUpStatusToTone } from "@/portal/lib/clinicalTones";

interface FollowUp {
  id: string;
  patientId: string;
  title: string;
  followUpDate: string;
  notes?: string | null;
  status?: string;
}

interface FollowUpsResponse {
  followUps: FollowUp[];
  count: number;
}

type Filter = "upcoming" | "past" | "all";
const FILTERS: Filter[] = ["upcoming", "past", "all"];

export default function FollowUpsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "follow-ups", id, filter],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("patientId", id);
      q.set("limit", "100");
      if (filter === "upcoming") q.set("upcoming", "true");
      return api<FollowUpsResponse>(`/doctor-portal/follow-ups?${q.toString()}`);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/doctor-portal/follow-ups/${id}/status`, {
        method: "PATCH",
        json: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
      qc.invalidateQueries({ queryKey: qkPatientOverview(id) });
    },
  });

  const rows = data?.followUps ?? [];
  const today = new Date().toISOString().split("T")[0];
  const upcomingCount = rows.filter((f) => f.followUpDate >= today).length;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<CalendarCheck size={18} />}
        title={t("tab.followups.title")}
        subtitle={t("tab.followups.subtitle", { count: upcomingCount })}
        badge={{ count: rows.length, tone: "brand" }}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setOpen(true)}
          >
            {t("tab.followups.new")}
          </Button>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        toolbar={
          <FilterPills<Filter>
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({
              value: f,
              label: t(`tab.followups.filter${f[0].toUpperCase()}${f.slice(1)}`),
            }))}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<CalendarCheck size={20} />}
            title={t("tab.followups.empty")}
            description={t("tab.followups.emptyBody")}
            action={
              <Button
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setOpen(true)}
              >
                {t("tab.followups.new")}
              </Button>
            }
          />
        }
        renderRow={(f) => {
          const isCompleted = f.status === "completed";
          const isCancelled = f.status === "cancelled";
          return (
            <ChartRow
              icon={<CalendarCheck size={16} />}
              iconTone={isCancelled ? "neutral" : "brand"}
              title={f.title}
              subtitle={f.notes ?? undefined}
              pills={[
                <Pill key="status" tone={followUpStatusToTone(f.status)}>
                  {f.status ? t(`status.${f.status}`) : t("status.pending")}
                </Pill>,
              ]}
              meta={
                <span className="text-[11px] text-text-muted">
                  {formatDate(f.followUpDate)}
                </span>
              }
              actions={
                !isCompleted && !isCancelled ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: f.id, status: "completed" })
                      }
                      disabled={updateStatus.isPending}
                      className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-emerald-700 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                      title={t("tab.followups.markComplete")}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: f.id, status: "cancelled" })
                      }
                      disabled={updateStatus.isPending}
                      className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-text-muted hover:bg-danger-soft hover:text-danger transition-colors disabled:opacity-50"
                      title={t("tab.followups.cancel")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null
              }
            />
          );
        }}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("tab.followups.new")}
        size="md"
      >
        <FollowUpForm
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}

function qkPatientOverview(patientId: string) {
  return ["doctor-portal", "patient", patientId, "overview"];
}
