"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";

export default function ReportsPage() {
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
        title={tr(locale, "nav.reports")}
        subtitle={tr(locale, "reports.subtitle")}
        actions={
          <button
            onClick={exportCsv}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            {tr(locale, "common.export")} CSV
          </button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm">{tr(locale, "common.from")}</span>
            <input
              type="date"
              className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm">{tr(locale, "common.to")}</span>
            <input
              type="date"
              className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label={tr(locale, "dashboard.opdToday")}
          value={tileMap.opdToday?.value ?? 0}
        />
        <KpiCard
          label={tr(locale, "dashboard.ipdCensus")}
          value={tileMap.ipdCensus?.value ?? 0}
        />
        <KpiCard
          label={tr(locale, "dashboard.bedsOccupied")}
          value={`${tileMap.beds?.value ?? 0}/${tileMap.beds?.total ?? 0}`}
        />
        <KpiCard
          label={tr(locale, "dashboard.revenueToday")}
          value={formatLkr(tileMap.revenueToday?.value ?? 0, locale)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-lg font-semibold">
            {tr(locale, "reports.revenue")}
          </h3>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            {tr(locale, "reports.total")}: {formatLkr(revenue.data?.total ?? 0, locale)}
          </p>
          {revenue.data?.series?.length ? (
            <div className="space-y-1">
              {revenue.data.series.map((s: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <span>{s.bucket}</span>
                  <span className="font-mono">
                    {formatLkr(Number(s.total), locale)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">
            {tr(locale, "reports.occupancy")}
          </h3>
          <div className="space-y-2">
            {occ.data?.wards?.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between">
                <span>{w.name}</span>
                <span className="text-sm">
                  {w.occupied}/{w.total}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">{tr(locale, "reports.opd")}</h3>
          {opd.data?.days?.length ? (
            <ul className="space-y-1 text-sm">
              {opd.data.days.slice(0, 14).map((d: any, i: number) => (
                <li key={i} className="flex justify-between">
                  <span>{d.date}</span>
                  <span>{d.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">{tr(locale, "reports.ipd")}</h3>
          <p className="text-sm">
            {tr(locale, "reports.admitted")}: {ipd.data?.admitted?.length ?? 0}
          </p>
          <p className="text-sm">
            {tr(locale, "reports.discharged")}: {ipd.data?.discharged?.length ?? 0}
          </p>
          <p className="text-sm">
            {tr(locale, "reports.transferred")}: {ipd.data?.transferred?.length ?? 0}
          </p>
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">
            {tr(locale, "reports.doctorUtilization")}
          </h3>
          <ul className="space-y-1 text-sm">
            {doctor.data?.rows?.slice(0, 10).map((d: any, i: number) => (
              <li key={i} className="flex justify-between">
                <span className="truncate">{d.doctorId?.slice(0, 8)}…</span>
                <span>{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">
            {tr(locale, "reports.topDiagnoses")}
          </h3>
          <ul className="space-y-1 text-sm">
            {topDiag.data?.rows?.slice(0, 10).map((d: any, i: number) => (
              <li key={i} className="flex justify-between">
                <span className="truncate">{d.diagnosis ?? "—"}</span>
                <span>{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}