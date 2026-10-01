"use client";

import Link from "next/link";
import {
  BedDouble,
  Building2,
  CalendarPlus,
  DoorOpen,
  FlaskConical,
  LayoutDashboard,
  Moon,
  PackageOpen,
  Pill,
  Receipt,
  RefreshCw,
  Stethoscope,
  Sun,
  Sunset,
  UserPlus,
  Users,
} from "lucide-react";

import { useDashboard, type DashboardTile } from "@/hospital/hooks/useDashboard";
import { useT } from "@/hospital/i18n";
import { relativeTime } from "@/hospital/lib/format";
import { cn } from "@/hospital/lib/utils";
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
  HeroPulse,
  PromoCard,
  QuickToolsPanel,
} from "@/patient/components/workspace";

const TILE_STYLE: Record<
  DashboardTile["key"],
  { icon: React.ReactNode; tone: string; sub: string; alert?: boolean }
> = {
  opdToday: {
    icon: <Stethoscope size={16} />,
    tone: "bg-sky-50 text-sky-600",
    sub: "Consultations today",
  },
  ipdCensus: {
    icon: <BedDouble size={16} />,
    tone: "bg-emerald-50 text-emerald-600",
    sub: "Admitted now",
  },
  beds: {
    icon: <BedDouble size={16} />,
    tone: "bg-amber-50 text-amber-600",
    sub: "Occupied of total",
  },
  revenueToday: {
    icon: <Receipt size={16} />,
    tone: "bg-emerald-50 text-emerald-600",
    sub: "Collected today",
  },
  pendingLabs: {
    icon: <FlaskConical size={16} />,
    tone: "bg-violet-50 text-violet-600",
    sub: "Awaiting processing",
    alert: true,
  },
  pendingRx: {
    icon: <Pill size={16} />,
    tone: "bg-rose-50 text-rose-600",
    sub: "Awaiting dispense",
    alert: true,
  },
  walkInsWaiting: {
    icon: <DoorOpen size={16} />,
    tone: "bg-sky-50 text-sky-600",
    sub: "In reception queue",
    alert: true,
  },
  lowStock: {
    icon: <PackageOpen size={16} />,
    tone: "bg-amber-50 text-amber-600",
    sub: "Inventory alerts",
    alert: true,
  },
};

