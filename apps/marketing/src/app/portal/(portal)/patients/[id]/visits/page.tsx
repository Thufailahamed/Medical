"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, DoorOpen, CalendarPlus, UserPlus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
import { recordKindLabel, visitStatusToTone } from "@/portal/lib/clinicalTones";

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

type Period = "upcoming" | "past" | "all";
const PERIODS: Period[] = ["upcoming", "past", "all"];

export default function VisitsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [period, setPeriod] = useState<Period>("upcoming");

  const { data: aptData, isLoading: aptLoading } = useQuery({
    queryKey: ["appointments", "patient", id],
    queryFn: () =>
      api<{ appointments: Appt[] }>(`/appointments?patientId=${id}&limit=100`),
  });
  const { data: walkData, isLoading: walkLoading } = useQuery({
    queryKey: ["walk-ins", "patient", id],
    queryFn: () =>
      api<{ walkIns: WalkIn[] }>(`/walk-ins?patientId=${id}&limit=100`),
  });

  const merged = useMemo(() => {
    const apts = aptData?.appointments ?? [];
    const walks = walkData?.walkIns ?? [];
    const all = [
      ...apts.map((a) => ({
        kind: "appointment" as const,
        id: a.id,
        when: a.scheduledAt,
        reason: a.reason,
        status: a.status,
        meta: a.type,
      })),
      ...walks.map((w) => ({
        kind: "walkin" as const,
        id: w.id,
        when: w.arrivedAt,
        reason: w.reason,
        status: w.status,
        meta: w.priority,
      })),
    ].sort(
      (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime(),
    );
    if (period === "all") return all;
    const now = Date.now();
    return all.filter((v) =>
      period === "upcoming"
        ? new Date(v.when).getTime() >= now
        : new Date(v.when).getTime() < now,
    );
  }, [aptData, walkData, period]);

  const isLoading = aptLoading || walkLoading;
  const base = `/portal/patients/${id}`;

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Calendar size={18} />}
        title={t("tab.visits.title")}
        subtitle={t("tab.visits.subtitle", { count: merged.length })}
        badge={{ count: merged.length, tone: "brand" }}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/portal/book-appointment"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarPlus size={14} />
              <span>{t("tab.visits.bookAppointment")}</span>
            </Link>
            <Link
              href="/portal/walk-ins"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <UserPlus size={14} />
              <span>{t("tab.visits.addWalkin")}</span>
            </Link>
          </div>
        }
      />

      <ChartList
        items={merged}
        isLoading={isLoading}
        isEmpty={!isLoading && merged.length === 0}
        toolbar={
          <FilterPills<Period>
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({
              value: p,
              label: t(`tab.visits.filter${p[0].toUpperCase()}${p.slice(1)}`),
            }))}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<Calendar size={22} />}
            title={t("tab.visits.empty")}
            description={t("tab.visits.emptyBody")}
            action={
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Link
                  href="/portal/book-appointment"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  <CalendarPlus size={14} />
                  <span>{t("tab.visits.bookAppointment")}</span>
                </Link>
                <Link
                  href="/portal/walk-ins"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  <UserPlus size={14} />
                  <span>{t("tab.visits.addWalkin")}</span>
                </Link>
              </div>
            }
          />
        }
        renderRow={(v) => {
          const Icon = v.kind === "appointment" ? Calendar : DoorOpen;
          return (
            <ChartRow
              icon={<Icon size={16} />}
              iconTone={v.kind === "appointment" ? "brand" : "violet"}
              title={v.reason ?? recordKindLabel(v.kind)}
              subtitle={relativeTime(v.when)}
              pills={[
                <Pill key="kind" tone={v.kind === "appointment" ? "brand" : "violet"}>
                  {t(`kind.${v.kind === "appointment" ? "appointment" : "walkin"}`)}
                </Pill>,
                <Pill key="status" tone={visitStatusToTone(v.status)}>
                  {t(`status.${v.status}`)}
                </Pill>,
              ]}
              meta={
                <span className="text-[11px] text-text-muted">
                  {formatDateTime(v.when)}
                </span>
              }
            />
          );
        }}
      />
    </div>
  );
}
