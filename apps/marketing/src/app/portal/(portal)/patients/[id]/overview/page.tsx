"use client";

/**
 * Patient overview (doctor portal).
 *
 * The doctor's landing surface for a patient. Aggregates the
 * /doctor-portal/patients/:id/overview payload onto one screen so
 * the most safety-critical + most-asked-about info is visible
 * before scrolling:
 *   1. Allergies + chronic conditions (prominent safety banner)
 *   2. Quick actions (compose, order, schedule)
 *   3. Last-updated + print + refresh header
 *   4. Hero stat strip (counts)
 *   5. Vitals alerts (only if any)
 *   6. 2-col body: main column (activeMeds → vitals → rx → labs →
 *      notes → visits) + sidebar (followUps → familyHistory →
 *      vaccinations → insurance → messages → records-by-type)
 *
 * Reuses `Card`, `Button`, `Pill`, `Empty`, `Skeleton` from the
 * portal UI kit. Local helpers `Section`, `StatTile`, `VitalTile`,
 * `Sparkline`, `RecordTypeChip`, `ClickableRow`, `SafetyBanner`
 * are defined in-file because no equivalents exist in /ui yet —
 * future extraction to /components/chart is planned.
 */

import { use, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Printer,
  RefreshCw,
  AlertOctagon,
  ShieldAlert,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { useT } from "@/portal/i18n";
import { formatDate, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { allergySeverityRank } from "@/portal/lib/clinicalTones";
import type { PatientOverview } from "@healthcare/shared";

// ─── Vital reference ranges (mirrors /vitals tab) ─────────────────────

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

// ─── Tone maps: status → Pill tone ──────────────────────────────────────

const RX_TONE: Record<
  string,
  "neutral" | "brand" | "success" | "warn" | "danger"
> = {
  signed: "success",
  draft: "neutral",
  cancelled: "danger",
  dispensed: "brand",
};

const LAB_TONE: Record<
  string,
  "neutral" | "brand" | "success" | "warn" | "danger"
> = {
  ordered: "warn",
  accepted: "brand",
  sample_collected: "brand",
  collected: "brand",
  processing: "brand",
  in_progress: "brand",
  completed: "success",
  cancelled: "danger",
};

const VISIT_TONE: Record<
  string,
  "neutral" | "brand" | "success" | "warn" | "danger"
> = {
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

// ─── Section icon palette (one tone per category for visual scanning) ──

type SectionTone =
  | "neutral"
  | "brand"
  | "emerald"
  | "rose"
  | "violet"
  | "amber"
  | "teal"
  | "cyan"
  | "indigo"
  | "danger"
  | "warn"
  | "success";

const SECTION_TONE_CLASSES: Record<
  SectionTone,
  { bg: string; text: string; gradient: string }
> = {
  neutral: {
    bg: "bg-surface-2 text-text-soft border border-border/60",
    text: "text-text-soft",
    gradient: "from-surface-2/30 to-transparent",
  },
  brand: {
    bg: "bg-brand-soft text-brand",
    text: "text-brand",
    gradient: "from-brand-soft/15 to-transparent",
  },
  emerald: {
    bg: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    gradient: "from-emerald-50/50 to-transparent",
  },
  rose: {
    bg: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
    gradient: "from-rose-50/50 to-transparent",
  },
  violet: {
    bg: "bg-violet-50 text-violet-700",
    text: "text-violet-700",
    gradient: "from-violet-50/50 to-transparent",
  },
  amber: {
    bg: "bg-amber-50 text-amber-700",
    text: "text-amber-700",
    gradient: "from-amber-50/50 to-transparent",
  },
  teal: {
    bg: "bg-teal-50 text-teal-700",
    text: "text-teal-700",
    gradient: "from-teal-50/50 to-transparent",
  },
  cyan: {
    bg: "bg-cyan-50 text-cyan-700",
    text: "text-cyan-700",
    gradient: "from-cyan-50/50 to-transparent",
  },
  indigo: {
    bg: "bg-indigo-50 text-indigo-700",
    text: "text-indigo-700",
    gradient: "from-indigo-50/50 to-transparent",
  },
  danger: {
    bg: "bg-danger-soft text-danger",
    text: "text-danger",
    gradient: "from-danger-soft/60 to-transparent",
  },
  warn: {
    bg: "bg-warn-soft text-amber-700",
    text: "text-amber-700",
    gradient: "from-warn-soft/50 to-transparent",
  },
  success: {
    bg: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    gradient: "from-emerald-50/40 to-transparent",
  },
};

// ─── Section shell ──────────────────────────────────────────────────────

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
  tone?: SectionTone;
  count?: number;
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
  tone = "brand",
  count,
}: SectionProps) {
  const t = useT();
  const palette = SECTION_TONE_CLASSES[tone];
  return (
    <Card padding={false} className="overflow-hidden">
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-border/60 bg-gradient-to-r",
          palette.gradient
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              palette.bg
            )}
          >
            {icon}
          </div>
          <div className="text-sm font-bold text-text tracking-tight truncate">
            {title}
          </div>
          {typeof count === "number" && count > 0 ? (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums",
                palette.bg
              )}
            >
              {count}
            </span>
          ) : null}
        </div>
        <div className="shrink-0">
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-strong transition-colors group"
            >
              {seeAllLabel ?? t("overview.seeAll")}
              <ChevronRight
                size={12}
                className="transition-transform group-hover:translate-x-0.5"
              />
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

