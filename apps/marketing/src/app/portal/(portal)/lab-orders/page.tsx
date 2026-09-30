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
  ShieldCheck,
  Loader,
  TestTube2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { ErrorState } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Drawer } from "@/portal/components/ui/Modal";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  ROW_LINK,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
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

const LAB_ACCENT: Record<string, string> = {
  ordered: "bg-amber-400",
  processing: "bg-violet-500",
  sample_collected: "bg-violet-500",
  in_progress: "bg-violet-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-300",
};

const PROCESSING = new Set(["processing", "sample_collected", "in_progress"]);

function isUrgent(priority?: string | null) {
  const p = (priority ?? "").toLowerCase();
  return p === "stat" || p === "urgent";
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
  const processingCount = allRows.filter((o) => PROCESSING.has(o.status)).length;
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

  const openCount = orderedCount + processingCount;
  const urgentOpen = allRows.filter(
    (o) => (o.status === "ordered" || PROCESSING.has(o.status)) && isUrgent(o.priority),
  ).length;
  const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<FlaskConical size={13} aria-hidden />}
          kicker="Diagnostics"
          kickerMeta={`${openCount} open requisition${openCount === 1 ? "" : "s"}`}
          title={
            <>
              Lab orders &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                results
              </span>
            </>
          }
          description="Request haematology, biochemistry and pathology panels, follow each sample through the lab, and read results with the AI explainer."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-sky-300" aria-hidden />
                LIMS &amp; HL7 integrated
              </span>
              {urgentOpen > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-100">
                  <AlertCircle size={12} aria-hidden />
                  {urgentOpen} urgent in progress
                </span>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => setCreating(true)} className={HERO_PRIMARY}>
              <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
              New lab order
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Total orders"
            icon={<FlaskConical size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={isLoading && !allData ? "…" : String(totalCount)}
            sub={cancelledCount > 0 ? `${cancelledCount} cancelled` : "All requisitions"}
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          <StatTile
            label="Awaiting sample"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(orderedCount)}
            sub={orderedCount > 0 ? "Pending collection" : "All samples collected"}
            pulse={orderedCount > 0}
            active={status === "ordered"}
            onClick={() => setStatus("ordered")}
          />
          <StatTile
            label="Processing"
            icon={<Loader size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(processingCount)}
            sub="Under laboratory assay"
            active={status === "processing"}
            onClick={() => setStatus("processing")}
          />
          <StatTile
            label="Reported"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(completedCount)}
            sub={`${completedPct}% of orders resulted`}
            progress={totalCount > 0 ? completedPct : null}
            active={status === "completed"}
            onClick={() => setStatus("completed")}
          />
        </HeroOverlap>
      </div>

      {/* ── Orders ledger ──────────────────────────────────────────────── */}
      <section className={PANEL} aria-labelledby="lab-ledger">
        <PanelHeader
          id="lab-ledger"
          icon={<TestTube2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Requisitions"
          caption={
            isLoading
              ? "Loading orders…"
              : `${filteredRows.length} of ${rows.length} shown${search ? ` · matching “${search}”` : ""}`
          }
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch
            value={search}
            onChange={setSearch}
            placeholder="Search patient, test or clinical notes…"
            ariaLabel="Search lab orders"
          />
          <Segmented<LabOrderStatusFilter>
            ariaLabel="Filter by status"
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

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="mt-5">
            <ErrorState
              title={t("errors.generic")}
              description={(error as Error)?.message ?? t("errors.tryAgain")}
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyBlock
            icon={<FlaskConical size={19} />}
            title={search ? "No matching orders" : "No lab orders here yet"}
            body={
              search
                ? `Nothing matches “${search}”. Try a patient name or test.`
                : "Requisitions you raise appear here and update as the lab collects, processes and reports them."
            }
            actions={
              search ? (
                <button type="button" onClick={() => setSearch("")} className={SECONDARY_BTN}>
                  Clear search
                </button>
              ) : (
                <button type="button" onClick={() => setCreating(true)} className={PRIMARY_BTN}>
                  <Plus size={13} strokeWidth={2.5} />
                  New lab order
                </button>
              )
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filteredRows.map((o) => (
              <li key={o.id} className={LIST_ROW}>
                <RowAccent className={LAB_ACCENT[o.status]} />
                <Link
                  href={`/portal/patients/${o.patientId}/lab-orders`}
                  className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5"
                >
                  <Avatar
                    name={o.patientName ?? "?"}
                    src={o.patientPhoto ?? undefined}
                    size="md"
                    className="h-10 w-10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {o.patientName ?? t("labs.untitled")}
                      </span>
                      <Pill tone={labOrderStatusToTone(o.status)}>{t(labOrderStatusLabelKey(o.status))}</Pill>
                      {isUrgent(o.priority) ? (
                        <Pill tone={labOrderPriorityToTone(o.priority)}>{t(labOrderPriorityLabelKey(o.priority))}</Pill>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {o.tests.length > 0 ? (
                        <>
                          {o.tests.slice(0, 4).map((test) => (
                            <span
                              key={test}
                              className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700"
                            >
                              {test}
                            </span>
                          ))}
                          {o.tests.length > 4 ? (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                              +{o.tests.length - 4}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="truncate italic text-slate-400">{o.notes ?? t("labs.untitled")}</span>
                      )}
                      {o.orderedAt ? (
                        <span className="ml-1 inline-flex shrink-0 items-center gap-1 text-slate-400">
                          <Clock size={11} />
                          {formatDateTime(o.orderedAt)}
                        </span>
                      ) : null}
                      {o.patientNic ? (
                        <span className="hidden shrink-0 items-center gap-1 font-mono text-[11px] text-slate-400 md:inline-flex">
                          <Hash size={10} />
                          {o.patientNic}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2 pl-1.5 sm:pl-0">
                  {o.status === "completed" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setExplainFor(o);
                      }}
                      title={t("labOrders.actions.explain")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 text-xs font-semibold text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)] transition-all hover:shadow-[inset_0_0_0_1px_rgba(217,119,6,0.4)]"
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      AI explain
                    </button>
                  ) : null}
                  <Link href={`/portal/patients/${o.patientId}/lab-orders`} className={ROW_LINK}>
                    View
                    <ArrowRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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