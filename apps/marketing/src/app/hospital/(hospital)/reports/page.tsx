"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bed,
  CalendarDays,
  Download,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";

export default function ReportsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);

  const tiles = useQuery({
    queryKey: ["reportTiles"],
    queryFn: () => api<{ tiles: any[] }>("/hospital-portal/reports/dashboard-tiles"),
    refetchInterval: 60_000,
  });

  const revenue = useQuery({
    queryKey: ["reportRevenue", from, to],
    queryFn: () =>
      api<{ series: any[]; total: number }>(
        `/hospital-portal/reports/revenue?from=${from}&to=${to}`
      ),
  });

  const opd = useQuery({
    queryKey: ["reportOpd", from, to],
    queryFn: () =>
      api<{ days: any[] }>(`/hospital-portal/reports/opd?from=${from}&to=${to}`),
  });

  const ipd = useQuery({
    queryKey: ["reportIpd", from, to],
    queryFn: () =>
      api<{ admitted: any[]; discharged: any[]; transferred: any[] }>(
        `/hospital-portal/reports/ipd?from=${from}&to=${to}`
      ),
  });

  const occ = useQuery({
    queryKey: ["reportOcc"],
    queryFn: () => api<{ wards: any[] }>("/hospital-portal/reports/occupancy"),
  });

  const doctor = useQuery({
    queryKey: ["reportDoctor", from, to],
    queryFn: () =>
      api<{ rows: any[] }>(`/hospital-portal/reports/doctor-utilization?from=${from}&to=${to}`),
  });

  const topDiag = useQuery({
    queryKey: ["reportTopDiag", from, to],
    queryFn: () =>
      api<{ rows: any[] }>(`/hospital-portal/reports/top-diagnoses?from=${from}&to=${to}`),
  });

  const tileMap = Object.fromEntries(
    (tiles.data?.tiles ?? []).map((t: any) => [t.key, t])
  );

  function exportCsv() {
    const rows = [
      ["metric", "value"],
      ...(tiles.data?.tiles ?? []).map((t: any) => [t.key, String(t.value)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.reports")}
        subtitle={t("reports.subtitle")}
        actions={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            <Download size={14} />
            {t("common.export")} CSV
          </button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2">
            <CalendarDays size={14} className="text-text-muted" />
            <span className="text-sm font-medium">{t("common.from")}</span>
            <input
              type="date"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <CalendarDays size={14} className="text-text-muted" />
            <span className="text-sm font-medium">{t("common.to")}</span>
            <input
              type="date"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Activity size={14} />}
          label={t("dashboard.opdToday")}
          value={tileMap.opdToday?.value ?? 0}
        />
        <KpiCard
          icon={<Bed size={14} />}
          label={t("dashboard.ipdCensus")}
          value={tileMap.ipdCensus?.value ?? 0}
        />
        <KpiCard
          icon={<Bed size={14} />}
          label={t("dashboard.bedsOccupied")}
          value={`${tileMap.beds?.value ?? 0}/${tileMap.beds?.total ?? 0}`}
        />
        <KpiCard
          icon={<TrendingUp size={14} />}
          label={t("dashboard.revenueToday")}
          value={formatLkr(tileMap.revenueToday?.value ?? 0, locale)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("reports.revenue")} icon={<TrendingUp size={15} className="text-brand" />} />
          <p className="mt-3 mb-3 text-sm text-text-muted">
            {t("reports.total")}: <span className="font-bold text-text">{formatLkr(revenue.data?.total ?? 0, locale)}</span>
          </p>
          {revenue.data?.series?.length ? (
            <div className="space-y-1">
              {revenue.data.series.map((s: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/40 last:border-0 py-1.5 text-xs"
                >
                  <span className="text-text-muted">{s.bucket}</span>
                  <span className="font-mono font-semibold text-text">
                    {formatLkr(Number(s.total), locale)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">—</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t("reports.occupancy")} icon={<BarChart3 size={15} className="text-brand" />} />
          <div className="mt-3 space-y-2">
            {occ.data?.wards?.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{w.name}</span>
                <span className="text-text-muted">
                  {w.occupied}/{w.total}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("reports.opd")} icon={<Activity size={15} className="text-brand" />} />
          {opd.data?.days?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {opd.data.days.slice(0, 14).map((d: any, i: number) => (
                <li key={i} className="flex justify-between border-b border-border/40 last:border-0 py-1.5">
                  <span className="text-text-muted">{d.date}</span>
                  <span className="font-semibold">{d.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">—</p>
          )}
        </Card>

        <Card>
          <CardHeader title={t("reports.ipd")} icon={<Bed size={15} className="text-brand" />} />
          <div className="mt-3 space-y-1.5 text-sm">
            <p>
              <span className="text-text-muted">{t("reports.admitted")}: </span>
              <span className="font-bold text-warn">{ipd.data?.admitted?.length ?? 0}</span>
            </p>
            <p>
              <span className="text-text-muted">{t("reports.discharged")}: </span>
              <span className="font-bold text-emerald-700">{ipd.data?.discharged?.length ?? 0}</span>
            </p>
            <p>
              <span className="text-text-muted">{t("reports.transferred")}: </span>
              <span className="font-bold text-sky-700">{ipd.data?.transferred?.length ?? 0}</span>
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("reports.doctorUtilization")} icon={<Stethoscope size={15} className="text-brand" />} />
          <ul className="mt-3 space-y-1 text-sm">
            {doctor.data?.rows?.slice(0, 10).map((d: any, i: number) => (
              <li key={i} className="flex justify-between border-b border-border/40 last:border-0 py-1.5">
                <span className="truncate text-text-muted">{d.doctorId?.slice(0, 8)}…</span>
                <span className="font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t("reports.topDiagnoses")} icon={<BarChart3 size={15} className="text-brand" />} />
          <ul className="mt-3 space-y-1 text-sm">
            {topDiag.data?.rows?.slice(0, 10).map((d: any, i: number) => (
              <li key={i} className="flex justify-between border-b border-border/40 last:border-0 py-1.5">
                <span className="truncate text-text-muted">{d.diagnosis ?? "—"}</span>
                <span className="font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-text">{value}</p>
    </Card>
  );
}