// ─── Clickable row (linkified list item with hover state) ──────────────

type ClickableRowProps = {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

function ClickableRow({
  href,
  onClick,
  children,
  className,
}: ClickableRowProps) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-all",
        (href || onClick) &&
          "hover:bg-brand-soft/40 hover:translate-x-0.5 cursor-pointer group/row",
        className
      )}
    >
      {children}
      {(href || onClick) ? (
        <ChevronRight
          size={12}
          className="text-text-muted opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
        />
      ) : null}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className="w-full text-left">{inner}</button>;
  return inner;
}

// ─── Sparkline with optional reference band ─────────────────────────────

function Sparkline({
  points,
  range,
  value,
  tone = "neutral",
}: {
  points: Array<{ value: number; recordedAt: string }>;
  range?: [number, number];
  value?: number;
  tone?: "neutral" | "warn" | "danger";
}) {
  if (!points || points.length === 0) return null;
  const data = points
    .slice()
    .sort((a, b) => +parseISO(a.recordedAt) - +parseISO(b.recordedAt))
    .map((p) => ({ v: p.value }));

  const strokeColor =
    tone === "danger"
      ? "#DC2626"
      : tone === "warn"
      ? "#D97706"
      : "currentColor";

  const yMin = Math.min(...data.map((d) => d.v), range?.[0] ?? Infinity);
  const yMax = Math.max(...data.map((d) => d.v), range?.[1] ?? -Infinity);
  const pad = (yMax - yMin) * 0.1 || 1;

  return (
    <div style={{ height: 40, color: strokeColor }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <YAxis hide domain={[yMin - pad, yMax + pad]} />
          {range ? (
            <ReferenceArea
              y1={range[0]}
              y2={range[1]}
              fill={strokeColor}
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
          ) : null}
          {range && value != null ? (
            <ReferenceLine
              y={value}
              stroke={strokeColor}
              strokeDasharray="2 2"
              strokeOpacity={0.4}
            />
          ) : null}
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

// ─── Vital tile ─────────────────────────────────────────────────────────

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
        "relative rounded-xl border bg-surface px-3 py-2.5 flex flex-col gap-1 overflow-hidden transition-all hover:shadow-md",
        tone === "danger"
          ? "border-danger/40 bg-danger-soft/30 ring-1 ring-danger/10"
          : tone === "warn"
          ? "border-warn/40 bg-warn-soft/30 ring-1 ring-warn/10"
          : "border-border/70 hover:border-brand/40"
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
              tone === "danger" && "bg-danger",
              tone === "warn" && "bg-warn",
              tone === "neutral" && "bg-emerald-500"
            )}
          />
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className={cn(
            "text-xl font-bold tabular-nums tracking-tight leading-none",
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
      <div
        className={cn(
          tone === "danger"
            ? "text-danger"
            : tone === "warn"
            ? "text-amber-700"
            : "text-emerald-600"
        )}
      >
        <Sparkline
          points={points}
          range={range}
          value={l.value ?? undefined}
          tone={tone === "neutral" ? "neutral" : tone}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        {l.recordedAt ? (
          <span className="inline-flex items-center gap-1">
            <Clock size={9} />
            {format(parseISO(l.recordedAt), "MMM d, HH:mm")}
          </span>
        ) : null}
        {range ? (
          <span className="tabular-nums text-text-soft">
            {range[0]}–{range[1]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Record-type chip ───────────────────────────────────────────────────

function RecordTypeChip({
  type,
  count,
}: {
  type: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2 hover:border-brand/40 hover:bg-brand-soft/20 transition-all cursor-pointer">
      <div className="flex items-center gap-2 min-w-0">
        <CircleDot size={11} className="text-brand shrink-0" />
        <div className="text-xs font-medium text-text truncate">
          {vitalLabel(type)}
        </div>
      </div>
      <PillBadge tone="brand">{count}</PillBadge>
    </div>
  );
}

// ─── Stat tile ──────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: SectionTone;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all hover:shadow-sm",
        tone === "danger"
          ? "border-danger/30 bg-danger-soft/30"
          : tone === "warn"
          ? "border-warn/30 bg-warn-soft/30"
          : tone === "brand"
          ? "border-brand/30 bg-brand-soft/40"
          : tone === "success" || tone === "emerald"
          ? "border-emerald-200 bg-emerald-50/50"
          : tone === "rose"
          ? "border-rose-200 bg-rose-50/40"
          : tone === "violet"
          ? "border-violet-200 bg-violet-50/40"
          : tone === "amber"
          ? "border-amber-200 bg-amber-50/40"
          : tone === "teal"
          ? "border-teal-200 bg-teal-50/40"
          : tone === "cyan"
          ? "border-cyan-200 bg-cyan-50/40"
          : tone === "indigo"
          ? "border-indigo-200 bg-indigo-50/40"
          : "border-border/60 bg-surface-2/30 hover:border-border"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          tone === "danger" && "bg-danger text-white",
          tone === "warn" && "bg-warn text-white",
          tone === "brand" && "bg-brand text-white",
          (tone === "success" || tone === "emerald") && "bg-emerald-600 text-white",
          tone === "rose" && "bg-rose-600 text-white",
          tone === "violet" && "bg-violet-600 text-white",
          tone === "amber" && "bg-amber-600 text-white",
          tone === "teal" && "bg-teal-600 text-white",
          tone === "cyan" && "bg-cyan-600 text-white",
          tone === "indigo" && "bg-indigo-600 text-white",
          tone === "neutral" && "bg-surface border border-border/60 text-text-soft"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <div
            className={cn(
              "text-lg font-bold tabular-nums leading-tight",
              tone === "danger"
                ? "text-danger"
                : tone === "warn"
                ? "text-amber-700"
                : tone === "success" || tone === "emerald"
                ? "text-emerald-700"
                : tone === "rose"
                ? "text-rose-700"
                : tone === "violet"
                ? "text-violet-700"
                : "text-text"
            )}
          >
            {value}
          </div>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center text-[9px] font-semibold",
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-rose-600",
                trend === "flat" && "text-text-muted"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </span>
          ) : null}
        </div>
        <div className="text-[10px] uppercase tracking-wide font-semibold text-text-soft truncate">
          {label}
        </div>
        {sub ? (
          <div className="text-[10px] text-text-muted mt-0.5 truncate">
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Safety banner: allergies + chronic conditions ──────────────────────

function SafetyBanner({
  allergies,
  chronic,
}: {
  allergies: PatientOverview["allergies"];
  chronic: PatientOverview["chronicConditions"];
}) {
  const t = useT();

  const sorted = useMemo(
    () =>
      [...allergies].sort(
        (a, b) =>
          allergySeverityRank(a.severity) - allergySeverityRank(b.severity)
      ),
    [allergies]
  );

  const hasSevere = sorted.some(
    (a) =>
      (a.severity ?? "").toLowerCase() === "severe" ||
      (a.severity ?? "").toLowerCase() === "life_threatening" ||
      (a.severity ?? "").toLowerCase() === "critical"
  );

  return (
    <Card
      padding={false}
      className={cn(
        "overflow-hidden",
        hasSevere
          ? "border-danger/50 ring-1 ring-danger/20"
          : "border-border/60"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 md:px-5 py-3 border-b border-border/60 bg-gradient-to-r",
          hasSevere
            ? "from-danger-soft/70 to-transparent"
            : "from-brand-soft/30 to-transparent"
        )}
      >
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            hasSevere ? "bg-danger text-white" : "bg-brand text-white"
          )}
        >
          {hasSevere ? <ShieldAlert size={16} /> : <Heart size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text">
            {t("overview.allergiesBanner.title")}
          </div>
          {hasSevere ? (
            <div className="text-[11px] text-danger font-semibold mt-0.5">
              {t("overview.allergiesBanner.severeWarning")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 md:px-5 py-4">
        {sorted.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-semibold">
              {t("overview.allergiesBanner.none")}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sorted.map((a) => {
              const sev = (a.severity ?? "").toLowerCase();
              const isCritical =
                sev === "severe" ||
                sev === "life_threatening" ||
                sev === "critical";
              return (
                <div
                  key={a.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all",
                    isCritical
                      ? "border-danger/40 bg-danger-soft/60 hover:bg-danger-soft"
                      : "border-warn/30 bg-warn-soft/30 hover:bg-warn-soft/60"
                  )}
                  title={a.notes ?? undefined}
                >
                  <AlertOctagon
                    size={12}
                    className={cn(
                      "shrink-0",
                      isCritical ? "text-danger" : "text-warn"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-bold",
                      isCritical ? "text-danger" : "text-amber-700"
                    )}
                  >
                    {a.substance}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded",
                      isCritical
                        ? "bg-danger/15 text-danger"
                        : "bg-warn/20 text-amber-700"
                    )}
                  >
                    {t(
                      `overview.severity.${
                        sev === "life_threatening"
                          ? "critical"
                          : sev || "mild"
                      }`
                    )}
                  </span>
                  {a.reaction ? (
                    <span className="text-[10px] text-text-soft hidden md:inline">
                      · {a.reaction}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {chronic.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2">
              Chronic conditions ({chronic.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chronic.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text"
                >
                  <CircleDot size={9} className="text-text-muted" />
                  {c.name}
                  {c.since ? (
                    <span className="text-text-muted font-normal">
                      · {format(parseISO(c.since), "yyyy")}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Main: PatientOverviewTab ───────────────────────────────────────────

export default function PatientOverviewTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();

  const base = `/portal/patients/${id}`;
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: qk.patientOverview(id),
    queryFn: () => api<PatientOverview>(`/doctor-portal/patients/${id}/overview`),
    enabled: !!id,
    retry: 1,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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
          action={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={13} />}
              onClick={() =>
                qc.invalidateQueries({ queryKey: qk.patientOverview(id) })
              }
            >
              {t("overview.action.refresh")}
            </Button>
          }
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

  const allergyCount = data?.allergies?.length ?? 0;

  const handleRefresh = () =>
    qc.invalidateQueries({ queryKey: qk.patientOverview(id) });

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Toolbar: last-updated + refresh + print ─────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-text-muted">
          {dataUpdatedAt
            ? t("overview.lastUpdated", {
                time: relativeTime(new Date(dataUpdatedAt).toISOString()),
              })
            : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={12} />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {t("overview.action.refresh")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Printer size={12} />}
            onClick={handlePrint}
            className="hidden md:inline-flex"
          >
            {t("overview.action.print")}
          </Button>
        </div>
      </div>

      {/* ─── Quick actions bar ─────────────────────────── */}
      <Card padding={false}>
        <div className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted mr-1 hidden md:block">
            {t("overview.quickActions")}
          </div>
          <Link href={`${base}/prescriptions`} className="flex-1 min-w-[140px]">
            <Button
              variant="primary"
              size="md"
              block
              leftIcon={<Pill size={14} />}
            >
              {t("overview.action.addPrescription")}
            </Button>
          </Link>
          <Link href={`${base}/clinical-notes`} className="flex-1 min-w-[140px]">
            <Button
              variant="secondary"
              size="md"
              block
              leftIcon={<Stethoscope size={14} />}
            >
              {t("overview.action.addNote")}
            </Button>
          </Link>
          <Link href={`${base}/lab-orders`} className="flex-1 min-w-[140px]">
            <Button
              variant="secondary"
              size="md"
              block
              leftIcon={<FlaskConical size={14} />}
            >
              {t("overview.action.addLabOrder")}
            </Button>
          </Link>
          <Link href={`${base}/follow-ups`} className="flex-1 min-w-[140px]">
            <Button
              variant="secondary"
              size="md"
              block
              leftIcon={<CalendarClock size={14} />}
            >
              {t("overview.action.addFollowUp")}
            </Button>
          </Link>
          <Link href="/portal/book-appointment" className="flex-1 min-w-[140px]">
            <Button
              variant="secondary"
              size="md"
              block
              leftIcon={<CalendarCheck size={14} />}
            >
              {t("overview.action.bookVisit")}
            </Button>
          </Link>
        </div>
      </Card>

      {/* ─── Safety banner: allergies + chronic conditions ─────────── */}
      {data ? (
        <SafetyBanner
          allergies={data.allergies}
          chronic={data.chronicConditions}
        />
      ) : (
        <Card>
          <Skeleton className="h-20 w-full" />
        </Card>
      )}

      {/* ─── Hero stat strip ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatTile
          icon={<Pill size={14} />}
          label={t("overview.section.activeMeds")}
          value={activeMedsCount}
          tone="emerald"
        />
        <StatTile
          icon={<Activity size={14} />}
          label={t("overview.section.vitals")}
          value={vitalsCount}
          tone={data?.vitals.alerts?.length ? "danger" : "neutral"}
        />
        <StatTile
          icon={<FileText size={14} />}
          label={t("overview.section.prescriptions")}
          value={rxCount}
          tone="brand"
        />
        <StatTile
          icon={<AlertOctagon size={14} />}
          label="Allergies"
          value={allergyCount}
          tone={allergyCount > 0 ? "warn" : "success"}
          sub={allergyCount === 0 ? t("overview.allergiesBanner.none") : undefined}
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

      {/* ─── Vitals alerts banner ─────────────────────────── */}
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
            count={activeMedsCount}
            tone="emerald"
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
                  <li key={m.id} className="border-b border-border/40 last:border-0">
                    <ClickableRow href={`${base}/medications`}>
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Pill size={13} />
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
                        <PillBadge tone="success">
                          {t("overview.medicineActive")}
                        </PillBadge>
                      ) : null}
                      {m.endDate ? (
                        <span className="text-[11px] text-text-muted shrink-0 hidden md:inline">
                          → {formatDate(m.endDate)}
                        </span>
                      ) : null}
                    </ClickableRow>
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
            count={vitalsCount}
            tone="rose"
            isLoading={isLoading}
            isEmpty={sortedLatestWithSeries.length === 0}
            emptyTitle={t("overview.empty.vitals")}
            body={
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {sortedLatestWithSeries.slice(0, 9).map((l) => (
                  <Link
                    key={l.type}
                    href={`${base}/vitals`}
                    className="block hover:-translate-y-0.5 transition-transform"
                  >
                    <VitalTile l={l} type={l.type} />
                  </Link>
                ))}
              </div>
            }
          />

          {/* Prescriptions */}
          <Section
            title={t("overview.section.prescriptions")}
            icon={<FileText size={15} />}
            seeAllHref={`${base}/prescriptions`}
            count={rxCount}
            tone="brand"
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
                  <li key={r.id} className="border-b border-border/40 last:border-0">
                    <ClickableRow href={`${base}/prescriptions/${r.id}`}>
                      <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                        <FileText size={13} />
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
                    </ClickableRow>
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
            count={(data?.labOrders.recent?.length ?? 0) + (data?.labReports.recent?.length ?? 0)}
            tone="violet"
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
                      <li key={o.id} className="border-b border-border/40 last:border-0">
                        <ClickableRow href={`${base}/lab-orders`}>
                          <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                            <FlaskConical size={13} />
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
                        </ClickableRow>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {data?.labReports.recent?.length ? (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-2">
                      {t("overview.section.labReports")}
                    </div>
                    <ul className="flex flex-col gap-1">
                      {data.labReports.recent.slice(0, 3).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-2 py-1.5 text-xs"
                        >
                          <span className="text-text-soft flex-1 truncate">
                            {r.reportType || "—"}
                          </span>
                          <PillBadge tone="neutral">{r.status}</PillBadge>
                          <span className="text-text-muted">
                            {formatDate(r.createdAt)}
                          </span>
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
            count={data?.clinicalNotes.recent?.length ?? 0}
            tone="brand"
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
                    className="border-b border-border/40 last:border-0"
                  >
                    <ClickableRow
                      href={`${base}/clinical-notes`}
                      className="items-start"
                    >
                      <div className="h-7 w-7 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0 mt-0.5">
                        <Stethoscope size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text truncate">
                          {n.title || t("prescription.untitled")}
                        </div>
                        {n.diagnosis ? (
                          <div className="text-[11px] text-text-soft truncate">
                            Dx: {n.diagnosis}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {relativeTime(n.createdAt)}
                      </span>
                    </ClickableRow>
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
            count={data?.visits.recent?.length ?? 0}
            tone="amber"
            rightSlot={
              data?.visits.nextScheduled ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <TrendingUp size={11} />
                  {t("overview.nextVisit")} ·{" "}
                  {relativeTime(data.visits.nextScheduled.date)}
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
                    className="border-b border-border/40 last:border-0"
                  >
                    <ClickableRow href={`${base}/visits`}>
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          v.kind === "walkin"
                            ? "bg-amber-50 text-amber-700"
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
                    </ClickableRow>
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
            count={data?.followUps.upcoming?.length ?? 0}
            tone="brand"
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
                    className="border-b border-border/40 last:border-0"
                  >
                    <ClickableRow href={`${base}/follow-ups`}>
                      <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                        <CalendarClock size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">
                          {f.title}
                        </div>
                        {f.notes ? (
                          <div className="text-[11px] text-text-muted truncate">
                            {f.notes}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {relativeTime(f.followUpDate)}
                      </span>
                    </ClickableRow>
                  </li>
                ))}
              </ul>
            }
          />

          {/* Family history */}
          <Section
            title={t("overview.section.familyHistory")}
            icon={<Users size={15} />}
            count={data?.familyHistory?.length ?? 0}
            tone="teal"
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
                      {f.isDeceased ? (
                        <PillBadge tone="warn">deceased</PillBadge>
                      ) : null}
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
            count={data?.vaccinations?.length ?? 0}
            tone="cyan"
            isLoading={isLoading}
            isEmpty={(data?.vaccinations?.length ?? 0) === 0}
            emptyTitle={t("overview.empty.vaccinations")}
            body={
              <ul className="flex flex-col">
                {(data?.vaccinations ?? []).slice(0, 6).map((v) => (
                  <li
                    key={v.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-cyan-50/30 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                        <Syringe size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">
                          {v.vaccine}
                        </div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wide">
                          {v.shortName ? `${v.shortName} · ` : ""}dose{" "}
                          {v.doseNumber}
                        </div>
                      </div>
                      {v.nextDueAt ? (
                        <span className="text-[11px] text-cyan-700 font-semibold shrink-0">
                          → {relativeTime(v.nextDueAt)}
                        </span>
                      ) : v.administeredAt ? (
                        <PillBadge tone="success">given</PillBadge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            }
          />

          {/* Insurance */}
          <Section
            title={t("overview.section.insurance")}
            icon={<ShieldCheck size={15} />}
            tone="emerald"
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
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-surface-2/40 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-text truncate">
                        {data.insurance.provider}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        #{data.insurance.policyNumber}
                        {data.insurance.coverageType
                          ? ` · ${data.insurance.coverageType}`
                          : ""}
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
            tone="rose"
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
                <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/40 to-surface-2/40 p-3">
                  <div className="flex items-center gap-2 text-xs text-text-soft">
                    <div className="h-7 w-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
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
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-rose-700 transition-colors"
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
            count={data?.records.counts.total ?? 0}
            tone="indigo"
            isLoading={isLoading}
            isEmpty={recordTypeEntries.length === 0}
            emptyTitle={t("overview.empty.recordsSummary")}
            body={
              <div className="flex flex-col gap-1.5">
                {recordTypeEntries.map(([type, count]) => (
                  <RecordTypeChip
                    key={type}
                    type={type}
                    count={count as number}
                  />
                ))}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

// (end of file)