const SHIFT_ICON = { morning: Sun, evening: Sunset, night: Moon } as const;

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function HospitalDashboardPage() {
  const t = useT();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();

  const hospital = data?.hospital;
  const tiles = data?.tiles ?? [];
  const admissions = data?.admissions ?? [];
  const occupancy = data?.occupancy;
  const staff = data?.staffOnShift ?? [];
  const staffTotals = data?.staffTotals;
  const ShiftIcon = SHIFT_ICON[data?.shift ?? "morning"];

  const hero = (
    <DoctorHero
      kickerIcon={<Building2 size={13} aria-hidden />}
      kicker={hospital?.name ?? "Hospital Portal"}
      kickerMeta={t("dashboard.command")}
      title={
        <>
          {t("dashboard.title")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            {data?.shift ? `· ${data.shift}` : ""}
          </span>
        </>
      }
      description={t("dashboard.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ShiftIcon size={12} className="text-emerald-300" />
            <span className="capitalize">{data?.shift ?? "—"} shift</span>
          </span>
          <span className={HERO_CHIP}>
            <Users size={12} className="text-sky-300" />
            {staff.length} {t("dashboard.onDuty")}
          </span>
          {occupancy ? (
            <span className={HERO_CHIP}>
              <BedDouble size={12} className="text-amber-300" />
              {Math.round(occupancy.occupancyRate)}% beds
            </span>
          ) : null}
        </>
      }
      aside={
        occupancy ? (
          <HeroPulse
            icon={<BedDouble size={18} />}
            label={t("dashboard.bedOccupancy")}
            value={`${occupancy.occupied}/${occupancy.totalBeds}`}
            sub={`${occupancy.available} ${t("dashboard.available").toLowerCase()}`}
          />
        ) : undefined
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => refetch()}
            className={HERO_GHOST}
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/reception/walk-ins" className={HERO_PRIMARY}>
            <UserPlus size={14} className="text-emerald-600" /> Register walk-in
          </Link>
        </>
      }
    />
  );

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </HeroOverlap>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <section className={PANEL}>
          <EmptyBlock
            icon={<LayoutDashboard size={19} />}
            title={t("dashboard.errorTitle")}
            body={(error as Error)?.message ?? "—"}
            actions={
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <RefreshCw size={13} /> {t("common.refresh")}
              </button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      {/* KPI strip — tiles double as links into each surface */}
      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const style = TILE_STYLE[tile.key];
          const isAvailable = tile.available !== false;
          return (
            <StatTile
              key={tile.key}
              icon={style.icon}
              tone={style.tone}
              label={tile.label}
              value={isAvailable ? tile.value.toLocaleString() : "—"}
              unit={
                isAvailable
                  ? typeof tile.total === "number"
                    ? `/ ${tile.total.toLocaleString()}`
                    : tile.unit
                  : undefined
              }
              sub={isAvailable ? style.sub : t("dashboard.comingSoon")}
              href={isAvailable ? tile.href : undefined}
              pulse={isAvailable && style.alert === true && tile.value > 0}
            />
          );
        })}
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Active admissions */}
          <section className={PANEL}>
            <PanelHeader
              icon={<BedDouble size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("dashboard.admitted")}
              caption="Open bed assignments in this facility"
              href="/hospital/ipd"
              linkLabel={t("dashboard.viewAll")}
            />
            {admissions.length === 0 ? (
              <EmptyBlock
                icon={<BedDouble size={19} />}
                title={t("dashboard.noAdmissions")}
                body="Patients admitted to a ward will appear here with their bed assignment."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {admissions.slice(0, 6).map((a) => (
                  <li
                    key={a.assignmentId}
                    className="group relative flex items-center gap-3.5 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(4,120,87,0.25)]"
                  >
                    <span
                      className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-emerald-500"
                      aria-hidden
                    />
                    <span
                      className="ml-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white"
                      aria-hidden
                    >
                      {initials(a.patientName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/hospital/ipd?patient=${a.patientId}`}
                        className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-emerald-700"
                      >
                        {a.patientName}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-400">
                        <BedDouble size={10} aria-hidden />
                        Bed {a.bedNumber} · {a.wardName}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Admitted
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {relativeTime(a.assignedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Bed occupancy breakdown */}
          {occupancy ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<LayoutDashboard size={16} />}
                tone="bg-amber-50 text-amber-600"
                title={t("dashboard.bedOccupancy")}
                caption={`${occupancy.occupied} of ${occupancy.totalBeds} beds in use`}
                href="/hospital/beds"
                linkLabel={t("dashboard.viewAll")}
              />
              <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="h-full rounded-l-full bg-emerald-500"
                  style={{
                    width: `${occupancy.totalBeds > 0 ? (occupancy.occupied / occupancy.totalBeds) * 100 : 0}%`,
                  }}
                />
                <span
                  className="h-full bg-sky-400"
                  style={{
                    width: `${occupancy.totalBeds > 0 ? (occupancy.cleaning / occupancy.totalBeds) * 100 : 0}%`,
                  }}
                />
                <span
                  className="h-full bg-amber-400"
                  style={{
                    width: `${occupancy.totalBeds > 0 ? (occupancy.maintenance / occupancy.totalBeds) * 100 : 0}%`,
                  }}
                />
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: t("dashboard.occupied"), value: occupancy.occupied, dot: "bg-emerald-500" },
                  { label: t("dashboard.available"), value: occupancy.available, dot: "bg-slate-300" },
                  { label: t("dashboard.cleaning"), value: occupancy.cleaning, dot: "bg-sky-400" },
                  { label: t("dashboard.maintenance"), value: occupancy.maintenance, dot: "bg-amber-400" },
                ].map((s) => (
                  <li
                    key={s.label}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
                      {s.label}
                    </span>
                    <span className="mt-1 block text-xl font-semibold tabular-nums text-slate-900">
                      {s.value}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          {/* Staff on shift */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Users size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("dashboard.staffOnShift")}
              caption={
                staffTotals
                  ? `${staffTotals.doctors} doctors · ${staffTotals.nurses} nurses`
                  : `${staff.length} ${t("dashboard.onDuty")}`
              }
              href="/hospital/staff"
              linkLabel={t("dashboard.viewAll")}
            />
            {staff.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
                No staff rostered on the current shift.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-1.5">
                {staff.slice(0, 6).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
                      aria-hidden
                    >
                      {initials(s.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">
                        {s.name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">
                      {s.role}
                    </span>
                  </li>
                ))}
                {staff.length > 6 ? (
                  <li className="px-2 pt-1 text-[11px] font-medium text-slate-400">
                    +{staff.length - 6} more on duty
                  </li>
                ) : null}
              </ul>
            )}
          </section>

          <QuickToolsPanel
            id="hospital-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: UserPlus,
                label: "Walk-in",
                hint: "Register",
                href: "/hospital/reception/walk-ins",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: CalendarPlus,
                label: "Appointment",
                hint: "Book OPD",
                href: "/hospital/reception/appointments",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Receipt,
                label: "Billing",
                hint: "New invoice",
                href: "/hospital/billing/new",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <PromoCard
            href="/hospital/reports"
            kicker="Reports"
            title="Facility analytics"
            body="Census, revenue and throughput reports"
            icon={<LayoutDashboard size={20} />}
          />
        </aside>
      </div>
    </div>
  );
}
