"use client";

/**
 * Doctor-portal Queue.
 *
 * Today's combined view: walk-ins + scheduled appointments for the
 * active doctor. Replaces the previous workflow where the doctor had
 * to jump between `/portal/walk-ins` and `/portal/appointments` to
 * see the full picture. Single page, single poll cycle, single set
 * of per-row actions.
 *
 * Data source: GET /doctor-portal/queue?date=YYYY-MM-DD
 *   (default date = today; tenant scoping automatic via API client)
 *
 * Polling: 30s `refetchInterval` (matches /walk-ins + mobile queue).
 *
 * Mutations:
 *   POST /doctor-portal/appointments/:id/status  { status }
 *   PATCH  /walk-ins/:id                          { status }
 * Both invalidate ["doctor-portal", "queue", date] on success.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListOrdered,
  RefreshCw,
  CalendarCheck,
  DoorOpen,
  Play,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  Hash,
  Clock,
  Video,
  Users,
  Plus,
  CalendarPlus,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

import { api, qk, teleconsultApi } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import {
  ChartList,
  ChartRow,
  type FilterOption,
} from "@/portal/components/chart";
import { useT } from "@/portal/i18n";
import { formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

// ─── Status vocabulary ──────────────────────────────────────────────────
type ApptStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

type WalkInStatus =
  | "waiting"
  | "in_consultation"
  | "completed"
  | "no_show";

type AnyStatus = ApptStatus | WalkInStatus;

type QueueFilter = "all" | "walkins" | "appointments" | "active" | "completed";

// ─── Transition tables ──────────────────────────────────────────────────
const APPT_TRANSITIONS: Record<ApptStatus, ApptStatus[]> = {
  scheduled: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const WALKIN_TRANSITIONS: Record<WalkInStatus, WalkInStatus[]> = {
  waiting: ["in_consultation", "no_show"],
  in_consultation: ["completed", "no_show"],
  completed: [],
  no_show: [],
};

// ─── Status visual config ───────────────────────────────────────────────
type StatusTone = "neutral" | "brand" | "success" | "warn" | "danger";

const STATUS_TONE: Record<AnyStatus, StatusTone> = {
  scheduled: "brand",
  confirmed: "brand",
  in_progress: "warn",
  waiting: "warn",
  in_consultation: "warn",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};

const STATUS_LABEL_KEY: Record<AnyStatus, string> = {
  scheduled: "appointments.status_scheduled",
  confirmed: "appointments.status_confirmed",
  in_progress: "appointments.status_in_progress",
  completed: "appointments.status_completed",
  cancelled: "appointments.status_cancelled",
  no_show: "appointments.status_no_show",
  waiting: "walkins.status.waiting",
  in_consultation: "walkins.status.in_consultation",
};

// ─── Shape of /doctor-portal/queue response item ────────────────────────
interface QueueItem {
  kind: "appointment" | "walkin";
  appointmentId?: string;
  walkInId?: string;
  patientId: string;
  patientName: string;
  patientPhone?: string | null;
  patientPhoto?: string | null;
  nic?: string | null;
  bloodGroup?: string | null;
  gender?: string | null;
  date: string;
  time?: string | null;
  priority?: "routine" | "urgent" | null;
  status: AnyStatus;
  queueNumber?: number | null;
  reason?: string | null;
  notes?: string | null;
  arrivedAt?: string | null;
  hospitalId?: string | null;
  hospitalName?: string | null;
  mode?: "in_person" | "video" | null;
}

interface QueueResp {
  date: string;
  count: number;
  queue: QueueItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────
const ACTIVE_STATUSES: Set<AnyStatus> = new Set([
  "scheduled",
  "confirmed",
  "in_progress",
  "waiting",
  "in_consultation",
]);

function itemMatchesFilter(item: QueueItem, filter: QueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "walkins":
      return item.kind === "walkin";
    case "appointments":
      return item.kind === "appointment";
    case "active":
      return ACTIVE_STATUSES.has(item.status);
    case "completed":
      return item.status === "completed" || item.status === "cancelled" || item.status === "no_show";
  }
}

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function QueuePage() {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = useMemo(todayIso, []);
  const [filter, setFilter] = useState<QueueFilter>("active");
  const modeFilter = searchParams.get("mode");

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: [...qk.doctorQueue(date), modeFilter ?? "all"],
    queryFn: () =>
      api<QueueResp>(
        `/doctor-portal/queue?date=${date}${
          modeFilter ? `&mode=${encodeURIComponent(modeFilter)}` : ""
        }`
      ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────
  const apptMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: ApptStatus;
      notes?: string;
    }) =>
      api<unknown>(`/doctor-portal/appointments/${id}/status`, {
        method: "POST",
        json: { status, notes },
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        t("queue.toast.statusUpdated"),
        t(STATUS_LABEL_KEY[vars.status] ?? "")
      );
      qc.invalidateQueries({ queryKey: qk.doctorQueue(date) });
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => {
      toast.error(t("queue.toast.error"), t("queue.toast.tryAgain"));
    },
  });

  const walkinMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: WalkInStatus;
      notes?: string;
    }) =>
      api<unknown>(`/walk-ins/${id}`, {
        method: "PATCH",
        json: { status, notes },
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        t("queue.toast.statusUpdated"),
        t(STATUS_LABEL_KEY[vars.status] ?? "")
      );
      qc.invalidateQueries({ queryKey: qk.doctorQueue(date) });
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
    },
    onError: () => {
      toast.error(t("queue.toast.error"), t("queue.toast.tryAgain"));
    },
  });

  const startVideoVisit = useMutation({
    mutationFn: (appointmentId: string) =>
      teleconsultApi.createSession(appointmentId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.doctorQueue(date) });
      qc.invalidateQueries({ queryKey: qk.teleconsultActive });
      router.push(`/portal/teleconsult/${data.roomId}`);
    },
    onError: () => {
      toast.error(t("queue.toast.error"), t("queue.toast.tryAgain"));
    },
  });

  // ─── Derived counts ─────────────────────────────────────────────────
  const items = data?.queue ?? [];

  const counts = useMemo(() => {
    let waiting = 0;
    let inProgress = 0;
    let completed = 0;
    let noShow = 0;
    for (const item of items) {
      const s = item.status;
      if (s === "waiting") waiting++;
      else if (s === "in_consultation" || s === "in_progress") inProgress++;
      else if (s === "completed") completed++;
      else if (s === "no_show") noShow++;
    }
    return { waiting, inProgress, completed, noShow };
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((it) => itemMatchesFilter(it, filter)),
    [items, filter]
  );

  const filterOptions: FilterOption<QueueFilter>[] = [
    { value: "active", label: t("queue.filter.active"), count: items.filter((i) => ACTIVE_STATUSES.has(i.status)).length },
    { value: "walkins", label: t("queue.filter.walkIns"), count: items.filter((i) => i.kind === "walkin").length },
    { value: "appointments", label: t("queue.filter.appointments"), count: items.filter((i) => i.kind === "appointment").length },
    { value: "completed", label: t("queue.filter.completed"), count: counts.completed + counts.noShow },
    { value: "all", label: t("queue.filter.all"), count: items.length },
  ];

  const activeCount = counts.waiting + counts.inProgress;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── 1. Signature Oceanic Doctor Queue Hero ─────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <ListOrdered size={12} className="text-sky-300" />
                Live Encounter Stream
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Today&apos;s Clinical Queue
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                {dataUpdatedAt
                  ? `Updated ${relativeTime(new Date(dataUpdatedAt).toISOString())} · `
                  : ""}
                Real-time patient flow combining scheduled clinic appointments, walk-in arrivals, and video teleconsultations.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02] cursor-pointer"
              >
                <RefreshCw size={12} className={cn(isFetching && "animate-spin")} />
                <span>Refresh Stream</span>
              </button>
              <Link
                href="/portal/walk-ins"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <DoorOpen size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>+ Check-In Walk-In</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Users size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Patients
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeCount} In Stream
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Waiting Lounge
                </p>
                <p className="text-base font-extrabold text-white">
                  {counts.waiting} Waiting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Play size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-emerald-200 truncate">
                  In Consultation
                </p>
                <p className="text-base font-extrabold text-white">
                  {counts.inProgress} In Room
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Completed Today
                </p>
                <p className="text-base font-extrabold text-white">
                  {counts.completed} Discharged
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Four High-Contrast Telemetry Tiles ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatMini
          icon={<Clock size={18} />}
          label="Waiting Room"
          value={counts.waiting}
          tone="warn"
          sub="Patients queued in reception"
        />
        <StatMini
          icon={<Play size={18} />}
          label="In Consultation"
          value={counts.inProgress}
          tone="brand"
          sub="Encounter currently in room"
        />
        <StatMini
          icon={<Check size={18} />}
          label="Discharged / Done"
          value={counts.completed}
          tone="success"
          sub="Completed clinical visits"
        />
        <StatMini
          icon={<X size={18} />}
          label="No-Show / Cancelled"
          value={counts.noShow}
          tone="danger"
          sub="Absences & cancellations"
        />
      </div>

      {/* ── 3. Unified Queue Stage with Categorized Filter Controls ────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col">
        {/* Filter Controls Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterOptions.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  style={{
                    backgroundColor: active ? "#0284c7" : "#ffffff",
                    borderColor: active ? "#0284c7" : "#cbd5e1",
                    color: active ? "#ffffff" : "#475569",
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs"
                >
                  <span>{opt.label}</span>
                  <span
                    style={{
                      backgroundColor: active ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                      color: active ? "#ffffff" : "#64748b",
                    }}
                    className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold"
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode Filter: All / Video / In-person */}
          <ModeFilterChips
            value={modeFilter}
            onChange={(m) => {
              const params = new URLSearchParams(searchParams.toString());
              if (m) params.set("mode", m);
              else params.delete("mode");
              const qs = params.toString();
              router.replace(qs ? `?${qs}` : "?", { scroll: false });
            }}
            t={t}
          />
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : filteredItems.length === 0 ? (
          /* Rich Clinical Empty State */
          <div className="p-10 sm:p-14 flex flex-col items-center justify-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
              <ListOrdered size={26} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Nothing in the Queue for Current Filter
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                No patients match the selected queue filter. As patients check in at reception, scan their Health ID QR at clinic kiosks, or start scheduled video appointments, they will appear here.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
              <Link
                href="/portal/walk-ins"
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                <Plus size={14} strokeWidth={3} />
                <span>+ Check-In Walk-In</span>
              </Link>
              <Link
                href="/portal/schedule"
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarPlus size={14} />
                <span>Schedule Appointment</span>
              </Link>
            </div>
          </div>
        ) : (
          <ChartList
            items={filteredItems}
            isLoading={false}
            isEmpty={false}
            emptyState={<div />}
            renderRow={(item) => (
              <QueueRow
                key={`${item.kind}-${item.appointmentId ?? item.walkInId}`}
                item={item}
                isPending={
                  apptMutation.isPending ||
                  walkinMutation.isPending ||
                  startVideoVisit.isPending
                }
                onApptStatus={(id, status) =>
                  apptMutation.mutate({ id, status })
                }
                onWalkInStatus={(id, status) =>
                  walkinMutation.mutate({ id, status })
                }
                onStartVideoVisit={(appointmentId) =>
                  startVideoVisit.mutate(appointmentId)
                }
              />
            )}
            skeletonCount={3}
          />
        )}
      </section>
    </div>
  );
}

