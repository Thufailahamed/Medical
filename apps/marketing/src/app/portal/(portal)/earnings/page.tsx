"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, Calendar as CalendarIcon, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton, Empty } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { FilterPills } from "@/portal/components/chart/FilterPills";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface EarningsSummary {
  period: string; start: string; end: string;
  totalLkr: number; visitCount: number; avgPerVisitLkr: number;
  trendPct: number; pendingPayoutLkr: number; consultationFee: number;
}

interface TimeseriesResp { bucket: string; points: Array<{ date: string; amountLkr: number; count: number }> }
interface Payout { id: string; amountLkr: number; status: string; requestedAt: string; paidAt?: string | null }
interface PayoutsResp { payouts: Payout[] }

const PERIODS = ["week", "month", "quarter", "year"] as const;
type Period = (typeof PERIODS)[number];

export default function EarningsPage() {
  const t = useT();
  const [period, setPeriod] = useState<Period>("month");

  const payoutLabel = (status: string) => {
    const key = `earnings.payoutStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const { data: sum, isLoading: sumLoading } = useQuery({
    queryKey: ["doctor-earnings", "summary", period],
    queryFn: () => api<EarningsSummary>(`/doctor-earnings/summary?period=${period}`),
  });

  const { data: ts } = useQuery({
    queryKey: ["doctor-earnings", "timeseries", period],
    queryFn: () => api<TimeseriesResp>(`/doctor-earnings/timeseries?period=${period}&bucket=${period === "week" ? "day" : "week"}`),
  });

  const { data: payouts } = useQuery({
    queryKey: ["doctor-earnings", "payouts"],
    queryFn: () => api<PayoutsResp>(`/doctor-earnings/payouts`),
  });

  const points = ts?.points ?? [];

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
          icon={<TrendingUp size={18} />}
          label={t("earnings.totalThisPeriod")}
          value={sumLoading ? "…" : sum ? formatLkr(sum.totalLkr) : "—"}
          sub={sum ? t("earnings.visitsSummary", { count: sum.visitCount, avg: formatLkr(sum.avgPerVisitLkr) }) : ""}
          gradient="from-sky-500 to-blue-600"
          lightBg="bg-sky-50/80"
          accentColor="text-sky-600"
          trend={sum?.trendPct}
        />
        <MetricCard
          icon={<Wallet size={18} />}
          label={t("earnings.pendingPayout")}
          value={sum ? formatLkr(sum.pendingPayoutLkr) : "—"}
          sub={sum?.pendingPayoutLkr ? t("earnings.wiredWithinDays") : t("earnings.allSettled")}
          gradient="from-violet-500 to-purple-600"
          lightBg="bg-violet-50/80"
          accentColor="text-violet-600"
        />
        <MetricCard
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
      <Card padding={false}>
        <div className="px-5 pt-4 pb-1">
          <div className="text-sm font-bold text-text">{t("earnings.chartTitle")}</div>
        </div>
        {points.length === 0 ? (
          <Empty title={t("earnings.noData")} className="py-8" />
        ) : (
          <div style={{ height: 260 }} className="px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "MMM d")} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                  labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
                  formatter={(v: number) => [formatLkr(v), t("earnings.revenue")]}
                />
                <Area type="monotone" dataKey="amountLkr" stroke="var(--brand)" strokeWidth={2.5} fill="url(#earnGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Payouts */}
      <Card padding={false}>
        <div className="px-5 py-3 border-b border-border/60">
          <div className="text-sm font-bold text-text">{t("earnings.payoutsTitle")}</div>
        </div>
        {payouts?.payouts?.length ? (
          <ul className="flex flex-col">
            {payouts.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/50 last:border-0 hover:bg-surface-2/30 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  p.status === "paid" ? "bg-emerald-50 text-emerald-600" : p.status === "processing" ? "bg-sky-50 text-sky-600" : p.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                )}>
                  <Wallet size={14} />
                </div>
                <span className="font-semibold tabular-nums text-sm">{formatLkr(p.amountLkr)}</span>
                <Pill tone={p.status === "paid" ? "success" : p.status === "processing" ? "brand" : p.status === "rejected" ? "danger" : "warn"}>
                  {payoutLabel(p.status)}
                </Pill>
                <span className="text-xs text-text-muted ml-auto">{format(parseISO(p.requestedAt), "MMM d, yyyy")}</span>
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

function MetricCard({ icon, label, value, sub, gradient, lightBg, accentColor, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; lightBg: string; accentColor: string; trend?: number;
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
          <div className="text-xl font-extrabold text-text tabular-nums leading-none">{value}</div>
          <div className="flex items-center gap-2 mt-1">
            {sub && <div className="text-[11px] text-text-muted">{sub}</div>}
            {trend != null && (
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
