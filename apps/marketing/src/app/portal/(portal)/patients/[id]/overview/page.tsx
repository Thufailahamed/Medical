"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Pill,
  FlaskConical,
  FileText,
  Stethoscope,
  CalendarClock,
  CalendarCheck,
  Activity,
  Users,
  Syringe,
  ShieldCheck,
  MessageSquare,
  ChevronRight,
  ListChecks,
  Plus,
  AlertTriangle,
  Heart,
  Clock,
  TrendingUp,
  Send,
  CircleDot,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { formatDate, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import type { PatientOverview } from "@healthcare/shared";

// Approximate "normal" ranges per vital — used to colour-code tiles and
// shade sparkline reference bands. Mirrors the dedicated /vitals tab so
// the overview feels consistent with the rest of the chart.
const NORMAL_RANGES: Record<string, [number, number]> = {
  systolic_bp: [90, 130],
  diastolic_bp: [60, 85],
  heart_rate: [60, 100],
  blood_glucose: [70, 140],
  spo2: [95, 100],
  body_temp: [36.1, 37.5],
  weight: [40, 120],
};

function vitalLabel(type: string) {
  return type.replace(/_/g, " ");
}

const RX_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger"> = {
  signed: "success",
  draft: "neutral",
  cancelled: "danger",
  dispensed: "brand",
};
const LAB_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger"> = {
  ordered: "warn",
  accepted: "brand",
  sample_collected: "brand",
  collected: "brand",
  processing: "brand",
  in_progress: "brand",
  completed: "success",
  cancelled: "danger",
};
const VISIT_TONE: Record<string, "neutral" | "brand" | "success" | "warn" | "danger"> = {
  scheduled: "brand",
  confirmed: "brand",
  in_progress: "brand",
  in_consultation: "brand",
  waiting: "warn",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  signed: "overview.status.signed",
  draft: "overview.status.draft",
  cancelled: "overview.status.cancelled",
  completed: "overview.status.completed",
  scheduled: "overview.status.scheduled",
  missed: "overview.status.missed",
  ordered: "overview.status.ordered",
  accepted: "overview.status.accepted",
  collected: "overview.status.collected",
  processing: "overview.status.processing",
  pending: "overview.status.scheduled",
};

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  seeAllHref?: string;
  seeAllLabel?: string;
  rightSlot?: React.ReactNode;
  emptyTitle?: string;
  emptyAction?: React.ReactNode;
  isEmpty: boolean;
  isLoading: boolean;
  body: React.ReactNode;
  accent?: "default" | "warning" | "danger";
};

function Section({
  title,
  icon,
  seeAllHref,
  seeAllLabel,
  rightSlot,
  emptyTitle,
  emptyAction,
  isEmpty,
  isLoading,
  body,
  accent = "default",
}: SectionProps) {
  const t = useT();
  return (
    <Card
      padding={false}
      className={cn(
        "overflow-hidden",
        accent === "danger" && "border-danger/40 ring-1 ring-danger/20",
        accent === "warning" && "border-warn/40 ring-1 ring-warn/20"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-border/60 bg-gradient-to-r",
          accent === "danger" && "from-danger-soft/60 to-transparent",
          accent === "warning" && "from-warn-soft/40 to-transparent",
          accent === "default" && "from-brand-soft/15 to-transparent"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
              accent === "danger"
                ? "bg-danger-soft text-danger"
                : accent === "warning"
                ? "bg-warn-soft text-amber-700"
                : "bg-brand-soft text-brand"
            )}
          >
            {icon}
          </div>
          <div className="text-sm font-bold text-text tracking-tight">{title}</div>
        </div>
        <div className="shrink-0">
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-strong transition-colors"
            >
              {seeAllLabel ?? t("overview.seeAll")}
              <ChevronRight size={12} />
            </Link>
          ) : rightSlot ? (
            rightSlot
          ) : null}
        </div>
      </div>
      <div className="px-4 md:px-5 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : isEmpty ? (
          <Empty
            title={emptyTitle ?? "—"}
            className="py-6"
            action={emptyAction}
          />
        ) : (
          body
        )}
      </div>
    </Card>
  );
}