// ─── Mode filter chips (server-driven ?mode=) ─────────────────────────
function ModeFilterChips({
  value,
  onChange,
  t,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  t: (k: string) => string;
}) {
  const opts: Array<{ key: string | null; label: string; icon?: React.ReactNode }> = [
    { key: null, label: "All Modes" },
    { key: "video", label: "Video", icon: <Video size={11} className="mr-1 inline" /> },
    { key: "in_person", label: "In-person", icon: <Stethoscope size={11} className="mr-1 inline" /> },
  ];
  return (
    <div
      className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 self-start shadow-2xs"
      role="group"
      aria-label="Encounter mode"
    >
      {opts.map((o) => {
        const active = (o.key ?? null) === (value ?? null);
        return (
          <button
            key={o.key ?? "all"}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            style={{
              backgroundColor: active ? "#0c4a6e" : "transparent",
              color: active ? "#ffffff" : "#64748b",
            }}
            className="px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center"
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stat mini (count tile) ─────────────────────────────────────────────
function StatMini({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "brand" | "warn" | "success" | "danger";
  sub: string;
}) {
  const cfg = {
    brand: {
      border: "border-sky-200 bg-sky-50/50",
      iconBg: "bg-sky-100 text-sky-700 border-sky-200",
      accent: "text-sky-700",
    },
    warn: {
      border: "border-amber-200 bg-amber-50/50",
      iconBg: "bg-amber-100 text-amber-700 border-amber-200",
      accent: "text-amber-700",
    },
    success: {
      border: "border-emerald-200 bg-emerald-50/50",
      iconBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
      accent: "text-emerald-700",
    },
    danger: {
      border: "border-rose-200 bg-rose-50/50",
      iconBg: "bg-rose-100 text-rose-700 border-rose-200",
      accent: "text-rose-700",
    },
  }[tone];

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border p-3.5 sm:p-4 shadow-2xs bg-white",
        cfg.border,
      )}
    >
      <div
        className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs",
          cfg.iconBg,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-black tabular-nums leading-none text-slate-900">
          {value}
        </div>
        <div className="text-[11px] font-bold text-slate-700 mt-1 uppercase tracking-wide truncate">
          {label}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 truncate hidden sm:block">
          {sub}
        </div>
      </div>
    </div>
  );
}

// ─── Single queue row ───────────────────────────────────────────────────
function QueueRow({
  item,
  isPending,
  onApptStatus,
  onWalkInStatus,
  onStartVideoVisit,
}: {
  item: QueueItem;
  isPending: boolean;
  onApptStatus: (id: string, status: ApptStatus) => void;
  onWalkInStatus: (id: string, status: WalkInStatus) => void;
  onStartVideoVisit: (appointmentId: string) => void;
}) {
  const t = useT();
  const router = useRouter();

  const isWalkIn = item.kind === "walkin";
  const id = item.appointmentId ?? item.walkInId ?? "";

  const canStart =
    item.status === "waiting" || item.status === "scheduled" || item.status === "confirmed";
  const canComplete =
    item.status === "in_consultation" || item.status === "in_progress";
  const canNoShow =
    item.status !== "completed" &&
    item.status !== "cancelled" &&
    item.status !== "no_show";

  const timeLabel =
    item.kind === "walkin" && item.arrivedAt
      ? `${t("queue.row.arrived")} ${relativeTime(item.arrivedAt)}`
      : item.time
      ? formatTime(item.time)
      : "—";

  const statusLabel = t(STATUS_LABEL_KEY[item.status] ?? item.status);

  function transitionAction(next: AnyStatus): {
    label: string;
    variant: "primary" | "secondary" | "ghost" | "danger";
    icon: React.ReactNode;
    fn: () => void;
  } {
    const isPrimary = next === "in_progress" || next === "in_consultation" || next === "confirmed";
    const isDanger = next === "cancelled" || next === "no_show";
    const isComplete = next === "completed";
    const icon =
      next === "in_progress" || next === "in_consultation" ? (
        <Play size={11} />
      ) : next === "completed" ? (
        <Check size={11} />
      ) : next === "no_show" || next === "cancelled" ? (
        <X size={11} />
      ) : (
        <Check size={11} />
      );
    return {
      label: t(STATUS_LABEL_KEY[next] ?? next),
      variant: isDanger ? "danger" : isPrimary || isComplete ? "primary" : "secondary",
      icon,
      fn: () => {
        if (isWalkIn) onWalkInStatus(id, next as WalkInStatus);
        else onApptStatus(id, next as ApptStatus);
      },
    };
  }

  let primary: ReturnType<typeof transitionAction> | null = null;
  let secondary: ReturnType<typeof transitionAction> | null = null;
  if (canStart) {
    primary = transitionAction(isWalkIn ? "in_consultation" : "in_progress");
    if (item.status === "scheduled" && !isWalkIn) {
      primary = transitionAction("in_progress");
    }
  } else if (canComplete) {
    primary = transitionAction("completed");
  }

  if (canNoShow && !isWalkIn && (item.status === "scheduled" || item.status === "confirmed")) {
    secondary = transitionAction("no_show");
  } else if (canNoShow && isWalkIn && item.status === "waiting") {
    secondary = transitionAction("no_show");
  }

  return (
    <ChartRow
      icon={
        <div className="relative">
          {isWalkIn ? (
            <DoorOpen size={15} className="text-violet-700" />
          ) : (
            <CalendarCheck size={15} className="text-sky-700" />
          )}
          {item.priority === "urgent" ? (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
          ) : null}
        </div>
      }
      iconTone={isWalkIn ? "violet" : "brand"}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-bold text-slate-900 text-sm">{item.patientName}</span>
          {item.kind === "walkin" ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
              Walk-In
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
              Booked
            </span>
          )}
          {item.queueNumber != null ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              <Hash size={10} />
              {item.queueNumber}
            </span>
          ) : null}
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500">
          {item.reason ? (
            <span className="truncate">{item.reason}</span>
          ) : (
            <span className="text-slate-400 italic">—</span>
          )}
        </div>
      }
      pills={[
        <Pill key="status" tone={STATUS_TONE[item.status]}>
          {statusLabel}
        </Pill>,
        item.mode === "video" ? (
          <Pill key="mode" tone="brand">
            <Video size={11} className="mr-1" />
            Video Consultation
          </Pill>
        ) : item.mode === "in_person" ? (
          <Pill key="mode" tone="neutral">
            In-Person Visit
          </Pill>
        ) : null,
        item.bloodGroup ? (
          <Pill key="bg" tone="info">
            {item.bloodGroup}
          </Pill>
        ) : null,
        item.hospitalName ? (
          <Pill key="hospital" tone="neutral">
            {item.hospitalName}
          </Pill>
        ) : null,
      ].filter(Boolean)}
      meta={
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-slate-900">
            {timeLabel}
          </div>
          {item.priority === "urgent" ? (
            <div className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-rose-600 uppercase">
              <AlertTriangle size={10} />
              Urgent
            </div>
          ) : null}
        </div>
      }
      actions={
        <div className="flex items-center gap-1.5">
          {primary ? (
            <Button
              size="sm"
              variant={primary.variant}
              leftIcon={primary.icon}
              onClick={primary.fn}
              loading={isPending}
            >
              {primary.label}
            </Button>
          ) : null}
          {secondary ? (
            <Button
              size="sm"
              variant={secondary.variant}
              leftIcon={secondary.icon}
              onClick={secondary.fn}
              disabled={isPending}
            >
              {secondary.label}
            </Button>
          ) : null}
          {!isWalkIn &&
          item.appointmentId &&
          (item.status === "confirmed" || item.status === "in_progress") ? (
            <button
              type="button"
              onClick={() => onStartVideoVisit(item.appointmentId!)}
              disabled={isPending}
              title="Start Video Teleconsultation"
              className="inline-flex items-center justify-center h-8 px-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Video size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/portal/patients/${item.patientId}/overview`);
            }}
            className="inline-flex items-center justify-center h-8 px-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Open Patient Chart"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      }
      href={`/portal/patients/${item.patientId}/overview`}
      hideChevron
    />
  );
}