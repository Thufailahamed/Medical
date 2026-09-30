"use client";

/**
 * Patient overview (doctor portal).
 *
 * The doctor's landing surface for a patient. Aggregates the
 * /doctor-portal/patients/:id/overview payload onto one screen so
 * the most safety-critical + most-asked-about info is visible
 * before scrolling:
 *   1. Toolbar: secondary actions (follow-up, book, inbox) + refresh/print
 *      (primary Rx / note / lab actions live in the chart hero)
 *   2. Vitals alerts (only if any)
 *   3. Safety panel: allergies + chronic conditions
 *   4. Stat strip (counts, each links to its tab)
 *   5. AI summary
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
  Check,
  HeartPulse,
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
import { AiSummaryCard } from "@/portal/components/ai/AiSummaryCard";

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
    <Card padding={false} className="overflow-hidden border-slate-200/80 shadow-xs hover:shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
              palette.bg
            )}
          >
            {icon}
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h3>
          {typeof count === "number" && count > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums bg-slate-100 text-slate-600">
              {count}
            </span>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {rightSlot}
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              className="inline-flex items-center gap-0.5 h-7 pl-2.5 pr-1.5 rounded-lg text-xs font-semibold text-sky-700 hover:bg-sky-50 transition-colors group"
            >
              {seeAllLabel ?? t("overview.seeAll")}
              <ChevronRight
                size={13}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="px-4 md:px-5 pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 opacity-70", palette.bg)}>
                {icon}
              </div>
              <span className="text-sm font-medium text-slate-500">{emptyTitle ?? "—"}</span>
            </div>
            {emptyAction ? <div className="shrink-0">{emptyAction}</div> : null}
          </div>
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

const STAT_TONES: Record<string, { icon: string; accent: string }> = {
  emerald: { icon: "bg-emerald-50 text-emerald-600", accent: "bg-emerald-500" },
  danger: { icon: "bg-rose-50 text-rose-600", accent: "bg-rose-500" },
  brand: { icon: "bg-sky-50 text-sky-600", accent: "bg-sky-500" },
  warn: { icon: "bg-amber-50 text-amber-600", accent: "bg-amber-500" },
  violet: { icon: "bg-violet-50 text-violet-600", accent: "bg-violet-500" },
  indigo: { icon: "bg-indigo-50 text-indigo-600", accent: "bg-indigo-500" },
  neutral: { icon: "bg-slate-100 text-slate-600", accent: "bg-slate-400" },
};

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: SectionTone;
  href?: string;
}) {
  const s = STAT_TONES[tone] ?? STAT_TONES.neutral;
  const inner = (
    <div className="group relative h-full flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 overflow-hidden">
      <span className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity", s.accent)} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", s.icon)}>
          {icon}
        </div>
        {href ? (
          <ChevronRight
            size={14}
            className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold tabular-nums leading-none text-slate-900 truncate">
          {value}
        </div>
        <div className="text-xs font-semibold text-slate-500 truncate mt-1.5">{label}</div>
        {sub ? <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── Safety panel: allergies + chronic conditions ───────────────────────

function isCriticalSeverity(severity: string | null | undefined) {
  const sev = (severity ?? "").toLowerCase();
  return sev === "severe" || sev === "life_threatening" || sev === "critical";
}

function SafetyBanner({
  allergies,
  chronic,
  allergiesHref,
}: {
  allergies: PatientOverview["allergies"];
  chronic: PatientOverview["chronicConditions"];
  allergiesHref: string;
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

  const hasSevere = sorted.some((a) => isCriticalSeverity(a.severity));
  const hasAllergies = sorted.length > 0;

  return (
    <section
      className={cn(
        "rounded-2xl border bg-white shadow-xs overflow-hidden",
        hasSevere ? "border-rose-300 ring-4 ring-rose-50" : "border-slate-200/80"
      )}
    >
      {hasSevere ? (
        <div className="flex items-center gap-2 px-4 md:px-5 py-2 bg-rose-600 text-white text-xs font-bold">
          <ShieldAlert size={14} />
          {t("overview.allergiesBanner.severeWarning")}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Allergies */}
        <div className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  hasAllergies ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                )}
              >
                {hasAllergies ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
              </div>
              <h3 className="text-[15px] font-bold text-slate-900">Allergies</h3>
              {hasAllergies ? (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums bg-rose-100 text-rose-700">
                  {sorted.length}
                </span>
              ) : null}
            </div>
            <Link
              href={allergiesHref}
              className="inline-flex items-center gap-0.5 h-7 pl-2.5 pr-1.5 rounded-lg text-xs font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
            >
              {t("overview.seeAll")}
              <ChevronRight size={13} />
            </Link>
          </div>

          {hasAllergies ? (
            <div className="flex flex-wrap gap-2">
              {sorted.map((a) => {
                const sev = (a.severity ?? "").toLowerCase();
                const isCritical = isCriticalSeverity(sev);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border pl-2 pr-2.5 py-1.5",
                      isCritical
                        ? "border-rose-200 bg-rose-50"
                        : "border-amber-200 bg-amber-50/70"
                    )}
                    title={a.notes ?? undefined}
                  >
                    <AlertOctagon
                      size={14}
                      className={cn("shrink-0", isCritical ? "text-rose-600" : "text-amber-600")}
                    />
                    <span className={cn("text-sm font-bold", isCritical ? "text-rose-800" : "text-amber-800")}>
                      {a.substance}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded-md",
                        isCritical ? "bg-rose-600 text-white" : "bg-amber-200/70 text-amber-800"
                      )}
                    >
                      {t(
                        `overview.severity.${
                          sev === "life_threatening" ? "critical" : sev || "mild"
                        }`
                      )}
                    </span>
                    {a.reaction ? (
                      <span className="text-xs text-slate-500 hidden md:inline">· {a.reaction}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50/70 border border-emerald-100 px-3.5 py-3">
              <span className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-px">
                <Check size={13} strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-emerald-900">No known allergies</div>
                <div className="text-xs text-emerald-700/80 mt-0.5">
                  No adverse drug, environmental, or food hypersensitivity reported.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chronic conditions */}
        <div className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <HeartPulse size={15} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900">Chronic conditions</h3>
            {chronic.length > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums bg-slate-100 text-slate-600">
                {chronic.length}
              </span>
            ) : null}
          </div>
          {chronic.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chronic.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {c.name}
                  {c.since ? (
                    <span className="text-slate-400 font-medium">
                      since {format(parseISO(c.since), "yyyy")}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm text-slate-500">
              None declared
            </div>
          )}
        </div>
      </div>
    </section>
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
  const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
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
  const labCount =
    (data?.labOrders.recent?.length ?? 0) + (data?.labReports.recent?.length ?? 0);
  const followUpCount = data?.followUps.upcoming?.length ?? 0;

  const handleRefresh = () =>
    qc.invalidateQueries({ queryKey: qk.patientOverview(id) });

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Toolbar: secondary actions + last-updated + refresh/print ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`${base}/follow-ups`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <CalendarClock size={14} className="text-sky-600" />
            {t("overview.action.addFollowUp")}
          </Link>
          <Link
            href="/portal/book-appointment"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <CalendarCheck size={14} className="text-emerald-600" />
            {t("overview.action.bookVisit")}
          </Link>
          <Link
            href="/portal/messages"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <MessageSquare size={14} className="text-violet-600" />
            {t("overview.section.messages")}
            {data?.messages.unreadCount ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-rose-500 text-white inline-flex items-center justify-center">
                {data.messages.unreadCount}
              </span>
            ) : null}
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {dataUpdatedAt ? (
            <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">
              {t("overview.lastUpdated", {
                time: relativeTime(new Date(dataUpdatedAt).toISOString()),
              })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isFetching}
            title={t("overview.action.refresh")}
            aria-label={t("overview.action.refresh")}
            className="h-9 w-9 rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            title={t("overview.action.print")}
            aria-label={t("overview.action.print")}
            className="h-9 w-9 rounded-xl hidden md:inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* ─── Vitals alerts — first thing a clinician should see ───── */}
      {data?.vitals.alerts && data.vitals.alerts.length > 0 ? (
        <div className="flex items-start gap-3.5 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/30">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-rose-900">
              {t("overview.section.alerts")}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {data.vitals.alerts.slice(0, 6).map((al, idx) => {
                const title = al.label || vitalLabel(al.type);
                const reading = al.value != null ? `${al.value} ${al.unit ?? ""}` : null;
                return (
                  <Link
                    key={idx}
                    href={`${base}/vitals`}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs shadow-xs hover:border-rose-300 transition-colors"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                    </span>
                    <span className="font-semibold text-slate-700 capitalize">{title}</span>
                    {reading ? <span className="font-bold text-rose-700 tabular-nums">{reading}</span> : null}
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                      {al.classification || "elevated"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Safety panel: allergies + chronic conditions ─────────── */}
      {data ? (
        <SafetyBanner
          allergies={data.allergies}
          chronic={data.chronicConditions}
          allergiesHref={`${base}/allergies`}
        />
      ) : (
        <Skeleton className="h-36 w-full rounded-2xl" />
      )}

      {/* ─── Stat strip — each tile jumps to its tab ─────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          icon={<Pill size={17} />}
          label={t("overview.section.activeMeds")}
          value={activeMedsCount}
          tone="emerald"
          href={`${base}/medications`}
        />
        <StatTile
          icon={<Activity size={17} />}
          label={t("overview.section.vitals")}
          value={vitalsCount}
          sub={data?.vitals.alerts?.length ? `${data.vitals.alerts.length} out of range` : undefined}
          tone={data?.vitals.alerts?.length ? "danger" : "brand"}
          href={`${base}/vitals`}
        />
        <StatTile
          icon={<FileText size={17} />}
          label={t("overview.section.prescriptions")}
          value={rxCount}
          sub={data?.prescriptions.activeCount ? `${data.prescriptions.activeCount} active` : undefined}
          tone="brand"
          href={`${base}/prescriptions`}
        />
        <StatTile
          icon={<FlaskConical size={17} />}
          label={t("overview.section.labOrders")}
          value={labCount}
          tone="violet"
          href={`${base}/lab-orders`}
        />
        <StatTile
          icon={<CalendarClock size={17} />}
          label={t("overview.section.followUps")}
          value={followUpCount}
          sub={data?.followUps.missed ? `${data.followUps.missed} ${t("overview.dueOverdue")}` : undefined}
          tone={data?.followUps.missed ? "warn" : "brand"}
          href={`${base}/follow-ups`}
        />
        <StatTile
          icon={<ListChecks size={17} />}
          label={t("overview.section.recordsSummary")}
          value={recordsTotal}
          tone="indigo"
          href={`${base}/records`}
        />
      </div>

      {/* ─── AI summary ────────────────────────────────────────────── */}
      <AiSummaryCard patientId={id} />

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
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {[
                            m.dosage,
                            m.frequency ? m.frequency.replace(/_/g, " ") : null,
                            m.instructions ? m.instructions.replace(/_/g, " ") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
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
