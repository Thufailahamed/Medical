"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Wallet, Calendar as CalendarIcon, DollarSign,
  ArrowUpRight, ArrowDownRight, Banknote, HandCoins, CalendarRange,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton, Empty } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface EarningsSummary {
  period: string; start: string; end: string;
  totalLkr: number; visitCount: number; avgPerVisitLkr: number;
  trendPct: number; pendingPayoutLkr: number; consultationFee: number;
}

interface TimeseriesResp {
  bucket: string; from: string; to: string;
  series: Array<{ bucket: string; total: number; count: number }>;
}
interface Payout {
  id: string; amountLkr: number; status: "pending" | "paid" | "failed";
  periodStart: string; periodEnd: string; eventCount: number;
  reference: string | null; paidAt: string | null; createdAt: string;
}
interface PayoutsResp { payouts: Payout[] }

const PERIODS = ["week", "month", "quarter", "year"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90, year: 365 };
type Granularity = "day" | "week" | "month";
const GRANULARITY: Record<Period, Granularity> = { week: "day", month: "day", quarter: "week", year: "month" };

const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(period: Period) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - PERIOD_DAYS[period]);
  return { from: fmtDay(start), to: fmtDay(end) };
}

/** Monday of the week containing `d` (YYYY-MM-DD). Local-time safe. */
function weekKey(day: string) {
  const d = parseISO(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return format(d, "yyyy-MM-dd");
}

/** "2026-07-16" → "Jul 16, 2026" (date-only stays a calendar day, no TZ shift). */
const fmtDayLabel = (iso: string) => format(parseISO(iso), "MMM d, yyyy");

/** SQLite timestamps arrive as "YYYY-MM-DD HH:MM:SS" (UTC); paidAt is ISO. */
function parseTs(s: string): Date {
  return new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
}

interface ChartPoint { key: string; amount: number; count: number }

/** The API returns daily buckets only — aggregate client-side for long ranges. */
function bucketize(series: TimeseriesResp["series"], gran: Granularity): ChartPoint[] {
  const map = new Map<string, ChartPoint>();
  for (const r of series) {
    const key = gran === "month" ? r.bucket.slice(0, 7) : gran === "week" ? weekKey(r.bucket) : r.bucket;
    const cur = map.get(key);
    if (cur) { cur.amount += r.total; cur.count += r.count; }
    else map.set(key, { key, amount: r.total, count: r.count });
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function bucketLabel(key: string, gran: Granularity) {
  if (gran === "month") return format(parseISO(`${key}-01`), "MMM yyyy");
  return format(parseISO(key), "MMM d");
}

const PAYOUT_TONE: Record<string, "success" | "warn" | "danger"> = {
  paid: "success", pending: "warn", failed: "danger",
};
const PAYOUT_CHIP: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-600 ring-emerald-600/15",
  pending: "bg-amber-50 text-amber-600 ring-amber-600/15",
  failed: "bg-red-50 text-red-600 ring-red-600/15",
};

export default function EarningsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");

  const { data: sum, isLoading: sumLoading } = useQuery({
    queryKey: ["doctor-earnings", "summary", period],
    queryFn: () => api<EarningsSummary>(`/doctor-earnings/summary?period=${period}`),
  });

  const { data: ts, isLoading: tsLoading } = useQuery({
    queryKey: ["doctor-earnings", "timeseries", period],
    queryFn: () => {
      const { from, to } = rangeFor(period);
      return api<TimeseriesResp>(`/doctor-earnings/timeseries?from=${from}&to=${to}&bucket=day`);
    },
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["doctor-earnings", "payouts"],
    queryFn: () => api<PayoutsResp>(`/doctor-earnings/payouts`),
  });

  const requestPayout = useMutation({
    mutationFn: async () => {
      if (!sum) throw new Error("Summary not loaded");
      return api("/doctor-earnings/payouts", {
        method: "POST",
        json: { periodStart: sum.start, periodEnd: sum.end },
      });
    },
    onSuccess: () => {
      toast.success(t("earnings.payoutRequested"));
      qc.invalidateQueries({ queryKey: ["doctor-earnings"] });
    },
    onError: (err: unknown) => {
      toast.error(t("toast.error"), err instanceof Error ? err.message : undefined);
    },
  });

  const gran = GRANULARITY[period];
  const points = useMemo(() => bucketize(ts?.series ?? [], gran), [ts, gran]);
  const payoutLabel = (status: string) => {
    const key = `earnings.payoutStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("earnings.title")}
        subtitle={t("earnings.subtitle")}
        icon={<DollarSign size={18} className="text-emerald-600" />}
        actions={
          <FilterPills
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({
              value: p,
              label: t(`earnings.period.${p}`),
            }))}
          />
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          loading={sumLoading}
          icon={<TrendingUp size={18} />}
          label={t("earnings.totalThisPeriod")}
          value={sum ? formatLkr(sum.totalLkr) : "—"}
          sub={sum ? t("earnings.visitsSummary", { count: sum.visitCount, avg: formatLkr(sum.avgPerVisitLkr) }) : ""}
          gradient="from-sky-500 to-blue-600"
          lightBg="bg-sky-50/80"
          accentColor="text-sky-600"
          trend={sum && sum.visitCount > 0 ? sum.trendPct : undefined}
        />
        <MetricCard
          loading={sumLoading}
          icon={<Wallet size={18} />}
          label={t("earnings.pendingPayout")}
          value={sum ? formatLkr(sum.pendingPayoutLkr) : "—"}
          sub={sum?.pendingPayoutLkr ? t("earnings.wiredWithinDays") : t("earnings.allSettled")}
          gradient="from-violet-500 to-purple-600"
          lightBg="bg-violet-50/80"
          accentColor="text-violet-600"
        />
        <MetricCard
          loading={sumLoading}
          icon={<CalendarIcon size={18} />}
          label={t("earnings.consultationFee")}
          value={sum ? formatLkr(sum.consultationFee) : "—"}
          sub={t("earnings.perVisit")}
          gradient="from-emerald-500 to-teal-600"
          lightBg="bg-emerald-50/80"
          accentColor="text-emerald-600"
        />
      </div>

      {/* Chart */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-5 pt-4 pb-1 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-bold text-text">{t("earnings.chartTitle")}</div>
            {sum && (
              <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
                <CalendarRange size={11} />
                {fmtDayLabel(sum.start)} – {fmtDayLabel(sum.end)}
              </div>
            )}
          </div>
          {sum && sum.visitCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-text tabular-nums">{formatLkr(sum.totalLkr)}</span>
            </div>
          )}
        </div>
        {tsLoading ? (
          <div className="px-5 pb-5 pt-3 flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[210px] w-full rounded-2xl" />
          </div>
        ) : points.length === 0 ? (
          <Empty title={t("earnings.noData")} icon={<TrendingUp size={20} className="text-text-muted" />} className="py-10" />
        ) : (
          <div style={{ height: 260 }} className="px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 12, right: 14, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="key"
                  tickFormatter={(k: string) => bucketLabel(k, gran)}
                  stroke="var(--text-muted)" fontSize={11}
                  tickLine={false} axisLine={false} minTickGap={24}
                />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip gran={gran} />} cursor={{ stroke: "var(--border)", strokeWidth: 1.5 }} />
                <Area type="monotone" dataKey="amount" stroke="var(--brand)" strokeWidth={2.5} fill="url(#earnGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Payouts */}
      <Card padding={false} className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-bold text-text">{t("earnings.payoutsTitle")}</div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<HandCoins size={14} />}
            loading={requestPayout.isPending}
            disabled={!sum || sum.visitCount === 0}
            title={sum && sum.visitCount === 0 ? t("earnings.noData") : undefined}
            onClick={() => requestPayout.mutate()}
          >
            {t("earnings.requestPayout")}
          </Button>
        </div>
        {payoutsLoading ? (
          <div className="p-4 sm:p-5 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : payouts?.payouts?.length ? (
          <ul className="flex flex-col divide-y divide-border/50">
            {payouts.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-surface-2/40 transition-colors">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset shadow-2xs", PAYOUT_CHIP[p.status] ?? PAYOUT_CHIP.pending)}>
                  <Banknote size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold tabular-nums text-sm text-text">{formatLkr(p.amountLkr)}</span>
                    <Pill tone={PAYOUT_TONE[p.status] ?? "warn"}>{payoutLabel(p.status)}</Pill>
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5 truncate">
                    {fmtDayLabel(p.periodStart)} – {fmtDayLabel(p.periodEnd)}
                    {" · "}
                    {t("earnings.eventCount", { count: p.eventCount })}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-text-muted tabular-nums">{format(parseTs(p.createdAt), "MMM d, yyyy")}</div>
                  {p.status === "paid" && p.paidAt && (
                    <div className="text-[11px] font-semibold text-emerald-600 tabular-nums mt-0.5">
                      {t("earnings.paidOn", { date: format(parseTs(p.paidAt), "MMM d, yyyy") })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={t("earnings.noPayouts")} icon={<Wallet size={20} className="text-text-muted" />} className="py-10" />
        )}
      </Card>
    </div>
  );
}

function ChartTooltip({ active, payload, label, gran }: {
  active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string; gran: Granularity;
}) {
  const t = useT();
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-text">{bucketLabel(label, gran)}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-text-muted">{t("earnings.revenue")}</span>
        <span className="font-extrabold text-text tabular-nums ml-auto pl-3">{formatLkr(p.amount)}</span>
      </div>
      <div className="mt-0.5 text-text-muted pl-3.5">{t("earnings.eventCount", { count: p.count })}</div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, gradient, lightBg, accentColor, trend, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; lightBg: string; accentColor: string; trend?: number; loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden group">
      <div className={cn("absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition-opacity", `bg-gradient-to-br ${gradient}`)} />
      <div className="relative z-10 flex items-start gap-3">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", lightBg)}>
          <span className={accentColor}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{label}</div>
          {loading ? (
            <Skeleton className="h-6 w-24 mt-0.5" />
          ) : (
            <div className="text-xl font-extrabold text-text tabular-nums leading-none">{value}</div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {!loading && sub && <div className="text-[11px] text-text-muted">{sub}</div>}
            {!loading && trend != null && (
              <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", trend >= 0 ? "text-emerald-600" : "text-red-600")}>
                {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
