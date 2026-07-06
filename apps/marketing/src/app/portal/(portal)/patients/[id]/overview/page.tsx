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
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  ReferenceArea,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api, qk } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import type { PatientOverview } from "@healthcare/shared";

// Map vital type → approximate "normal" range to shade sparklines.
// Mirrors the dedicated /vitals tab so the overview feels consistent.
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
  children?: React.ReactNode;
  body?: React.ReactNode;
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
  children,
  body,
}: SectionProps) {
  const t = useT();
  return (
    <Card padding={false}>
      <div className="px-4 md:px-5 pt-4 md:pt-5">
        <CardHeader
          title={title}
          icon={icon}
          right={
            seeAllHref ? (
              <Link
                href={seeAllHref}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-strong transition-colors"
              >
                {seeAllLabel ?? t("overview.seeAll")}
                <ChevronRight size={12} />
              </Link>
            ) : rightSlot ? (
              rightSlot
            ) : null
          }
        />
      </div>
      <div className="px-4 md:px-5 pb-4 md:pb-5">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isEmpty ? (
          <Empty
            icon={icon}
            title={emptyTitle ?? "—"}
            className="py-8"
            action={emptyAction}
          />
        ) : body ? (
          body
        ) : (
          children
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
    <div style={{ height: 36 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--brand)"
            strokeWidth={1.5}
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
  const t = useT();
  const range = NORMAL_RANGES[type];
  const series = l as any;
  const points = Array.isArray(series.series) ? series.series : [];
  const valueStr =
    l.value != null
      ? `${l.value}${l.secondaryValue != null ? "/" + l.secondaryValue : ""}`
      : "—";
  const statusTone =
    l.classification === "normal" || !l.classification
      ? "neutral"
      : l.classification === "critical"
      ? "danger"
      : "warn";

  return (
    <div className="rounded-xl border border-border/70 bg-surface px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase font-semibold tracking-wide text-text-soft">
          {vitalLabel(type)}
        </div>
        {l.classification ? (
          <PillBadge tone={statusTone as any}>{l.classification}</PillBadge>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold text-text tabular-nums">
          {valueStr}
          <span className="text-xs text-text-soft font-normal ml-1">{l.unit ?? ""}</span>
        </div>
        <span className="text-[10px] text-text-muted">
          {t("vitals.empty") === "—" && range ? `${range[0]}–${range[1]}` : ""}
        </span>
      </div>
      {points.length > 1 ? <Sparkline points={points} /> : null}
      <div className="text-[10px] text-text-muted mt-0.5">
        {l.recordedAt ? format(parseISO(l.recordedAt), "MMM d, HH:mm") : ""}
      </div>
    </div>
  );
}

function RecordTypeChip({ type, count }: { type: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2">
      <div className="text-xs font-semibold text-text-soft">{vitalLabel(type)}</div>
      <PillBadge tone="brand">{count}</PillBadge>
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
          description={t("common.cancel") === "—" ? "Try again later" : "Try again later"}
        />
      </Card>
    );
  }

  const counts = data?.records.counts.byType ?? {};
  const recordTypeEntries = Object.entries(counts).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ─── 1. Active medicines ───────────────────────── */}
      <Section
        title={t("overview.section.activeMeds")}
        icon={<Pill size={14} className="text-brand" />}
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
      >
        <ul className="flex flex-col">
          {(data?.activeMedicines ?? []).slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <Pill size={14} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{m.name}</div>
                <div className="text-[11px] text-text-muted truncate">
                  {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                  {m.instructions ? ` · ${m.instructions}` : ""}
                </div>
              </div>
              {m.active ? (
                <PillBadge tone="success">{t("overview.medicineActive")}</PillBadge>
              ) : null}
              {m.endDate ? (
                <span className="text-[11px] text-text-muted shrink-0">
                  → {formatDate(m.endDate)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 2. Vitals ───────────────────────────────── */}
      <Section
        title={t("overview.section.vitals")}
        icon={<Activity size={14} className="text-brand" />}
        seeAllHref={`${base}/vitals`}
        isLoading={isLoading}
        isEmpty={sortedLatestWithSeries.length === 0}
        emptyTitle={t("vitals.empty")}
        body={
          sortedLatestWithSeries.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {sortedLatestWithSeries.slice(0, 8).map((l) => (
                <VitalTile key={l.type} l={l} type={l.type} />
              ))}
            </div>
          ) : null
        }
      />
      {data?.vitals.alerts && data.vitals.alerts.length > 0 ? (
        <Card padding={false}>
          <div className="px-4 md:px-5 pt-4 md:pt-5">
            <CardHeader title={t("alergies.banner") ?? "Alerts"} icon={<Activity size={14} />} />
          </div>
          <div className="px-4 md:px-5 pb-4 md:pb-5 grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.vitals.alerts.slice(0, 6).map((al, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft/40 px-2.5 py-1.5"
              >
                <PillBadge tone="danger">{al.classification}</PillBadge>
                <span className="text-xs text-text truncate">{al.label}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ─── 3. Recent prescriptions ──────────────────── */}
      <Section
        title={t("overview.section.prescriptions")}
        icon={<FileText size={14} className="text-brand" />}
        seeAllHref={`${base}/prescriptions`}
        rightSlot={
          data?.prescriptions.activeCount ? (
            <PillBadge tone="success">{data.prescriptions.activeCount} active</PillBadge>
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
      >
        <ul className="flex flex-col">
          {(data?.prescriptions.recent ?? []).map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <FileText size={14} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">
                  {r.title || r.diagnosis || t("prescription.untitled")}
                </div>
                {r.diagnosis ? (
                  <div className="text-[11px] text-text-muted truncate">{r.diagnosis}</div>
                ) : null}
              </div>
              <PillBadge tone={RX_TONE[r.status] ?? "neutral"}>
                {t(STATUS_LABEL_KEYS[r.status] ?? r.status)}
              </PillBadge>
              <span className="text-[11px] text-text-muted shrink-0">{formatDate(r.date)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 4. Recent lab orders + reports ───────────── */}
      <Section
        title={t("overview.section.labOrders")}
        icon={<FlaskConical size={14} className="text-brand" />}
        seeAllHref={`${base}/lab-orders`}
        isLoading={isLoading}
        isEmpty={(data?.labOrders.recent?.length ?? 0) === 0}
        emptyTitle={t("overview.empty.labOrders")}
        emptyAction={
          <Link href={`${base}/lab-orders`}>
            <Button size="sm" leftIcon={<Plus size={14} />}>
              {t("overview.action.addLabOrder")}
            </Button>
          </Link>
        }
      >
        <ul className="flex flex-col">
          {(data?.labOrders.recent ?? []).slice(0, 4).map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <FlaskConical size={14} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">
                  {o.tests.length ? o.tests.join(", ") : t("labs.untitled")}
                </div>
                <div className="text-[11px] text-text-muted">{o.notes || o.priority}</div>
              </div>
              <PillBadge tone={LAB_TONE[o.status] ?? "neutral"}>
                {t(STATUS_LABEL_KEYS[o.status] ?? o.status)}
              </PillBadge>
            </li>
          ))}
        </ul>
        {data?.labReports.recent?.length ? (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-2">
              {t("overview.section.labReports")}
            </div>
            <ul className="flex flex-col">
              {data.labReports.recent.slice(0, 3).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 py-1.5 text-xs"
                >
                  <span className="text-text-soft flex-1 truncate">{r.reportType || "—"}</span>
                  <PillBadge tone="neutral">{r.status}</PillBadge>
                  <span className="text-text-muted">{formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {/* ─── 5. Recent clinical notes ─────────────────── */}
      <Section
        title={t("overview.section.clinicalNotes")}
        icon={<Stethoscope size={14} className="text-brand" />}
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
      >
        <ul className="flex flex-col">
          {(data?.clinicalNotes.recent ?? []).map((n) => (
            <li
              key={n.id}
              className="flex flex-col gap-0.5 py-2 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <Stethoscope size={12} className="text-brand shrink-0" />
                <span className="text-sm font-medium text-text truncate flex-1">
                  {n.title || t("prescription.untitled")}
                </span>
                <span className="text-[11px] text-text-muted shrink-0">
                  {formatDate(n.createdAt)}
                </span>
              </div>
              {n.diagnosis ? (
                <div className="text-[11px] text-text-soft pl-5">
                  Dx: {n.diagnosis}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 6. Upcoming follow-ups ──────────────────── */}
      <Section
        title={t("overview.section.followUps")}
        icon={<CalendarClock size={14} className="text-brand" />}
        seeAllHref={`${base}/follow-ups`}
        rightSlot={
          data?.followUps.missed ? (
            <PillBadge tone="danger">{t("overview.dueOverdue")} · {data.followUps.missed}</PillBadge>
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
      >
        <ul className="flex flex-col">
          {(data?.followUps.upcoming ?? []).map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <CalendarCheck size={14} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{f.title}</div>
                {f.notes ? (
                  <div className="text-[11px] text-text-muted truncate">{f.notes}</div>
                ) : null}
              </div>
              <span className="text-[11px] text-text-muted shrink-0">
                {formatDate(f.followUpDate)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 7. Recent visits + next scheduled ───────── */}
      <Section
        title={t("overview.section.visits")}
        icon={<CalendarCheck size={14} className="text-brand" />}
        seeAllHref={`${base}/visits`}
        rightSlot={
          data?.visits.nextScheduled ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-brand">
              <CalendarClock size={12} />
              {t("overview.nextVisit")} {formatDate(data.visits.nextScheduled.date)}
            </div>
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
      >
        <ul className="flex flex-col">
          {(data?.visits.recent ?? []).slice(0, 5).map((v) => (
            <li
              key={`${v.kind}-${v.id}`}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <div className="h-7 w-7 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                <CalendarCheck size={12} className="text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate capitalize">
                  {v.kind === "walkin" ? "Walk-in" : "Appointment"}
                  {v.reason ? ` · ${v.reason}` : ""}
                </div>
                <div className="text-[11px] text-text-muted">{formatDate(v.date)}{v.time ? ` ${v.time}` : ""}</div>
              </div>
              <PillBadge tone={VISIT_TONE[v.status] ?? "neutral"}>
                {t(STATUS_LABEL_KEYS[v.status] ?? v.status)}
              </PillBadge>
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 8. Family history ───────────────────────── */}
      <Section
        title={t("overview.section.familyHistory")}
        icon={<Users size={14} className="text-brand" />}
        isLoading={isLoading}
        isEmpty={(data?.familyHistory?.length ?? 0) === 0}
        emptyTitle={t("overview.empty.familyHistory")}
      >
        <ul className="flex flex-col">
          {(data?.familyHistory ?? []).map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-1 py-2 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-text">{f.name}</span>
                <PillBadge tone="neutral">{f.relationship}</PillBadge>
                {f.isDeceased ? <PillBadge tone="warn">deceased</PillBadge> : null}
              </div>
              <div className="text-[11px] text-text-soft flex flex-wrap gap-1">
                {f.conditions.map((c, idx) => (
                  <PillBadge key={idx} tone="warn">
                    {c}
                  </PillBadge>
                ))}
                {f.isDeceased && f.causeOfDeath ? (
                  <span className="text-text-muted">{t("overview.familyConditions")}: {f.causeOfDeath}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 9. Vaccinations ────────────────────────── */}
      <Section
        title={t("overview.section.vaccinations")}
        icon={<Syringe size={14} className="text-brand" />}
        isLoading={isLoading}
        isEmpty={(data?.vaccinations?.length ?? 0) === 0}
        emptyTitle={t("overview.empty.vaccinations")}
      >
        <ul className="flex flex-col">
          {(data?.vaccinations ?? []).slice(0, 6).map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
            >
              <Syringe size={14} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{v.vaccine}</div>
                <div className="text-[11px] text-text-muted">
                  {v.shortName ? `${v.shortName} · ` : ""}
                  dose {v.doseNumber}
                </div>
              </div>
              {v.nextDueAt ? (
                <span className="text-[11px] text-text-muted shrink-0">
                  → {formatDate(v.nextDueAt)}
                </span>
              ) : v.administeredAt ? (
                <PillBadge tone="success">given</PillBadge>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {/* ─── 10. Insurance ─────────────────────────── */}
      <Section
        title={t("overview.section.insurance")}
        icon={<ShieldCheck size={14} className="text-brand" />}
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
      >
        {data?.insurance ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">
                {data.insurance.provider}
              </div>
              <div className="text-[11px] text-text-muted">
                #{data.insurance.policyNumber}
                {data.insurance.coverageType ? ` · ${data.insurance.coverageType}` : ""}
              </div>
            </div>
            {data.insurance.validUntil ? (
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide text-text-muted">
                  valid until
                </div>
                <div className="text-xs font-medium text-text">
                  {formatDate(data.insurance.validUntil)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      {/* ─── 11. Messages preview ───────────────────── */}
      <Section
        title={t("overview.section.messages")}
        icon={<MessageSquare size={14} className="text-brand" />}
        seeAllHref="/portal/messages"
        rightSlot={
          data?.messages.unreadCount ? (
            <PillBadge tone="danger">{data.messages.unreadCount} {t("overview.unread")}</PillBadge>
          ) : null
        }
        isLoading={isLoading}
        isEmpty={!data?.messages.lastConversation}
        emptyTitle={t("overview.noMessages")}
        body={
          data?.messages.lastConversation ? (
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs text-text-soft">
                <span className="font-semibold text-text truncate">
                  {data.messages.lastConversation.lastMessagePreview || "—"}
                </span>
                <span className="text-text-muted shrink-0">
                  {formatDate(data.messages.lastConversation.lastMessageAt)}
                </span>
              </div>
              <Link
                href="/portal/messages"
                className="text-[11px] font-semibold text-brand hover:underline mt-1"
              >
                {t("overview.action.openInbox")} →
              </Link>
            </div>
          ) : null
        }
      />

      {/* ─── 12. Records by type ────────────────────── */}
      <Section
        title={t("overview.section.recordsSummary")}
        icon={<ListChecks size={14} className="text-brand" />}
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
          recordTypeEntries.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recordTypeEntries.map(([type, count]) => (
                <RecordTypeChip key={type} type={type} count={count as number} />
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}
