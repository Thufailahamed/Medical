"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Clock4,
  XCircle,
  RotateCcw,
  ChevronRight,
  Plus,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { ChartEmpty } from "@/portal/components/chart/ChartEmpty";
import { PatientCombobox } from "@/portal/components/patient/PatientCombobox";
import { FollowUpForm } from "@/portal/components/followups/FollowUpForm";
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
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string } | null>(null);

  function closeDrawer() {
    setCreating(false);
    setPickedPatient(null);
  }

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
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const allFollowUps = data?.followUps ?? [];
  const today = new Date().toISOString().split("T")[0];

  // Status telemetry counters
  const totalCount = allFollowUps.length;
  const upcomingCount = useMemo(
    () =>
      allFollowUps.filter((f) => {
        const isFuture = (f.followUpDate || "") >= today;
        return isFuture && f.status !== "cancelled" && f.status !== "completed";
      }).length,
    [allFollowUps, today]
  );
  const completedCount = useMemo(
    () => allFollowUps.filter((f) => f.status === "completed").length,
    [allFollowUps]
  );
  const overdueCount = useMemo(
    () =>
      allFollowUps.filter((f) => {
        const isPast = Boolean(f.followUpDate) && (f.followUpDate || "") < today;
        return isPast && f.status === "pending";
      }).length,
    [allFollowUps, today]
  );

  const filtered = allFollowUps.filter((f) => {
    // Tab filter
    if (tab === "completed" && f.status !== "completed") return false;
    if (tab === "upcoming") {
      const isFuture = (f.followUpDate || "") >= today;
      if (!isFuture || f.status === "cancelled" || f.status === "completed") return false;
    }
    // Search query filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      (f.patient?.name && f.patient.name.toLowerCase().includes(q)) ||
      (f.notes && f.notes.toLowerCase().includes(q))
    );
  });

  function getStatusMeta(status: string, followUpDate: string | null) {
    if (status === "completed") {
      return { label: t("followUps.status.completed"), tone: "success" as const, icon: Check };
    }
    if (status === "cancelled") {
      return { label: t("followUps.status.cancelled"), tone: "danger" as const, icon: XCircle };
    }
    if (followUpDate && followUpDate < today) {
      return { label: "Overdue", tone: "danger" as const, icon: AlertTriangle };
    }
    return { label: t("followUps.status.scheduled"), tone: "warn" as const, icon: Clock4 };
  }

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
                Continuity of Care · Patient Monitoring
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-300/20 text-sky-100 border border-sky-300/30 flex items-center gap-1">
                <ShieldCheck size={13} />
                <span>Automated SMS & Recall Enabled</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              Follow-ups & Patient Recalls
            </h1>
            <p className="text-sm text-sky-100/90 max-w-2xl mt-1 leading-relaxed">
              Track post-consultation reviews, schedule proactive clinical check-ins, monitor treatment responses, and avoid lost-to-follow-up care gaps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-sky-950 bg-white shadow-md hover:bg-sky-50 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Schedule Follow-up</span>
          </button>
        </div>

        {/* 4 Telemetry Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Recalls</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{totalCount}</span>
            <span className="text-[10.5px] text-sky-200/80 mt-0.5">All scheduled check-ins</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Upcoming & Due</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{upcomingCount}</span>
            <span className="text-[10.5px] text-amber-200/80 mt-0.5">Active recall queue</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Completed Reviews</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{completedCount}</span>
            <span className="text-[10.5px] text-emerald-200/80 mt-0.5">Successfully seen</span>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 flex flex-col">
            <span className="text-[11px] font-bold text-rose-200 uppercase tracking-wider">Overdue Alerts</span>
            <span className="text-2xl font-black text-white mt-1 tabular-nums">{overdueCount}</span>
            <span className="text-[10.5px] text-rose-200/80 mt-0.5">Missed follow-up date</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all flex-1 max-w-md">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name, follow-up reason, or notes…"
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

        <FilterPills<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming", count: upcomingCount },
            { value: "completed", label: "Completed", count: completedCount },
            { value: "all", label: "All Recalls", count: totalCount },
          ]}
        />
      </div>

      {/* ── Follow-ups Listing ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs p-8">
            <ChartEmpty
              icon={<CalendarClock size={24} />}
              title={
                tab === "upcoming"
                  ? "No upcoming follow-ups scheduled"
                  : tab === "completed"
                  ? "No completed follow-up reviews yet"
                  : "No follow-up records found"
              }
              description={
                search
                  ? `No follow-ups matching "${search}". Try clearing your search query.`
                  : "Keep patient care on track by scheduling timely post-treatment follow-up reminders."
              }
              action={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                    }}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Schedule Follow-up
                  </button>
                )
              }
            />
          </div>
        ) : (
          filtered.map((f) => {
            const meta = getStatusMeta(f.status, f.followUpDate);
            const StatusIcon = meta.icon;
            const isDone = f.status === "completed";
            const isCancelled = f.status === "cancelled";
            const isPending = f.status === "pending";
            const isOverdue = Boolean(f.followUpDate) && (f.followUpDate || "") < today && isPending;

            return (
              <div
                key={f.id}
                className={cn(
                  "rounded-2xl border bg-white p-5 shadow-2xs transition-all hover:border-sky-300",
                  isOverdue ? "border-rose-200 bg-rose-50/20" : "border-slate-200/90"
                )}
              >
                <div className="flex flex-col gap-3.5">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border",
                          isDone
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isCancelled
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : isOverdue
                            ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        <StatusIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 truncate">
                            {f.title}
                          </h3>
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          {f.followUpDate && (
                            <span
                              className={cn(
                                "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                                isOverdue
                                  ? "bg-rose-100 text-rose-800 border-rose-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              )}
                            >
                              📅 {formatDate(f.followUpDate)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">
                            {f.patient?.name || t("followUps.unknownPatient")}
                          </span>
                          <span>•</span>
                          <span>Created {formatDate(f.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/portal/patients/${f.patientId}/follow-ups`}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>Patient Chart</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>

                  {/* Notes */}
                  {f.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium leading-relaxed">
                      {f.notes}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus.mutate({ id: f.id, status: "completed" })}
                            disabled={updateStatus.isPending}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                            style={{
                              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                            }}
                          >
                            <Check size={14} />
                            <span>{t("followUps.markCompleted")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus.mutate({ id: f.id, status: "cancelled" })}
                            disabled={updateStatus.isPending}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle size={14} />
                            <span>{t("followUps.cancel")}</span>
                          </button>
                        </>
                      )}
                      {(isDone || isCancelled) && (
                        <button
                          type="button"
                          onClick={() => updateStatus.mutate({ id: f.id, status: "pending" })}
                          disabled={updateStatus.isPending}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Reopen Follow-up</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Create Follow-Up Drawer ────────────────────────────────────── */}
      <Drawer
        open={creating}
        onClose={closeDrawer}
        title={t("followUps.newTitle")}
        subtitle={pickedPatient?.name ?? t("followUps.newSubtitle")}
        size="md"
      >
        {!pickedPatient ? (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("followUps.fields.patient")}
            </label>
            <PatientCombobox value={null} onChange={(p) => p && setPickedPatient(p)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
              <div>
                <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                  {t("followUps.fields.patient")}
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
            <FollowUpForm
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
