"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Plus, Sparkles } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { LabOrderForm } from "@/portal/components/labs/LabOrderForm";
import { AiExplainLabDrawer } from "@/portal/components/ai/AiExplainLabDrawer";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
import {
  labOrderPriorityToTone,
  labOrderStatusToTone,
} from "@/portal/lib/clinicalTones";

interface LabOrder {
  id: string;
  patientId: string;
  status: string;
  priority: string;
  tests: string[] | string;
  notes?: string | null;
  orderedAt?: string | null;
  resultUrl?: string | null;
  resultSummary?: string | null;
  patientName?: string | null;
}

interface LabList {
  orders: LabOrder[];
  count: number;
}

import {
  LAB_ORDER_STATUS_FILTERS,
  labOrderFilterLabelKey,
  labOrderFilterToQuery,
  labOrderPriorityLabelKey,
  labOrderStatusLabelKey,
  type LabOrderStatusFilter,
} from "@/portal/lib/labOrderFilters";

export default function LabOrdersTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LabOrderStatusFilter>("all");
  const [explainFor, setExplainFor] = useState<(Omit<LabOrder, "tests"> & { tests: string[] }) | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "lab-orders", id, status],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("patientId", id);
      q.set("limit", "100");
      if (status !== "all") {
        const statusParam = labOrderFilterToQuery(status);
        if (statusParam) q.set("status", statusParam);
      }
      return api<LabList>(`/doctor-portal/lab-orders?${q.toString()}`);
    },
  });

  const rows = (data?.orders ?? []).map((o) => ({
    ...o,
    tests: Array.isArray(o.tests) ? o.tests : safeJson(o.tests),
  }));

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<FlaskConical size={18} />}
        title={t("tab.labs.title")}
        subtitle={t("tab.labs.subtitle", { count: rows.length })}
        badge={{ count: rows.length, tone: "violet" }}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setOpen(true)}
          >
            {t("tab.labs.new")}
          </Button>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        toolbar={
          <FilterPills<LabOrderStatusFilter>
            value={status}
            onChange={setStatus}
            options={LAB_ORDER_STATUS_FILTERS.map((s) => ({
              value: s,
              label: t(labOrderFilterLabelKey(s)),
            }))}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<FlaskConical size={20} />}
            title={t("tab.labs.empty")}
            description={t("tab.labs.emptyBody")}
            action={
              <Button
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setOpen(true)}
              >
                {t("tab.labs.new")}
              </Button>
            }
          />
        }
        renderRow={(o) => (
          <ChartRow
            icon={<FlaskConical size={16} />}
            iconTone="violet"
            title={o.tests.join(", ") || t("labs.untitled")}
            subtitle={o.notes ?? undefined}
            pills={[
              <Pill key="priority" tone={labOrderPriorityToTone(o.priority)}>
                {t(labOrderPriorityLabelKey(o.priority))}
              </Pill>,
              <Pill key="status" tone={labOrderStatusToTone(o.status)}>
                {t(labOrderStatusLabelKey(o.status))}
              </Pill>,
            ]}
            meta={
              o.orderedAt ? (
                <span className="text-[11px] text-text-muted">
                  {formatDateTime(o.orderedAt)}
                </span>
              ) : null
            }
            actions={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("ai.labExplain.title")}
                title={t("ai.labExplain.title")}
                onClick={() => setExplainFor(o)}
              >
                <Sparkles size={14} />
              </Button>
            }
          />
        )}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("tab.labs.new")}
        size="lg"
      >
        <LabOrderForm
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>

      {explainFor ? (
        <AiExplainLabDrawer
          labOrder={{
            id: explainFor.id,
            patientId: explainFor.patientId,
            tests: explainFor.tests,
            notes: explainFor.notes,
            resultUrl: explainFor.resultUrl,
            resultSummary: explainFor.resultSummary,
          }}
          onClose={() => setExplainFor(null)}
        />
      ) : null}
    </div>
  );
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
