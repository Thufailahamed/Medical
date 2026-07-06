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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListOrdered,
  RefreshCw,
  User as UserIcon,
  CalendarCheck,
  DoorOpen,
  Play,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  Hash,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import {
  ChartList,
  ChartRow,
  FilterPills,
  type FilterOption,
} from "@/portal/components/chart";
import { useT } from "@/portal/i18n";
import { formatTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

// ─── Status vocabulary ──────────────────────────────────────────────────
//
// Two domains — appointments use {scheduled, confirmed, in_progress, ...}
// walk-ins use {waiting, in_consultation, ...}. The page maps both
// onto one logical UX (active / completed / no-show) without leaking
// the divergence into the UI.

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

const DONE_STATUSES: Set<AnyStatus> = new Set([
  "completed",
  "cancelled",
  "no_show",
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

// ─── Main page ──────────────────────────────────────────────────────────

export default function QueuePage() {
  const t = useT();
  const qc = useQueryClient();
  const date = useMemo(todayIso, []);
  const [filter, setFilter] = useState<QueueFilter>("active");

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: qk.doctorQueue(date),
    queryFn: () => api<QueueResp>(`/doctor-portal/queue?date=${date}`),
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

  // ─── Render ─────────────────────────────────────────────────────────

  const activeCount = counts.waiting + counts.inProgress;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("queue.title")}
        subtitle={
          dataUpdatedAt
            ? t("queue.lastUpdated", {
                time: relativeTime(new Date(dataUpdatedAt).toISOString()),
              })
            : t("queue.subtitle")
        }
        icon={<ListOrdered size={16} />}
        badge={
          activeCount > 0 ? (
            <Pill tone="warn">{activeCount} {t("queue.filter.active").toLowerCase()}</Pill>
          ) : null
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={12} className={cn(isFetching && "animate-spin")} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {t("queue.action.refresh")}
          </Button>
        }
      />

      {/* ─── Hero stat strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatMini
          icon={<Clock size={14} />}
          label={t("queue.stat.waiting")}
          value={counts.waiting}
          tone="brand"
        />
        <StatMini
          icon={<Play size={14} />}
          label={t("queue.stat.inProgress")}
          value={counts.inProgress}
          tone="warn"
        />
        <StatMini
          icon={<Check size={14} />}
          label={t("queue.stat.completed")}
          value={counts.completed}
          tone="success"
        />
        <StatMini
          icon={<X size={14} />}
          label={t("queue.stat.noShow")}
          value={counts.noShow}
          tone="danger"
        />
      </div>

      {/* ─── Filters + list ─────────────────────────────────────────── */}
      <Card padding={false}>
        <div className="px-3 md:px-4 py-3 border-b border-border/60 bg-surface-2/30">
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            size="sm"
          />
        </div>

        {isLoading ? (
          <div className="px-3 md:px-4 py-3 flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-3 md:px-4 py-12">
            <Empty
              icon={<ListOrdered size={28} />}
              title={t("queue.empty.title")}
              description={t("queue.empty.description")}
            />
          </div>
        ) : (
          <ChartList
            items={filteredItems}
            isLoading={false}
            isEmpty={false}
            emptyState={<Empty title={t("queue.empty.title")} />}
            renderRow={(item) => (
              <QueueRow
                key={`${item.kind}-${item.appointmentId ?? item.walkInId}`}
                item={item}
                isPending={
                  apptMutation.isPending || walkinMutation.isPending
                }
                onApptStatus={(id, status) =>
                  apptMutation.mutate({ id, status })
                }
                onWalkInStatus={(id, status) =>
                  walkinMutation.mutate({ id, status })
                }
              />
            )}
            skeletonCount={3}
          />
        )}
      </Card>
    </div>
  );
}

// ─── Stat mini (count tile) ─────────────────────────────────────────────

function StatMini({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "brand" | "warn" | "success" | "danger";
}) {
  const toneBg = {
    brand: "border-brand/30 bg-brand-soft/40",
    warn: "border-warn/30 bg-warn-soft/40",
    success: "border-emerald-200 bg-emerald-50/50",
    danger: "border-danger/30 bg-danger-soft/40",
  }[tone];

  const iconBg = {
    brand: "bg-brand text-white",
    warn: "bg-warn text-white",
    success: "bg-emerald-600 text-white",
    danger: "bg-danger text-white",
  }[tone];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        toneBg
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          iconBg
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-tight text-text">
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wide font-semibold text-text-soft truncate">
          {label}
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
}: {
  item: QueueItem;
  isPending: boolean;
  onApptStatus: (id: string, status: ApptStatus) => void;
  onWalkInStatus: (id: string, status: WalkInStatus) => void;
}) {
  const t = useT();

  const isWalkIn = item.kind === "walkin";
  const id = item.appointmentId ?? item.walkInId ?? "";

  const transitions = isWalkIn
    ? (WALKIN_TRANSITIONS[item.status as WalkInStatus] ?? [])
    : (APPT_TRANSITIONS[item.status as ApptStatus] ?? []);

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

  // Map transition to friendly action label.
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

  // Determine the "primary action" — the most important next step.
  let primary: ReturnType<typeof transitionAction> | null = null;
  let secondary: ReturnType<typeof transitionAction> | null = null;
  if (canStart) {
    primary = transitionAction(isWalkIn ? "in_consultation" : "in_progress");
    if (item.status === "scheduled" && !isWalkIn) {
      // appointments can confirm first
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
            <DoorOpen size={14} className="text-violet-700" />
          ) : (
            <CalendarCheck size={14} className="text-brand" />
          )}
          {item.priority === "urgent" ? (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger animate-pulse" />
          ) : null}
        </div>
      }
      iconTone={isWalkIn ? "violet" : "brand"}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-semibold">{item.patientName}</span>
          {item.kind === "walkin" ? (
            <Pill tone="violet" className="text-[9px]">
              {t("queue.row.walkIn")}
            </Pill>
          ) : (
            <Pill tone="brand" className="text-[9px]">
              {t("queue.row.appointment")}
            </Pill>
          )}
          {item.queueNumber != null ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted shrink-0">
              <Hash size={9} />
              {item.queueNumber}
            </span>
          ) : null}
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 min-w-0">
          {item.reason ? (
            <span className="truncate">{item.reason}</span>
          ) : (
            <span className="text-text-muted italic">—</span>
          )}
        </div>
      }
      pills={[
        <Pill key="status" tone={STATUS_TONE[item.status]}>
          {statusLabel}
        </Pill>,
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
          <div className="text-sm font-semibold tabular-nums text-text">
            {timeLabel}
          </div>
          {item.priority === "urgent" ? (
            <div className="inline-flex items-center gap-0.5 text-[9px] font-bold text-danger uppercase">
              <AlertTriangle size={9} />
              {t("queue.row.urgent")}
            </div>
          ) : null}
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
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
          <Link
            href={`/portal/patients/${item.patientId}/overview`}
            className="inline-flex items-center justify-center h-8 px-2.5 rounded-xl text-xs font-semibold text-text-soft hover:text-text hover:bg-surface-2 transition-colors"
            title={t("queue.action.openChart")}
          >
            <ExternalLink size={11} />
          </Link>
        </div>
      }
      href={`/portal/patients/${item.patientId}/overview`}
      hideChevron
    />
  );
}