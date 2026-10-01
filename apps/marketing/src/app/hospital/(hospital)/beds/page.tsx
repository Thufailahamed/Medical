"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Hospital,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useT } from "@/hospital/i18n";
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
import { HeroPulse, QuickToolsPanel } from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Ward = { id: string; name: string; type?: string; capacity?: number };
type Bed = { id: string; bedNumber?: string; status?: string };

const BED_TILE: Record<string, string> = {
  occupied: "bg-amber-50 text-amber-700 ring-amber-200",
  cleaning: "bg-sky-50 text-sky-700 ring-sky-200",
  maintenance: "bg-slate-100 text-slate-500 ring-slate-200",
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const BED_DOT: Record<string, string> = {
  occupied: "bg-amber-500",
  cleaning: "bg-sky-400",
  maintenance: "bg-slate-400",
  available: "bg-emerald-500",
};

export default function BedsPage() {
  const t = useT();

  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: Ward[] }>("/hospital-portal/wards"),
  });

  const wardList = wards.data?.wards ?? [];

  const bedQueries = useQueries({
    queries: wardList.map((w) => ({
      queryKey: ["beds", w.id],
      queryFn: () => api<{ beds: Bed[] }>(`/hospital-portal/beds?wardId=${w.id}`),
      refetchInterval: 30_000,
    })),
  });

  const bedsByWard = new Map(
    wardList.map((w, i) => [w.id, bedQueries[i]?.data?.beds ?? []]),
  );

  const allBeds = [...bedsByWard.values()].flat();
  const totals = {
    total: allBeds.length,
    available: allBeds.filter((b) => b.status === "available").length,
    occupied: allBeds.filter((b) => b.status === "occupied").length,
    cleaning: allBeds.filter((b) => b.status === "cleaning").length,
    maintenance: allBeds.filter((b) => b.status === "maintenance").length,
  };
  const occupancyRate =
    totals.total > 0 ? Math.round((totals.occupied / totals.total) * 100) : 0;
  const isLoading = wards.isLoading || bedQueries.some((q) => q.isLoading);

  const refetchAll = () => {
    wards.refetch();
    bedQueries.forEach((q) => q.refetch());
  };

  const hero = (
    <DoctorHero
      kickerIcon={<BedDouble size={13} aria-hidden />}
      kicker={t("nav.inpatient")}
      kickerMeta={t("nav.beds")}
      title={
        <>
          {t("nav.beds")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {occupancyRate}%
          </span>
        </>
      }
      description={t("beds.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <BedDouble size={12} className="text-amber-300" />
            {totals.occupied}/{totals.total} {t("wards.occupied")}
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {totals.available} {t("dashboard.available").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <Hospital size={12} className="text-sky-300" />
            {wardList.length} {t("nav.wards").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<BedDouble size={18} />}
          label={t("dashboard.bedOccupancy")}
          value={isLoading ? "…" : `${totals.occupied}/${totals.total}`}
          sub={`${totals.available} ${t("dashboard.available").toLowerCase()} · ${occupancyRate}%`}
        />
      }
      actions={
        <>
          <button type="button" onClick={refetchAll} className={HERO_GHOST}>
            <RefreshCw size={13} aria-hidden />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/wards" className={HERO_PRIMARY}>
            <Hospital size={14} className="text-emerald-600" /> {t("nav.wards")}
          </Link>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("dashboard.available")}
          value={isLoading ? "…" : String(totals.available)}
          sub="Ready for admission"
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("dashboard.occupied")}
          value={isLoading ? "…" : String(totals.occupied)}
          sub={`${occupancyRate}% ${t("wards.occupied")}`}
          pulse={totals.occupied > 0}
        />
        <StatTile
          icon={<Sparkles size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("dashboard.cleaning")}
          value={isLoading ? "…" : String(totals.cleaning)}
          sub="Turnover in progress"
        />
        <StatTile
          icon={<Wrench size={16} />}
          tone="bg-slate-100 text-slate-500"
          label={t("dashboard.maintenance")}
          value={isLoading ? "…" : String(totals.maintenance)}
          sub="Out of service"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-9">
          {wards.isLoading ? (
            <section className={PANEL}>
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            </section>
          ) : wardList.length === 0 ? (
            <section className={PANEL}>
              <EmptyBlock
                icon={<Hospital size={19} />}
                title={t("wards.noWards")}
                body="Create a ward first — beds are grouped by care unit."
                actions={
                  <Link
                    href="/hospital/wards"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Hospital size={13} /> {t("nav.wards")}
                  </Link>
                }
              />
            </section>
          ) : (
            wardList.map((w) => {
              const beds = bedsByWard.get(w.id) ?? [];
              const occupied = beds.filter((b) => b.status === "occupied").length;
              return (
                <section key={w.id} className={PANEL}>
                  <PanelHeader
                    icon={<Hospital size={16} />}
                    tone="bg-sky-50 text-sky-600"
                    title={w.name}
                    caption={`${occupied}/${beds.length} ${t("wards.occupied")}`}
                    href={`/hospital/wards/${w.id}`}
                    linkLabel={t("wards.wardDetail")}
                  />
                  {beds.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
                      {t("wards.noBeds")}
                    </p>
                  ) : (
                    <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {beds.map((b) => (
                        <li
                          key={b.id}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl p-2.5 ring-1 ring-inset",
                            BED_TILE[b.status ?? ""] ?? BED_TILE.available,
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold">
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", BED_DOT[b.status ?? ""] ?? BED_DOT.available)}
                              aria-hidden
                            />
                            {b.bedNumber}
                          </span>
                          <span className="text-[10px] font-semibold capitalize opacity-80">
                            {b.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-3">
          <section className={PANEL}>
            <PanelHeader
              icon={<BedDouble size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("dashboard.bedOccupancy")}
              caption={`${occupancyRate}% ${t("wards.occupied")}`}
            />
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="h-full rounded-l-full bg-amber-500"
                style={{ width: `${totals.total > 0 ? (totals.occupied / totals.total) * 100 : 0}%` }}
              />
              <span
                className="h-full bg-sky-400"
                style={{ width: `${totals.total > 0 ? (totals.cleaning / totals.total) * 100 : 0}%` }}
              />
              <span
                className="h-full bg-slate-300"
                style={{ width: `${totals.total > 0 ? (totals.maintenance / totals.total) * 100 : 0}%` }}
              />
            </div>
            <ul className="mt-4 flex flex-col gap-1.5">
              {[
                { label: t("dashboard.occupied"), value: totals.occupied, dot: "bg-amber-500" },
                { label: t("dashboard.available"), value: totals.available, dot: "bg-emerald-500" },
                { label: t("dashboard.cleaning"), value: totals.cleaning, dot: "bg-sky-400" },
                { label: t("dashboard.maintenance"), value: totals.maintenance, dot: "bg-slate-300" },
              ].map((s) => (
                <li
                  key={s.label}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px]"
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{s.label}</span>
                  <span className="min-w-[28px] rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700">
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <QuickToolsPanel
            id="beds-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: Hospital,
                label: t("nav.wards"),
                hint: "Manage",
                href: "/hospital/wards",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: BedDouble,
                label: t("nav.ipd"),
                hint: "Census",
                href: "/hospital/ipd",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: ArrowRight,
                label: t("nav.dashboard"),
                hint: "Overview",
                href: "/hospital/dashboard",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
