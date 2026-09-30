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
  Clock,
  Video,
  Plus,
  CalendarPlus,
  Stethoscope,
  CheckCircle2,
  Droplet,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

import { api, qk, teleconsultApi } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { type FilterOption } from "@/portal/components/chart";
import { Avatar } from "@/portal/components/ui/Avatar";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PrimaryLink,
  SecondaryLink,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
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
  const pending =
    apptMutation.isPending || walkinMutation.isPending || startVideoVisit.isPending;

  // Group rows by stage so the doctor reads the room top-down.
  const groups = useMemo(() => {
    const order: Array<{ key: Stage; label: string }> = [
      { key: "room", label: "In the room" },
      { key: "waiting", label: "Waiting & upcoming" },
      { key: "done", label: "Finished" },
    ];
    return order
      .map((g) => ({ ...g, items: filteredItems.filter((i) => stageOf(i.status) === g.key) }))
      .filter((g) => g.items.length > 0);
  }, [filteredItems]);

  const nextPatient = items.find((i) => i.status === "waiting" || i.status === "confirmed" || i.status === "scheduled");

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      {/* ── Hero + stat strip ─────────────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<ListOrdered size={13} aria-hidden />}
          kicker="Live queue"
          kickerMeta={format(new Date(), "EEEE, MMMM d")}
          title="Today's queue"
          description={
            isLoading
              ? "Loading today's patient flow…"
              : counts.inProgress > 0
                ? `${counts.inProgress} in consultation · ${counts.waiting} waiting${nextPatient ? ` · next: ${nextPatient.patientName}` : ""}.`
                : activeCount > 0 || nextPatient
                  ? `${counts.waiting} waiting${nextPatient ? ` — ${nextPatient.patientName} is next` : ""}. Start a consultation when you're ready.`
                  : "No one is waiting right now. Patients appear here as they check in or their appointment time arrives."
          }
          chips={
            <span className={HERO_CHIP}>
              <span className={cn("h-2 w-2 rounded-full bg-emerald-400", isFetching ? "animate-ping" : "animate-pulse")} aria-hidden />
              Live · refreshes every 30s
              {dataUpdatedAt ? (
                <span className="text-white/50">· updated {relativeTime(new Date(dataUpdatedAt).toISOString())}</span>
              ) : null}
            </span>
          }
          actions={
            <>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className={HERO_GHOST}>
                <RefreshCw size={15} className={cn(isFetching && "animate-spin")} aria-hidden />
                Refresh
              </button>
              <Link href="/portal/walk-ins" className={HERO_PRIMARY}>
                <DoorOpen size={15} className="text-sky-600" aria-hidden />
                Check in walk-in
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Waiting"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(counts.waiting)}
            unit={counts.waiting === 1 ? "patient" : "patients"}
            sub={counts.waiting > 0 ? "Checked in at reception" : "Reception is clear"}
            pulse={counts.waiting > 0}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label="In consultation"
            icon={<Play size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(counts.inProgress)}
            sub={counts.inProgress > 0 ? "Encounter in progress" : "Room is free"}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label="Completed"
            icon={<Check size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(counts.completed)}
            unit={items.length > 0 ? `of ${items.length}` : undefined}
            sub="Discharged today"
            progress={items.length > 0 ? Math.round((counts.completed / items.length) * 100) : null}
            onClick={() => setFilter("completed")}
          />
          <StatTile
            label="No-shows"
            icon={<X size={16} />}
            tone="bg-rose-50 text-rose-500"
            value={String(counts.noShow)}
            sub="Missed or absent"
            onClick={() => setFilter("completed")}
          />
        </HeroOverlap>
      </div>

      {/* ── Queue ─────────────────────────────────────────────────────── */}
      <section className={cn(PANEL, "p-0 sm:p-0")} aria-label="Patient queue">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Segmented
            ariaLabel="Queue filter"
            value={filter}
            onChange={(v) => setFilter(v)}
            options={filterOptions.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
          />
          <Segmented<string | null>
            ariaLabel="Encounter mode"
            value={modeFilter}
            onChange={(m) => {
              const params = new URLSearchParams(searchParams.toString());
              if (m) params.set("mode", m);
              else params.delete("mode");
              const qs = params.toString();
              router.replace(qs ? `?${qs}` : "?", { scroll: false });
            }}
            options={[
              { value: null, label: "All modes" },
              { value: "video", label: "Video", icon: <Video size={12} aria-hidden /> },
              { value: "in_person", label: "In-person", icon: <Stethoscope size={12} aria-hidden /> },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyBlock
              className="mt-0 py-12"
              icon={<ListOrdered size={20} />}
              title={items.length === 0 ? "The queue is empty" : "Nothing matches this filter"}
              body={
                items.length === 0
                  ? "As patients check in at reception, scan their Health ID, or reach their appointment time, they'll appear here."
                  : "Try another filter to see the rest of today's patients."
              }
              actions={
                <>
                  <PrimaryLink href="/portal/walk-ins" icon={<Plus size={13} strokeWidth={2.5} />}>
                    Check in walk-in
                  </PrimaryLink>
                  <SecondaryLink href="/portal/schedule" icon={<CalendarPlus size={13} />}>
                    Schedule appointment
                  </SecondaryLink>
                </>
              }
            />
          </div>
        ) : (
          <div className="pb-2">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-6">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      g.key === "room" ? "bg-sky-500" : g.key === "waiting" ? "bg-amber-500" : "bg-slate-300",
                    )}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-slate-500">{g.label}</span>
                  <span className="text-xs text-slate-400">{g.items.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((item) => (
                    <QueueRow
                      key={`${item.kind}-${item.appointmentId ?? item.walkInId}`}
                      item={item}
                      isPending={pending}
                      onApptStatus={(id, status) => apptMutation.mutate({ id, status })}
                      onWalkInStatus={(id, status) => walkinMutation.mutate({ id, status })}
                      onStartVideoVisit={(appointmentId) => startVideoVisit.mutate(appointmentId)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Stages ─────────────────────────────────────────────────────────────
type Stage = "room" | "waiting" | "done";

function stageOf(status: AnyStatus): Stage {
  if (status === "in_progress" || status === "in_consultation") return "room";
  if (status === "waiting" || status === "scheduled" || status === "confirmed") return "waiting";
  return "done";
}

const STAGE_BAR: Record<Stage, string> = {
  room: "bg-sky-500",
  waiting: "bg-amber-400",
  done: "bg-slate-200",
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
};

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

  const isWalkIn = item.kind === "walkin";
  const id = item.appointmentId ?? item.walkInId ?? "";
  const stage = stageOf(item.status);
  const chartHref = `/portal/patients/${item.patientId}/overview`;

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
      ? relativeTime(item.arrivedAt)
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
      variant: isDanger ? "ghost" : isPrimary || isComplete ? "primary" : "secondary",
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
  } else if (canComplete) {
    primary = transitionAction("completed");
  }

  if (canNoShow && !isWalkIn && (item.status === "scheduled" || item.status === "confirmed")) {
    secondary = transitionAction("no_show");
  } else if (canNoShow && isWalkIn && item.status === "waiting") {
    secondary = transitionAction("no_show");
  }

  return (
    <li
      className={cn(
        "group relative flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-slate-50/80 sm:flex-nowrap sm:px-6",
        stage === "room" && "bg-sky-50/40",
      )}
    >
      <span className={cn("absolute inset-y-2 left-0 w-1 rounded-r-full", STAGE_BAR[stage])} aria-hidden />

      {/* Token / time */}
      <div className="w-14 shrink-0 text-center">
        {item.queueNumber != null ? (
          <>
            <div className="font-mono text-lg font-semibold leading-none tabular-nums text-slate-900">
              {String(item.queueNumber).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[10.5px] text-slate-400">token</div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold leading-none tabular-nums text-slate-900">
              {timeLabel}
            </div>
            <div className="mt-1 text-[10.5px] text-slate-400">{isWalkIn ? "arrived" : "booked"}</div>
          </>
        )}
      </div>

      {/* Patient */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={item.patientName} src={item.patientPhoto ?? null} size="sm" />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-white",
              isWalkIn ? "bg-violet-500 text-white" : "bg-sky-500 text-white",
            )}
            aria-hidden
          >
            {isWalkIn ? <DoorOpen size={9} /> : <CalendarCheck size={9} />}
          </span>
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={chartHref}
              className="truncate text-sm font-semibold text-slate-900 hover:text-sky-700"
            >
              {item.patientName}
            </Link>
            {item.priority === "urgent" ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-600">
                <AlertTriangle size={10} aria-hidden />
                Urgent
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="truncate">{item.reason ?? (isWalkIn ? "Walk-in consultation" : "Scheduled consultation")}</span>
            {item.mode === "video" ? (
              <span className="inline-flex items-center gap-1 text-sky-600">
                <Video size={11} aria-hidden />
                Video
              </span>
            ) : null}
            {item.bloodGroup ? (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Droplet size={11} className="text-rose-400" aria-hidden />
                {item.bloodGroup}
              </span>
            ) : null}
            {item.hospitalName ? (
              <span className="hidden items-center gap-1 text-slate-400 md:inline-flex">
                <Building2 size={11} aria-hidden />
                {item.hospitalName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
        <span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", TONE_CLASS[STATUS_TONE[item.status]])}>
          {statusLabel}
        </span>
        {item.queueNumber != null ? (
          <span className="text-[11px] text-slate-400 tabular-nums">{timeLabel}</span>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto">
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
            title="Start video consultation"
            aria-label="Start video consultation"
            className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
          >
            <Video size={14} />
          </button>
        ) : null}
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
        ) : stage === "done" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
            <CheckCircle2 size={13} aria-hidden />
            Closed
          </span>
        ) : null}
        <Link
          href={chartHref}
          title="Open patient chart"
          aria-label={`Open ${item.patientName}'s chart`}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ExternalLink size={14} />
        </Link>
      </div>
    </li>
  );
}
