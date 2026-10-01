"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bed,
  BedDouble,
  CalendarDays,
  CircleDollarSign,
  Download,
  Receipt,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatLkr } from "@/hospital/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  BreakdownBar,
  FIELD_INPUT,
  HeroPulse,
  QuickToolsPanel,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface ReportTile {
  key: string;
  value: number;
  total?: number;
}
interface RevenuePoint {
  bucket: string;
  total: number;
}
interface OpdDay {
  date: string;
  count: number;
}
interface WardOcc {
  id: string;
  name: string;
  occupied: number;
  total: number;
}
interface CountRow {
  doctorId?: string;
  diagnosis?: string;
  count: number;
}

const OCC_COLORS = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-teal-500"];

export default function ReportsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const tiles = useQuery({
    queryKey: ["reportTiles"],
    queryFn: () => api<{ tiles: ReportTile[] }>("/hospital-portal/reports/dashboard-tiles"),
    refetchInterval: 60_000,
  });

  const revenue = useQuery({
    queryKey: ["reportRevenue", from, to],
    queryFn: () =>
      api<{ series: RevenuePoint[]; total: number }>(
        `/hospital-portal/reports/revenue?from=${from}&to=${to}`
      ),
  });

  const opd = useQuery({
    queryKey: ["reportOpd", from, to],
    queryFn: () =>
      api<{ days: OpdDay[] }>(`/hospital-portal/reports/opd?from=${from}&to=${to}`),
  });

  const ipd = useQuery({
    queryKey: ["reportIpd", from, to],
    queryFn: () =>
      api<{ admitted: unknown[]; discharged: unknown[]; transferred: unknown[] }>(
        `/hospital-portal/reports/ipd?from=${from}&to=${to}`
      ),
  });

  const occ = useQuery({
    queryKey: ["reportOcc"],
    queryFn: () => api<{ wards: WardOcc[] }>("/hospital-portal/reports/occupancy"),
  });

  const doctor = useQuery({
    queryKey: ["reportDoctor", from, to],
    queryFn: () =>
      api<{ rows: CountRow[] }>(`/hospital-portal/reports/doctor-utilization?from=${from}&to=${to}`),
  });

  const topDiag = useQuery({
    queryKey: ["reportTopDiag", from, to],
    queryFn: () =>
      api<{ rows: CountRow[] }>(`/hospital-portal/reports/top-diagnoses?from=${from}&to=${to}`),
  });

  const tileMap = useMemo(
    () => Object.fromEntries((tiles.data?.tiles ?? []).map((tl) => [tl.key, tl])),
    [tiles.data]
  );

  const revenueMax = Math.max(1, ...(revenue.data?.series ?? []).map((s) => Number(s.total)));
  const opdMax = Math.max(1, ...(opd.data?.days ?? []).map((d) => d.count));
  const doctorMax = Math.max(1, ...(doctor.data?.rows ?? []).map((d) => d.count));

  const occupancyItems = (occ.data?.wards ?? []).map((w, i) => ({
    key: w.id,
    label: `${w.name} · ${w.occupied}/${w.total}`,
    count: w.occupied,
    color: OCC_COLORS[i % OCC_COLORS.length],
  }));

  const diagItems = (topDiag.data?.rows ?? []).map((d, i) => ({
    key: d.diagnosis ?? String(i),
    label: d.diagnosis ?? "—",
    count: d.count,
    color: OCC_COLORS[i % OCC_COLORS.length],
  }));

  function exportCsv() {
    const rows = [
      ["metric", "value"],
      ...(tiles.data?.tiles ?? []).map((tl) => [tl.key, String(tl.value)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hero = (
    <DoctorHero
      kickerIcon={<BarChart3 size={13} aria-hidden />}
      kicker={t("nav.reports")}
      kickerMeta={`${from} → ${to}`}
      title={
        <>
          {t("nav.reportsOverview")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · analytics
          </span>
        </>
      }
      description={t("reports.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <CalendarDays size={12} className="text-sky-300" />
            {from} → {to}
          </span>
          <span className={HERO_CHIP}>
            <TrendingUp size={12} className="text-emerald-300" />
            {formatLkr(revenue.data?.total ?? 0, locale)} {t("reports.revenue").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<TrendingUp size={18} />}
          label={t("reports.revenue")}
          value={revenue.isLoading ? "…" : formatLkr(revenue.data?.total ?? 0, locale)}
          sub={`${from} → ${to}`}
        />
      }
      actions={
        <>
          <Link href="/hospital/billing" className={HERO_GHOST}>
            <Receipt size={14} />
            {t("nav.billing")}
          </Link>
          <button onClick={exportCsv} className={HERO_PRIMARY}>
            <Download size={14} className="text-emerald-600" />
            {t("common.export")} CSV
          </button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Activity size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("dashboard.opdToday")}
          value={tiles.isLoading ? "…" : String(tileMap.opdToday?.value ?? 0)}
          sub={t("common.today")}
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("dashboard.ipdCensus")}
          value={tiles.isLoading ? "…" : String(tileMap.ipdCensus?.value ?? 0)}
          sub={t("nav.inpatient")}
        />
        <StatTile
          icon={<Bed size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("dashboard.bedsOccupied")}
          value={tiles.isLoading ? "…" : `${tileMap.beds?.value ?? 0}/${tileMap.beds?.total ?? 0}`}
          sub={t("nav.beds")}
        />
        <StatTile
          icon={<TrendingUp size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("dashboard.revenueToday")}
          value={tiles.isLoading ? "…" : formatLkr(tileMap.revenueToday?.value ?? 0, locale)}
          sub={t("common.today")}
        />
      </HeroOverlap>

      <section className={cn(PANEL, "flex flex-wrap items-center gap-4")}>
        <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          <CalendarDays size={14} />
          {t("common.filter")}
        </span>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{t("common.from")}</span>
          <input
            type="date"
            className={cn(FIELD_INPUT, "w-auto py-1.5")}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{t("common.to")}</span>
          <input
            type="date"
            className={cn(FIELD_INPUT, "w-auto py-1.5")}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <div className="grid gap-5 md:grid-cols-2">
            <section className={PANEL}>
              <PanelHeader
                icon={<TrendingUp size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title={t("reports.revenue")}
                caption={formatLkr(revenue.data?.total ?? 0, locale)}
              />
              {revenue.data?.series?.length ? (
                <div className="mt-4 space-y-2.5">
                  {revenue.data.series.map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{s.bucket}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{formatLkr(Number(s.total), locale)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{ width: `${(Number(s.total) / revenueMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock icon={<TrendingUp size={19} />} title={t("reports.revenue")} body="—" />
              )}
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<BarChart3 size={16} />}
                tone="bg-sky-50 text-sky-600"
                title={t("reports.occupancy")}
                caption={`${occ.data?.wards?.length ?? 0} ${t("nav.wards").toLowerCase()}`}
              />
              {occupancyItems.length ? (
                <BreakdownBar items={occupancyItems} total={occupancyItems.reduce((a, i) => a + i.count, 0)} />
              ) : (
                <EmptyBlock icon={<BarChart3 size={19} />} title={t("reports.occupancy")} body="—" />
              )}
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<Activity size={16} />}
                tone="bg-sky-50 text-sky-600"
                title={t("reports.opd")}
                caption={`${opd.data?.days?.length ?? 0} days`}
              />
              {opd.data?.days?.length ? (
                <div className="mt-4 space-y-2.5">
                  {opd.data.days.slice(0, 14).map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{d.date}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{d.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400"
                          style={{ width: `${(d.count / opdMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock icon={<Activity size={19} />} title={t("reports.opd")} body="—" />
              )}
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<BedDouble size={16} />}
                tone="bg-amber-50 text-amber-600"
                title={t("reports.ipd")}
                caption={`${from} → ${to}`}
              />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-amber-700">{ipd.data?.admitted?.length ?? 0}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600">{t("reports.admitted")}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-emerald-700">{ipd.data?.discharged?.length ?? 0}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">{t("reports.discharged")}</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-3 text-center">
                  <p className="text-2xl font-extrabold tabular-nums text-sky-700">{ipd.data?.transferred?.length ?? 0}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-sky-600">{t("reports.transferred")}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <section className={PANEL}>
              <PanelHeader
                icon={<Stethoscope size={16} />}
                tone="bg-violet-50 text-violet-600"
                title={t("reports.doctorUtilization")}
                caption={String(doctor.data?.rows?.length ?? 0)}
              />
              {doctor.data?.rows?.length ? (
                <div className="mt-4 space-y-2.5">
                  {doctor.data.rows.slice(0, 10).map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-mono text-slate-500">{d.doctorId?.slice(0, 8)}…</span>
                        <span className="font-semibold tabular-nums text-slate-900">{d.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                          style={{ width: `${(d.count / doctorMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock icon={<Stethoscope size={19} />} title={t("reports.doctorUtilization")} body="—" />
              )}
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<BarChart3 size={16} />}
                tone="bg-rose-50 text-rose-600"
                title={t("reports.topDiagnoses")}
                caption={String(topDiag.data?.rows?.length ?? 0)}
              />
              {diagItems.length ? (
                <BreakdownBar items={diagItems} total={diagItems.reduce((a, i) => a + i.count, 0)} max={10} />
              ) : (
                <EmptyBlock icon={<BarChart3 size={19} />} title={t("reports.topDiagnoses")} body="—" />
              )}
            </section>
          </div>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="reports-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Activity, label: t("nav.dashboard"), hint: t("common.today"), href: "/hospital/dashboard", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Receipt, label: t("nav.billing"), hint: "Invoices", href: "/hospital/billing", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
              { icon: CircleDollarSign, label: t("nav.billingOutstanding"), hint: "Balances", href: "/hospital/billing/outstanding", tone: "from-amber-500 to-orange-600 shadow-amber-500/30" },
              { icon: BedDouble, label: t("nav.inpatient"), hint: "Admissions", href: "/hospital/ipd", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
