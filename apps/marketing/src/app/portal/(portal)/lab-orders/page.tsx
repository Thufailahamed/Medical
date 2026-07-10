"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FlaskConical,
  ArrowRight,
  Sparkles,
  Hash,
  Plus,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, ErrorState, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Drawer } from "@/portal/components/ui/Modal";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { AiExplainLabDrawer } from "@/portal/components/ai/AiExplainLabDrawer";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { LabOrderForm } from "@/portal/components/labs/LabOrderForm";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import {
  labOrderPriorityToTone,
  labOrderStatusToTone,
} from "@/portal/lib/clinicalTones";
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

import {
  LAB_ORDER_STATUS_FILTERS,
  labOrderFilterLabelKey,
  labOrderFilterToQuery,
  labOrderPriorityLabelKey,
  labOrderStatusLabelKey,
  type LabOrderStatusFilter,
} from "@/portal/lib/labOrderFilters";

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
  const [status, setStatus] = useState<LabOrderStatusFilter>("all");
  const [explainFor, setExplainFor] = useState<LabOrderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string } | null>(null);

  function closeDrawer() {
    setCreating(false);
    setPickedPatient(null);
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...qk.labOrdersAll({ status })],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", "200");
      const statusParam = labOrderFilterToQuery(status);
      if (statusParam) q.set("status", statusParam);
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
        actions={
          <button
            type="button"
            className="portal-btn portal-btn-primary portal-btn-sm"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
            {t("labOrders.new")}
          </button>
        }
      />

      <Card padding={false} className="rounded-2xl border-border/50 shadow-sm overflow-hidden bg-surface">
        <div className="px-4 py-3 border-b border-border/40 bg-surface-2/30">
          <FilterPills<LabOrderStatusFilter>
            value={status}
            onChange={setStatus}
            options={LAB_ORDER_STATUS_FILTERS.map((s) => ({
              value: s,
              label: t(labOrderFilterLabelKey(s)),
            }))}
          />
        </div>

        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={t("labOrders.emptyGlobal")}
            description={t("tab.labs.emptyBody")}
            icon={<FlaskConical size={20} className="text-text-muted" />}
            action={
              <button
                type="button"
                className="portal-btn portal-btn-primary portal-btn-sm"
                onClick={() => setCreating(true)}
              >
                <Plus size={14} />
                {t("labOrders.new")}
              </button>
            }
            className="py-16"
          />
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
                        {t(labOrderStatusLabelKey(o.status))}
                      </Pill>
                      <Pill tone={labOrderPriorityToTone(o.priority)}>
                        {t(labOrderPriorityLabelKey(o.priority))}
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

      <Drawer
        open={creating}
        onClose={closeDrawer}
        title={t("labOrders.newTitle")}
        subtitle={pickedPatient?.name ?? t("labOrders.newSubtitle")}
        size="md"
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <label className="text-[11px] text-text-soft">
              {t("labOrders.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2/50">
              <span className="text-xs text-text-muted">
                {t("labOrders.fields.patient")}
              </span>
              <span className="text-sm font-medium text-text truncate">
                {pickedPatient.name}
              </span>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="text-xs text-brand hover:underline"
              >
                {t("common.change")}
              </button>
            </div>
            <LabOrderForm
              patientId={pickedPatient.id}
              onSaved={closeDrawer}
              onCancel={closeDrawer}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}