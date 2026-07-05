"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, Calendar as CalendarIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton, Empty } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatLkr } from "@/portal/lib/format";

interface EarningsSummary {
  period: string;
  start: string;
  end: string;
  totalLkr: number;
  visitCount: number;
  avgPerVisitLkr: number;
  trendPct: number;
  pendingPayoutLkr: number;
  consultationFee: number;
}

interface TimeseriesResp {
  bucket: string;
  points: Array<{ date: string; amountLkr: number; count: number }>;
}

interface Payout {
  id: string;
  amountLkr: number;
  status: string;
  requestedAt: string;
  paidAt?: string | null;
}

interface PayoutsResp {
  payouts: Payout[];
}

export default function EarningsPage() {
  const t = useT();
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  const { data: sum, isLoading: sumLoading } = useQuery({
    queryKey: ["doctor-earnings", "summary", period],
    queryFn: () => api<EarningsSummary>(`/doctor-earnings/summary?period=${period}`),
  });

  const { data: ts } = useQuery({
    queryKey: ["doctor-earnings", "timeseries", period],
    queryFn: () =>
      api<TimeseriesResp>(
        `/doctor-earnings/timeseries?period=${period}&bucket=${period === "week" ? "day" : "week"}`
      ),
  });

  const { data: payouts } = useQuery({
    queryKey: ["doctor-earnings", "payouts"],
    queryFn: () => api<PayoutsResp>(`/doctor-earnings/payouts`),
  });

  const points = ts?.points ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("earnings.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("earnings.subtitle")}</p>
      </div>

      <div className="flex items-center gap-1.5">
        {(["week", "month", "quarter", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={
              "px-3 h-8 rounded-md text-xs border transition-colors " +
              (period === p
                ? "bg-brand-soft text-brand border-brand/30"
                : "bg-surface text-text-soft border-border hover:bg-surface-2")
            }
          >
            {t(`earnings.period.${p}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric
          icon={<TrendingUp size={14} />}
          label={t("earnings.totalThisPeriod")}
          value={sumLoading ? "…" : sum ? formatLkr(sum.totalLkr) : "—"}
          sub={sum ? `${sum.visitCount} visits · avg ${formatLkr(sum.avgPerVisitLkr)}` : ""}
          tone={sum?.trendPct && sum.trendPct > 0 ? "success" : "brand"}
        />
        <Metric
          icon={<Wallet size={14} />}
          label={t("earnings.pendingPayout")}
          value={sum ? formatLkr(sum.pendingPayoutLkr) : "—"}
          sub={sum?.pendingPayoutLkr ? "Wired within 7 days" : "All settled"}
          tone="violet"
        />
        <Metric
          icon={<CalendarIcon size={14} />}
          label={t("earnings.consultationFee")}
          value={sum ? formatLkr(sum.consultationFee) : "—"}
          sub="Per visit"
          tone="brand"
        />
      </div>

      {sum?.trendPct != null ? (
        <div className="flex items-center gap-2 text-xs">
          <Pill tone={sum.trendPct >= 0 ? "success" : "danger"}>
            {sum.trendPct >= 0 ? "+" : ""}
            {sum.trendPct.toFixed(1)}%
          </Pill>
          <span className="text-text-soft">vs prior period</span>
        </div>
      ) : null}

      <Card>
        <CardHeader title={t("earnings.chartTitle")} />
        {points.length === 0 ? (
          <Empty title={t("earnings.noData")} className="mt-3" />
        ) : (
          <div style={{ height: 240 }} className="mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), "MMM d")}
                  stroke="var(--text-muted)"
                  fontSize={11}
                />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => format(parseISO(d as string), "MMM d")}
                  formatter={(v: number) => [formatLkr(v), "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="amountLkr"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card padding={false}>
        <CardHeader title={t("earnings.payoutsTitle")} />
        {payouts?.payouts?.length ? (
          <ul className="divide-y divide-border">
            {payouts.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Wallet size={14} className="text-text-soft" />
                <span className="font-medium tabular-nums">{formatLkr(p.amountLkr)}</span>
                <Pill
                  tone={
                    p.status === "paid"
                      ? "success"
                      : p.status === "processing"
                        ? "brand"
                        : p.status === "rejected"
                          ? "danger"
                          : "warn"
                  }
                >
                  {p.status}
                </Pill>
                <span className="text-xs text-text-muted ml-auto">
                  {format(parseISO(p.requestedAt), "MMM d")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 pb-4">
            <Empty title={t("earnings.noPayouts")} />
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "brand" | "success" | "warn" | "violet";
}) {
  const bgClass = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-amber-700",
    violet: "bg-violet-soft text-violet",
  }[tone];
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgClass}`}>{icon}</div>
        <div>
          <div className="text-xs text-text-soft">{label}</div>
          <div className="text-xl font-semibold tabular-nums leading-tight text-text">{value}</div>
          {sub ? <div className="text-[10px] text-text-muted">{sub}</div> : null}
        </div>
      </div>
    </Card>
  );
}