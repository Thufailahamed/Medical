"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FlaskConical,
  ArrowRight,
  Sparkles,
  Hash,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { AiExplainLabDrawer } from "@/portal/components/ai/AiExplainLabDrawer";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import {
  labOrderPriorityToTone,
  labOrderStatusToTone,
} from "@/portal/lib/clinicalTones";
import { cn } from "@/portal/lib/utils";

interface LabOrderRow {
  id: string;
  patientId: string;
  status: string;
  priority: string;
  tests: string[];
  notes?: string | null;
  orderedAt?: string | null;
  resultUrl?: string | null;
  resultSummary?: string | null;
  patientName?: string | null;
  patientNic?: string | null;
  patientPhoto?: string | null;
}

type Status = "all" | "ordered" | "processing" | "completed" | "cancelled";
const STATUS_VALUES: Status[] = [
  "all",
  "ordered",
  "processing",
  "completed",
  "cancelled",
];

function safeJson(s: string | string[]): string[] {
  if (Array.isArray(s)) return s;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function DoctorLabOrdersPage() {
  const t = useT();
  const [status, setStatus] = useState<Status>("all");
  const [explainFor, setExplainFor] = useState<LabOrderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...qk.labOrdersAll({ status })],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", "200");
      if (status !== "all") q.set("status", status);
      return api<{ orders: LabOrderRow[]; count: number }>(
        `/doctor-portal/lab-orders?${q.toString()}`,
      );
    },
  });

  const rows: LabOrderRow[] = (data?.orders ?? []).map((o) => ({
    ...o,
    tests: safeJson(o.tests as string | string[]),
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("labOrders.title")}
        subtitle={t("labOrders.subtitle")}
        icon={<FlaskConical size={18} className="text-brand" />}
      />

      <Card padding={false} className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-surface">
        <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30">
          <FilterPills<Status>
            value={status}
            onChange={setStatus}
            options={STATUS_VALUES.map((s) => ({
              value: s,
              label:
                s === "all"
                  ? t("labOrders.filterAll")
                  : t(
                      s === "processing"
                        ? "labs.status_in_progress"
                        : `labs.status_${s}`,
                    ),
            }))}
          />
        </div>

        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("labOrders.emptyGlobal")} className="py-16" />
        ) : (
          <ul className="flex flex-col divide-y divide-border/40">
            {rows.map((o) => (
              <li
                key={o.id}
                className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2/40 transition-colors"
              >
                <Link
                  href={`/portal/patients/${o.patientId}/lab-orders`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <Avatar
                    name={o.patientName ?? "?"}
                    src={o.patientPhoto ?? undefined}
                    size="md"
                    className="ring-1 ring-border/30 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 mb-0.5">
                      <span className="text-sm font-semibold text-text truncate group-hover:text-brand transition-colors">
                        {o.patientName ?? t("labs.untitled")}
                      </span>
                      <Pill tone={labOrderStatusToTone(o.status)}>
                        {t(`labs.status_${o.status}`)}
                      </Pill>
                      <Pill tone={labOrderPriorityToTone(o.priority)}>
                        {t(`labs.priority_${o.priority}`)}
                      </Pill>
                      {o.patientNic ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted font-medium">
                          <Hash size={10} />
                          {o.patientNic}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-soft truncate">
                      <span className="truncate">
                        {o.tests.length > 0
                          ? o.tests.join(", ")
                          : o.notes ?? t("labs.untitled")}
                      </span>
                      {o.orderedAt ? (
                        <>
                          <span>·</span>
                          <span className="text-text-muted">
                            {formatDateTime(o.orderedAt)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  {o.status === "completed" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setExplainFor(o);
                      }}
                      className="portal-btn portal-btn-ghost portal-btn-sm"
                      title={t("labOrders.actions.explain")}
                    >
                      <Sparkles size={14} className="text-amber-500" />
                    </button>
                  ) : null}
                  <Link
                    href={`/portal/patients/${o.patientId}/lab-orders`}
                    className="portal-btn portal-btn-ghost portal-btn-sm"
                  >
                    {t("labOrders.actions.viewChart")}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {explainFor ? (
        <AiExplainLabDrawer
          labOrder={explainFor}
          onClose={() => setExplainFor(null)}
        />
      ) : null}
    </div>
  );
}