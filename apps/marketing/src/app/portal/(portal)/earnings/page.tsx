"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Wallet, DollarSign, Receipt,
  ArrowUpRight, ArrowDownRight, Banknote, HandCoins, CalendarRange,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
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

  const payoutList = payouts?.payouts ?? [];
  const paidTotal = payoutList.filter((p) => p.status === "paid").reduce((acc, p) => acc + p.amountLkr, 0);
  const trend = sum && sum.visitCount > 0 ? sum.trendPct : null;
  const best = points.reduce<ChartPoint | null>((m, p) => (!m || p.amount > m.amount ? p : m), null);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<DollarSign size={13} aria-hidden />}
          kicker="Practice revenue"
          kickerMeta={sum ? `${fmtDayLabel(sum.start)} – ${fmtDayLabel(sum.end)}` : t(`earnings.period.${period}`)}
          title={
            <>
              {t("earnings.title")}{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                &amp; payouts
              </span>
            </>
          }
          description={t("earnings.subtitle")}
          chips={
            <>
              {trend != null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                    trend >= 0
                      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                      : "border-red-300/30 bg-red-400/15 text-red-100",
                  )}
                >
                  {trend >= 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                  {Math.abs(trend).toFixed(1)}% vs previous {period}
                </span>
              ) : null}
              <span className={HERO_CHIP}>
                <Banknote size={12} className="text-emerald-300" aria-hidden />
                {formatLkr(paidTotal)} paid out to date
              </span>
            </>
          }
          aside={
            <div
              role="group"
              aria-label="Period"
              className="inline-flex items-center gap-0.5 rounded-[10px] border border-white/15 bg-white/[0.06] p-1"
            >
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    period === p ? "bg-white text-[#07233a]" : "text-white/70 hover:text-white",
                  )}
                >
                  {t(`earnings.period.${p}`)}
                </button>
              ))}
            </div>
          }
          actions={
            <button
              type="button"
              onClick={() => requestPayout.mutate()}
              disabled={!sum || sum.visitCount === 0 || requestPayout.isPending}
              title={sum && sum.visitCount === 0 ? t("earnings.noData") : undefined}
              className={cn(HERO_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0")}
            >
              <HandCoins size={15} className="text-sky-600" aria-hidden />
              {t("earnings.requestPayout")}
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label={t("earnings.totalThisPeriod")}
            icon={<TrendingUp size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={sumLoading ? "…" : sum ? formatLkr(sum.totalLkr) : "—"}
            sub={sum ? `${sum.visitCount} visit${sum.visitCount === 1 ? "" : "s"}` : "This period"}
            badge={
              trend != null
                ? {
                    text: `${trend >= 0 ? "+" : "−"}${Math.abs(trend).toFixed(1)}%`,
                    tone: trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
                  }
                : undefined
            }
            chart={points.length > 1 ? <MiniBars values={points.map((p) => p.amount)} /> : undefined}
          />
          <StatTile
            label="Average per visit"
            icon={<Receipt size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={sumLoading ? "…" : sum ? formatLkr(sum.avgPerVisitLkr) : "—"}
            sub={sum ? `Fee ${formatLkr(sum.consultationFee)} ${t("earnings.perVisit")}` : t("earnings.perVisit")}
          />
          <StatTile
            label={t("earnings.pendingPayout")}
            icon={<Wallet size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={sumLoading ? "…" : sum ? formatLkr(sum.pendingPayoutLkr) : "—"}
            sub={sum?.pendingPayoutLkr ? t("earnings.wiredWithinDays") : t("earnings.allSettled")}
            pulse={!!sum?.pendingPayoutLkr}
          />
          <StatTile
            label="Paid out"
            icon={<Banknote size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={payoutsLoading ? "…" : formatLkr(paidTotal)}
            sub={`${payoutList.filter((p) => p.status === "paid").length} settled payout${payoutList.filter((p) => p.status === "paid").length === 1 ? "" : "s"}`}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Revenue chart ────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="earn-chart">
          <PanelHeader
            id="earn-chart"
            icon={<CalendarRange size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("earnings.chartTitle")}
            caption={
              best && best.amount > 0
                ? `Best ${gran}: ${bucketLabel(best.key, gran)} · ${formatLkr(best.amount)}`
                : sum
                  ? `${fmtDayLabel(sum.start)} – ${fmtDayLabel(sum.end)}`
                  : undefined
            }
            action={
              sum && sum.visitCount > 0 ? (
                <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">
                  {formatLkr(sum.totalLkr)}
                </span>
              ) : undefined
            }
          />
          {tsLoading ? (
            <div className="mt-5 h-[260px] animate-pulse rounded-xl bg-slate-100" />
          ) : points.length === 0 ? (
            <EmptyBlock
              icon={<TrendingUp size={19} />}
              title={t("earnings.noData")}
              body="Completed consultations are credited here automatically. Try a longer period."
            />
          ) : (
            <div style={{ height: 280 }} className="-mx-2 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 12, right: 14, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="key"
                    tickFormatter={(k: string) => bucketLabel(k, gran)}
                    stroke="#94a3b8" fontSize={11}
                    tickLine={false} axisLine={false} minTickGap={24}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip gran={gran} />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1.5 }} />
                  <Area type="monotone" dataKey="amount" stroke="#0284c7" strokeWidth={2.5} fill="url(#earnGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ── Payouts ──────────────────────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Payouts">
          <section className={PANEL} aria-labelledby="earn-payouts">
            <PanelHeader
              id="earn-payouts"
              icon={<Banknote size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("earnings.payoutsTitle")}
              caption={`${payoutList.length} request${payoutList.length === 1 ? "" : "s"}`}
            />
            {payoutsLoading ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : payoutList.length ? (
              <ul className="mt-4 flex flex-col gap-0.5">
                {payoutList.map((p) => (
                  <li key={p.id} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ring-1 ring-inset", PAYOUT_CHIP[p.status] ?? PAYOUT_CHIP.pending)}>
                      <Banknote size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{formatLkr(p.amountLkr)}</span>
                        <Pill tone={PAYOUT_TONE[p.status] ?? "warn"}>{payoutLabel(p.status)}</Pill>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">
                        {fmtDayLabel(p.periodStart)} – {fmtDayLabel(p.periodEnd)} · {t("earnings.eventCount", { count: p.eventCount })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] tabular-nums">
                      <div className="text-slate-400">{format(parseTs(p.createdAt), "MMM d")}</div>
                      {p.status === "paid" && p.paidAt ? (
                        <div className="mt-0.5 font-semibold text-emerald-600">{format(parseTs(p.paidAt), "MMM d")}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock
                icon={<Wallet size={19} />}
                title={t("earnings.noPayouts")}
                body="Request a payout once you have completed consultations in the selected period."
              />
            )}
          </section>

          {sum ? (
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white"
              style={{
                background:
                  "radial-gradient(420px 200px at 100% 0%, rgba(52,211,153,0.30), transparent 60%), linear-gradient(135deg, #064e3b 0%, #047857 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(4,120,87,0.6)",
              }}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden />
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                {t("earnings.consultationFee")}
              </span>
              <span className="mt-1 block text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                {formatLkr(sum.consultationFee)}
              </span>
              <span className="block text-xs text-white/60">{t("earnings.perVisit")} · change it in Settings</span>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const tail = values.slice(-10);
  const max = Math.max(...tail, 1);
  return (
    <span className="flex h-8 items-end gap-[3px]">
      {tail.map((v, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-sm", i === tail.length - 1 ? "bg-sky-500" : "bg-sky-200")}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function ChartTooltip({ active, payload, label, gran }: {
  active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string; gran: Granularity;
}) {
  const t = useT();
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3),inset_0_0_0_1px_rgba(15,23,42,0.08)]">
      <div className="font-semibold text-slate-900">{bucketLabel(label, gran)}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-text-muted">{t("earnings.revenue")}</span>
        <span className="font-extrabold text-text tabular-nums ml-auto pl-3">{formatLkr(p.amount)}</span>
      </div>
      <div className="mt-0.5 text-text-muted pl-3.5">{t("earnings.eventCount", { count: p.count })}</div>
    </div>
  );
}
