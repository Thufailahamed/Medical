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
  Search,
  X,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { ErrorState, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Drawer } from "@/portal/components/ui/Modal";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";
import { AiExplainLabDrawer } from "@/portal/components/ai/AiExplainLabDrawer";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { LabOrderForm } from "@/portal/components/labs/LabOrderForm";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";
import {
  labOrderPriorityToTone,
  labOrderStatusToTone,
} from "@/portal/lib/clinicalTones";
import {
  LAB_ORDER_STATUS_FILTERS,
  labOrderFilterLabelKey,
  labOrderFilterToQuery,
  labOrderPriorityLabelKey,
  labOrderStatusLabelKey,
  type LabOrderStatusFilter,
} from "@/portal/lib/labOrderFilters";

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
  const [search, setSearch] = useState("");
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

  const { data: allData } = useQuery({
    queryKey: [...qk.labOrdersAll({ status: "all" })],
    queryFn: () => api<{ orders: LabOrderRow[]; count: number }>("/doctor-portal/lab-orders?limit=200"),
    staleTime: 30_000,
  });

  const rows: LabOrderRow[] = (data?.orders ?? []).map((o) => ({
    ...o,
    tests: safeJson(o.tests as string | string[]),
  }));

  const allRows: LabOrderRow[] = (allData?.orders ?? rows).map((o) => ({
    ...o,
    tests: safeJson(o.tests as string | string[]),
  }));

  // Status telemetry counters
  const totalCount = allRows.length;
  const orderedCount = allRows.filter((o) => o.status === "ordered").length;
  const processingCount = allRows.filter((o) => o.status === "processing").length;
  const completedCount = allRows.filter((o) => o.status === "completed").length;
  const cancelledCount = allRows.filter((o) => o.status === "cancelled").length;

  const filteredRows = rows.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.patientName && o.patientName.toLowerCase().includes(q)) ||
      o.tests.some((test) => test.toLowerCase().includes(q)) ||
      (o.notes && o.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-5">
      {/* ── Oceanic Hero Header ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden flex flex-col gap-6"
        style={{
          background:
            "radial-gradient(134.49% 134.49% at 94.63% 0%, #0284C7 0%, #0369A1 42.6%, #075985 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20">
                Diagnostic Laboratory & Pathology Hub
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>LIMS & HL7 Integrated</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Lab Orders & Diagnostic Requisitions
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Order hematology, biochemistry, and pathology panels, monitor diagnostic processing statuses in real time, and analyze laboratory results with integrated AI explainers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-sky-950 bg-white shadow-md hover:bg-sky-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Request New Lab Order</span>
          </button>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Orders</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Historical diagnostic panels</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Ordered & Pending</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{orderedCount}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Awaiting sample collection</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Processing</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{processingCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">Under laboratory assay</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Completed / Reported</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{completedCount}</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Results verified & filed</span>
          </div>
        </div>
      </div>

      {/* ── Search & Segmented Filter Controls ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all flex-1 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, test name, or clinical notes…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <FilterPills<LabOrderStatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: totalCount },
            { value: "ordered", label: "Ordered", count: orderedCount },
            { value: "processing", label: "Processing", count: processingCount },
            { value: "completed", label: "Completed", count: completedCount },
            { value: "cancelled", label: "Cancelled", count: cancelledCount },
          ]}
        />
      </div>

      {/* ── Lab Orders Listing ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-5">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8">
            <ChartEmpty
              icon={<FlaskConical size={24} />}
              title="No lab orders found"
              description={
                search
                  ? `No orders matching "${search}". Try clearing your search query.`
                  : "No diagnostic lab orders have been requested under this category yet."
              }
              action={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Request New Lab Order
                  </button>
                )
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {filteredRows.map((o) => (
              <li
                key={o.id}
                className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-sky-50/40 transition-colors"
              >
                <Link
                  href={`/portal/patients/${o.patientId}/lab-orders`}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <Avatar
                    name={o.patientName ?? "?"}
                    src={o.patientPhoto ?? undefined}
                    size="md"
                    className="ring-2 ring-slate-100 shadow-2xs shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 mb-1">
                      <span className="text-sm font-bold text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                        {o.patientName ?? t("labs.untitled")}
                      </span>
                      <Pill tone={labOrderStatusToTone(o.status)}>
                        {t(labOrderStatusLabelKey(o.status))}
                      </Pill>
                      <Pill tone={labOrderPriorityToTone(o.priority)}>
                        {t(labOrderPriorityLabelKey(o.priority))}
                      </Pill>
                      {o.patientNic && (
                        <span className="text-xs text-slate-400 font-medium">
                          • NIC: {o.patientNic}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {o.tests.length > 0 ? (
                          o.tests.map((test) => (
                            <span
                              key={test}
                              className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/80"
                            >
                              {test}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">
                            {o.notes ?? t("labs.untitled")}
                          </span>
                        )}
                      </div>
                      {o.orderedAt && (
                        <span className="text-xs text-slate-400 font-medium ml-1">
                          • {formatDateTime(o.orderedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2.5 shrink-0">
                  {o.status === "completed" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setExplainFor(o);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                      title={t("labOrders.actions.explain")}
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      <span>AI Explainer</span>
                    </button>
                  )}
                  <Link
                    href={`/portal/patients/${o.patientId}/lab-orders`}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Order</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {explainFor && (
        <AiExplainLabDrawer
          labOrder={explainFor}
          onClose={() => setExplainFor(null)}
        />
      )}

      {/* ── Request Lab Order Drawer ───────────────────────────────────── */}
      <Drawer
        open={creating}
        onClose={closeDrawer}
        title={t("labOrders.newTitle")}
        subtitle={pickedPatient?.name ?? t("labOrders.newSubtitle")}
        size="md"
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("labOrders.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
              <div>
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                  {t("labOrders.fields.patient")}
                </span>
                <span className="text-sm font-extrabold text-slate-900 truncate">
                  {pickedPatient.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickedPatient(null)}
                className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
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