function Sparkline({ points }: { points: Array<{ value: number; recordedAt: string }> }) {
  if (!points || points.length === 0) return null;
  const data = points
    .slice()
    .sort((a, b) => +parseISO(a.recordedAt) - +parseISO(b.recordedAt))
    .map((p) => ({ v: p.value }));
  return (
    <div style={{ height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VitalTile({
  l,
  type,
}: {
  l: PatientOverview["vitals"]["latest"][number];
  type: string;
}) {
  const range = NORMAL_RANGES[type];
  const points = Array.isArray((l as any).series) ? (l as any).series : [];
  const valueStr =
    l.value != null
      ? `${l.value}${l.secondaryValue != null ? "/" + l.secondaryValue : ""}`
      : "—";

  const tone =
    l.classification === "critical"
      ? "danger"
      : l.classification === "abnormal" || l.classification === "warning"
      ? "warn"
      : "neutral";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-surface px-3 py-2.5 flex flex-col gap-1.5 overflow-hidden transition-all hover:shadow-sm",
        tone === "danger"
          ? "border-danger/30 ring-1 ring-danger/20"
          : tone === "warn"
          ? "border-warn/30 ring-1 ring-warn/20"
          : "border-border/70"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase font-bold tracking-wider text-text-soft truncate">
          {vitalLabel(type)}
        </div>
        {l.classification ? (
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              tone === "danger" && "bg-danger animate-pulse",
              tone === "warn" && "bg-warn",
              tone === "neutral" && "bg-emerald-500"
            )}
          />
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight",
            tone === "danger"
              ? "text-danger"
              : tone === "warn"
              ? "text-amber-700"
              : "text-text"
          )}
        >
          {valueStr}
        </div>
        <span className="text-[10px] text-text-soft font-medium uppercase">
          {l.unit ?? ""}
        </span>
      </div>
      <div className={cn("text-text-soft", tone === "danger" && "text-danger", tone === "warn" && "text-amber-700")}>
        <Sparkline points={points} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        {l.recordedAt ? (
          <span className="inline-flex items-center gap-1">
            <Clock size={9} />
            {format(parseISO(l.recordedAt), "MMM d, HH:mm")}
          </span>
        ) : null}
        {range ? (
          <span className="tabular-nums">
            {range[0]}–{range[1]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RecordTypeChip({ type, count }: { type: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2 hover:border-brand/40 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <CircleDot size={11} className="text-brand shrink-0" />
        <div className="text-xs font-medium text-text truncate">{vitalLabel(type)}</div>
      </div>
      <PillBadge tone="brand">{count}</PillBadge>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "brand" | "danger" | "warn" | "success";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5",
        tone === "danger"
          ? "border-danger/30 bg-danger-soft/40"
          : tone === "warn"
          ? "border-warn/30 bg-warn-soft/30"
          : tone === "brand"
          ? "border-brand/30 bg-brand-soft/40"
          : "border-border/60 bg-surface-2/30"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          tone === "danger" && "bg-danger text-white",
          tone === "warn" && "bg-warn text-white",
          tone === "brand" && "bg-brand text-white",
          tone === "neutral" && "bg-surface text-text-soft",
          tone === "success" && "bg-emerald-500 text-white"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            "text-lg font-bold tabular-nums leading-tight",
            tone === "danger"
              ? "text-danger"
              : tone === "warn"
              ? "text-amber-700"
              : "text-text"
          )}
        >
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wide font-semibold text-text-soft">
          {label}
        </div>
        {sub ? <div className="text-[10px] text-text-muted mt-0.5">{sub}</div> : null}
      </div>
    </div>
  );
}

export default function PatientOverviewTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();

  const base = `/portal/patients/${id}`;
  const { data, isLoading } = useQuery({
    queryKey: qk.patientOverview(id),
    queryFn: () => api<PatientOverview>(`/doctor-portal/patients/${id}/overview`),
    enabled: !!id,
    retry: 1,
  });

  const sortedLatestWithSeries = useMemo(() => {
    if (!data) return [];
    return data.vitals.latest.map((l: any) => ({
      ...l,
      series: data.vitals.series?.[l.type] ?? [],
    }));
  }, [data]);

  if (!data && !isLoading) {
    return (
      <Card>
        <Empty
          title={t("overview.empty.recordsSummary")}
          description="Could not load patient overview. Try again."
        />
      </Card>
    );
  }

  const counts = data?.records.counts.byType ?? {};
  const recordTypeEntries = Object.entries(counts).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );

  const activeMedsCount = data?.activeMedicines?.length ?? 0;
  const vitalsCount = data?.vitals.latest?.length ?? 0;
  const rxCount = data?.prescriptions.recent?.length ?? 0;
  const recordsTotal = data?.records.counts.total ?? 0;
  const nextVisit = data?.visits.nextScheduled;
  const nextVisitSub = nextVisit
    ? `${formatDate(nextVisit.date)}${nextVisit.time ? " · " + nextVisit.time : ""}`
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Quick actions bar ─────────────────────────── */}
      <Card padding={false}>
        <div className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted mr-1 hidden md:block">
            Quick actions
          </div>
          <Link href={`${base}/clinical-notes`} className="flex-1 min-w-[140px]">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:border-brand hover:bg-brand-soft/40 transition-colors">
              <Stethoscope size={13} className="text-brand" />
              {t("overview.action.addNote")}
            </button>
          </Link>
          <Link href={`${base}/prescriptions`} className="flex-1 min-w-[140px]">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:border-brand hover:bg-brand-soft/40 transition-colors">
              <Pill size={13} className="text-brand" />
              {t("overview.action.addPrescription")}
            </button>
          </Link>
          <Link href={`${base}/lab-orders`} className="flex-1 min-w-[140px]">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:border-brand hover:bg-brand-soft/40 transition-colors">
              <FlaskConical size={13} className="text-brand" />
              {t("overview.action.addLabOrder")}
            </button>
          </Link>
          <Link href={`${base}/follow-ups`} className="flex-1 min-w-[140px]">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:border-brand hover:bg-brand-soft/40 transition-colors">
              <CalendarClock size={13} className="text-brand" />
              {t("overview.action.addFollowUp")}
            </button>
          </Link>
          <Link href="/portal/book-appointment" className="flex-1 min-w-[140px]">
            <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:border-brand hover:bg-brand-soft/40 transition-colors">
              <CalendarCheck size={13} className="text-brand" />
              {t("overview.action.bookVisit")}
            </button>
          </Link>
        </div>
      </Card>

      {/* ─── Hero stat strip ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        <StatTile
          icon={<Pill size={14} />}
          label={t("overview.section.activeMeds")}
          value={activeMedsCount}
          tone="brand"
        />
        <StatTile
          icon={<Activity size={14} />}
          label={t("overview.section.vitals")}
          value={vitalsCount}
          tone="neutral"
        />
        <StatTile
          icon={<FileText size={14} />}
          label="Prescriptions"
          value={rxCount}
          tone="neutral"
        />
        <StatTile
          icon={<ListChecks size={14} />}
          label={t("overview.section.recordsSummary")}
          value={recordsTotal}
          tone="neutral"
        />
        <StatTile
          icon={<CalendarCheck size={14} />}
          label={t("overview.nextVisit")}
          value={nextVisit ? relativeTime(nextVisit.date) : "—"}
          sub={nextVisitSub}
          tone={nextVisit ? "success" : "neutral"}
        />
      </div>

      {/* ─── Alerts banner ─────────────────────────── */}
      {data?.vitals.alerts && data.vitals.alerts.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft/60 px-4 py-3">
          <div className="h-9 w-9 rounded-xl bg-danger text-white flex items-center justify-center shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-danger">
              {t("overview.section.alerts")}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.vitals.alerts.slice(0, 6).map((al, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-danger"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                  {al.label}
                  <PillBadge tone="danger">{al.classification}</PillBadge>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── 2-column body: main + sidebar ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Active medicines */}
          <Section
            title={t("overview.section.activeMeds")}
            icon={<Pill size={15} />}
            seeAllHref={`${base}/medications`}
            isLoading={isLoading}
            isEmpty={(data?.activeMedicines?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.activeMeds")}
            emptyAction={
              <Link href={`${base}/prescriptions`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.addPrescription")}
                </Button>
              </Link>
            }
            body={
              <ul className="flex flex-col">
                {(data?.activeMedicines ?? []).slice(0, 5).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                      <Pill size={13} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                        {m.instructions ? ` · ${m.instructions}` : ""}
                      </div>
                    </div>
                    {m.active ? (
                      <PillBadge tone="success">{t("overview.medicineActive")}</PillBadge>
                    ) : null}
                    {m.endDate ? (
                      <span className="text-[11px] text-text-muted shrink-0 hidden md:inline">
                        → {formatDate(m.endDate)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            }
          />

          {/* Vitals */}
          <Section
            title={t("overview.section.vitals")}
            icon={<Activity size={15} />}
            seeAllHref={`${base}/vitals`}
            isLoading={isLoading}
            isEmpty={sortedLatestWithSeries.length === 0}
            emptyTitle={t("vitals.empty")}
            body={
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {sortedLatestWithSeries.slice(0, 9).map((l) => (
                  <VitalTile key={l.type} l={l} type={l.type} />
                ))}
              </div>
            }
          />

          {/* Prescriptions */}
          <Section
            title={t("overview.section.prescriptions")}
            icon={<FileText size={15} />}
            seeAllHref={`${base}/prescriptions`}
            rightSlot={
              data?.prescriptions.activeCount ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <Heart size={11} />
                  {data.prescriptions.activeCount} active
                </span>
              ) : null
            }
            isLoading={isLoading}
            isEmpty={(data?.prescriptions.recent?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.prescriptions")}
            emptyAction={
              <Link href={`${base}/prescriptions`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.addPrescription")}
                </Button>
              </Link>
            }
            body={
              <ul className="flex flex-col">
                {(data?.prescriptions.recent ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                      <FileText size={13} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {r.title || r.diagnosis || t("prescription.untitled")}
                      </div>
                      {r.diagnosis ? (
                        <div className="text-[11px] text-text-muted truncate">
                          {r.diagnosis}
                        </div>
                      ) : null}
                    </div>
                    <PillBadge tone={RX_TONE[r.status] ?? "neutral"}>
                      {t(STATUS_LABEL_KEYS[r.status] ?? r.status)}
                    </PillBadge>
                    <span className="text-[11px] text-text-muted shrink-0 hidden md:inline">
                      {formatDate(r.date)}
                    </span>
                  </li>
                ))}
              </ul>
            }
          />

          {/* Lab orders + reports */}
          <Section
            title={t("overview.section.labOrders")}
            icon={<FlaskConical size={15} />}
            seeAllHref={`${base}/lab-orders`}
            isLoading={isLoading}
            isEmpty={
              (data?.labOrders.recent?.length ?? 0) === 0 &&
              (data?.labReports.recent?.length ?? 0) === 0
            }
            emptyTitle={t("overview.empty.labOrders")}
            emptyAction={
              <Link href={`${base}/lab-orders`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.addLabOrder")}
                </Button>
              </Link>
            }
            body={
              <div className="flex flex-col gap-3">
                {data?.labOrders.recent?.length ? (
                  <ul className="flex flex-col">
                    {data.labOrders.recent.slice(0, 4).map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                      >
                        <div className="h-8 w-8 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                          <FlaskConical size={13} className="text-info" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text truncate">
                            {o.tests.length ? o.tests.join(", ") : t("labs.untitled")}
                          </div>
                          <div className="text-[11px] text-text-muted truncate">
                            {o.notes || o.priority}
                          </div>
                        </div>
                        <PillBadge tone={LAB_TONE[o.status] ?? "neutral"}>
                          {t(STATUS_LABEL_KEYS[o.status] ?? o.status)}
                        </PillBadge>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {data?.labReports.recent?.length ? (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-2">
                      {t("overview.section.labReports")}
                    </div>
                    <ul className="flex flex-col">
                      {data.labReports.recent.slice(0, 3).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-2 py-1.5 text-xs"
                        >
                          <span className="text-text-soft flex-1 truncate">
                            {r.reportType || "—"}
                          </span>
                          <PillBadge tone="neutral">{r.status}</PillBadge>
                          <span className="text-text-muted">{formatDate(r.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            }
          />

          {/* Clinical notes */}
          <Section
            title={t("overview.section.clinicalNotes")}
            icon={<Stethoscope size={15} />}
            seeAllHref={`${base}/clinical-notes`}
            isLoading={isLoading}
            isEmpty={(data?.clinicalNotes.recent?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.clinicalNotes")}
            emptyAction={
              <Link href={`${base}/clinical-notes`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.addNote")}
                </Button>
              </Link>
            }
            body={
              <ul className="flex flex-col">
                {(data?.clinicalNotes.recent ?? []).map((n) => (
                  <li
                    key={n.id}
                    className="flex flex-col gap-0.5 py-2.5 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                        <Stethoscope size={12} className="text-brand" />
                      </div>
                      <span className="text-sm font-semibold text-text truncate flex-1">
                        {n.title || t("prescription.untitled")}
                      </span>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    {n.diagnosis ? (
                      <div className="text-[11px] text-text-soft pl-9">Dx: {n.diagnosis}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            }
          />

          {/* Visits */}
          <Section
            title={t("overview.section.visits")}
            icon={<CalendarCheck size={15} />}
            seeAllHref={`${base}/visits`}
            rightSlot={
              data?.visits.nextScheduled ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <TrendingUp size={11} />
                  {t("overview.nextVisit")} · {relativeTime(data.visits.nextScheduled.date)}
                </span>
              ) : null
            }
            isLoading={isLoading}
            isEmpty={(data?.visits.recent?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.visits")}
            emptyAction={
              <Link href="/portal/book-appointment">
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.bookVisit")}
                </Button>
              </Link>
            }
            body={
              <ul className="flex flex-col">
                {(data?.visits.recent ?? []).slice(0, 5).map((v) => (
                  <li
                    key={`${v.kind}-${v.id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        v.kind === "walkin"
                          ? "bg-warn-soft text-amber-700"
                          : "bg-brand-soft text-brand"
                      )}
                    >
                      <CalendarCheck size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate capitalize">
                        {v.kind === "walkin" ? "Walk-in" : "Appointment"}
                        {v.reason ? ` · ${v.reason}` : ""}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {formatDate(v.date)}
                        {v.time ? ` · ${v.time}` : ""}
                      </div>
                    </div>
                    <PillBadge tone={VISIT_TONE[v.status] ?? "neutral"}>
                      {t(STATUS_LABEL_KEYS[v.status] ?? v.status)}
                    </PillBadge>
                  </li>
                ))}
              </ul>
            }
          />
        </div>

        {/* Sidebar (1/3) */}
        <div className="flex flex-col gap-4">
          {/* Follow-ups */}
          <Section
            title={t("overview.section.followUps")}
            icon={<CalendarClock size={15} />}
            seeAllHref={`${base}/follow-ups`}
            rightSlot={
              data?.followUps.missed ? (
                <PillBadge tone="danger">
                  {data.followUps.missed} {t("overview.dueOverdue")}
                </PillBadge>
              ) : null
            }
            isLoading={isLoading}
            isEmpty={(data?.followUps.upcoming?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.followUps")}
            emptyAction={
              <Link href={`${base}/follow-ups`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.action.addFollowUp")}
                </Button>
              </Link>
            }
            body={
              <ul className="flex flex-col">
                {(data?.followUps.upcoming ?? []).map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                      <CalendarClock size={13} className="text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{f.title}</div>
                      {f.notes ? (
                        <div className="text-[11px] text-text-muted truncate">{f.notes}</div>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {relativeTime(f.followUpDate)}
                    </span>
                  </li>
                ))}
              </ul>
            }
          />

          {/* Family history */}
          <Section
            title={t("overview.section.familyHistory")}
            icon={<Users size={15} />}
            isLoading={isLoading}
            isEmpty={(data?.familyHistory?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.familyHistory")}
            body={
              <ul className="flex flex-col">
                {(data?.familyHistory ?? []).map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-col gap-1 py-2.5 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-text">{f.name}</span>
                      <PillBadge tone="neutral">{f.relationship}</PillBadge>
                      {f.isDeceased ? <PillBadge tone="warn">deceased</PillBadge> : null}
                    </div>
                    <div className="text-[11px] flex flex-wrap gap-1">
                      {f.conditions.map((c, idx) => (
                        <PillBadge key={idx} tone="warn">
                          {c}
                        </PillBadge>
                      ))}
                      {f.isDeceased && f.causeOfDeath ? (
                        <span className="text-text-muted self-center">
                          {t("overview.familyConditions")}: {f.causeOfDeath}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            }
          />

          {/* Vaccinations */}
          <Section
            title={t("overview.section.vaccinations")}
            icon={<Syringe size={15} />}
            isLoading={isLoading}
            isEmpty={(data?.vaccinations?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.vaccinations")}
            body={
              <ul className="flex flex-col">
                {(data?.vaccinations ?? []).slice(0, 6).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-info-soft flex items-center justify-center shrink-0">
                      <Syringe size={13} className="text-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {v.vaccine}
                      </div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wide">
                        {v.shortName ? `${v.shortName} · ` : ""}dose {v.doseNumber}
                      </div>
                    </div>
                    {v.nextDueAt ? (
                      <span className="text-[11px] text-brand font-semibold shrink-0">
                        → {relativeTime(v.nextDueAt)}
                      </span>
                    ) : v.administeredAt ? (
                      <PillBadge tone="success">given</PillBadge>
                    ) : null}
                  </li>
                ))}
              </ul>
            }
          />

          {/* Insurance */}
          <Section
            title={t("overview.section.insurance")}
            icon={<ShieldCheck size={15} />}
            isLoading={isLoading}
            isEmpty={!data?.insurance}
            emptyTitle={t("overview.insuranceMissing")}
            emptyAction={
              <Link href={`${base}/records`}>
                <Button size="sm" leftIcon={<Plus size={14} />}>
                  {t("overview.addInsurance")}
                </Button>
              </Link>
            }
            body={
              data?.insurance ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-gradient-to-br from-brand-soft/40 to-surface-2/40 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-text truncate">
                        {data.insurance.provider}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        #{data.insurance.policyNumber}
                        {data.insurance.coverageType ? ` · ${data.insurance.coverageType}` : ""}
                      </div>
                    </div>
                  </div>
                  {data.insurance.validUntil ? (
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <span className="text-[10px] uppercase tracking-wide text-text-muted font-bold">
                        Valid until
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {formatDate(data.insurance.validUntil)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null
            }
          />

          {/* Messages preview */}
          <Section
            title={t("overview.section.messages")}
            icon={<MessageSquare size={15} />}
            seeAllHref="/portal/messages"
            rightSlot={
              data?.messages.unreadCount ? (
                <PillBadge tone="danger">{data.messages.unreadCount}</PillBadge>
              ) : null
            }
            isLoading={isLoading}
            isEmpty={!data?.messages.lastConversation}
            emptyTitle={t("overview.noMessages")}
            body={
              data?.messages.lastConversation ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-gradient-to-br from-info-soft/40 to-surface-2/40 p-3">
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    <div className="h-7 w-7 rounded-full bg-info text-white flex items-center justify-center shrink-0">
                      <Send size={11} />
                    </div>
                    <span className="font-semibold text-text truncate flex-1">
                      {data.messages.lastConversation.lastMessagePreview || "—"}
                    </span>
                    <span className="text-text-muted shrink-0">
                      {relativeTime(data.messages.lastConversation.lastMessageAt)}
                    </span>
                  </div>
                  <Link
                    href="/portal/messages"
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-brand-strong transition-colors"
                  >
                    {t("overview.action.openInbox")}
                    <ChevronRight size={11} />
                  </Link>
                </div>
              ) : null
            }
          />

          {/* Records by type */}
          <Section
            title={t("overview.section.recordsSummary")}
            icon={<ListChecks size={15} />}
            seeAllHref={`${base}/records`}
            rightSlot={
              data?.records.counts.total ? (
                <PillBadge tone="brand">{data.records.counts.total}</PillBadge>
              ) : null
            }
            isLoading={isLoading}
            isEmpty={recordTypeEntries.length === 0}
            emptyTitle={t("overview.empty.recordsSummary")}
            body={
              <div className="flex flex-col gap-1.5">
                {recordTypeEntries.map(([type, count]) => (
                  <RecordTypeChip key={type} type={type} count={count as number} />
                ))}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}