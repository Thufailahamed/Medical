"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatDate } from "@/hospital/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type FilterKey = "all" | "admitted" | "registered" | "discharged";

const FILTERS: { key: FilterKey; queryKey: string | null }[] = [
  { key: "all", queryKey: null },
  { key: "admitted", queryKey: "true" },
  { key: "registered", queryKey: "registered" },
  { key: "discharged", queryKey: "discharged" },
];

type PatientRow = {
  id: string;
  name?: string | null;
  mrn?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string;
  currentlyAdmitted?: boolean;
  registeredAt?: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  registered: TONE_BADGE.sky,
  discharged: TONE_BADGE.slate,
  deceased: TONE_BADGE.rose,
};

function patientInitials(name?: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export default function PatientsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const search = useQuery({
    queryKey: ["hospital-portal", "patients", { q, filter: activeFilter.queryKey }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (activeFilter.queryKey) {
        if (activeFilter.queryKey === "true") {
          params.set("admitted", "true");
        } else {
          params.set("status", activeFilter.queryKey);
        }
      }
      const qs = params.toString();
      return api<{ patients: PatientRow[] }>(`/hospital-portal/patients${qs ? `?${qs}` : ""}`);
    },
  });

  // Unfiltered snapshot so the filter tiles can show real counts.
  const countsQuery = useQuery({
    queryKey: ["hospital-portal", "patients", "counts"],
    queryFn: () => api<{ patients: PatientRow[] }>("/hospital-portal/patients"),
    staleTime: 60_000,
  });

  const patients = search.data?.patients ?? [];

  const counts = useMemo(() => {
    const all = countsQuery.data?.patients ?? [];
    return {
      all: all.length,
      admitted: all.filter((p) => p.currentlyAdmitted).length,
      registered: all.filter((p) => p.status === "registered").length,
      discharged: all.filter((p) => p.status === "discharged").length,
    };
  }, [countsQuery.data]);

  const filterLabels: Record<FilterKey, string> = {
    all: t("patients.filterAll"),
    admitted: t("patients.filterAdmitted"),
    registered: t("patients.filterRegistered"),
    discharged: t("patients.filterDischarged"),
  };

  const hero = (
    <DoctorHero
      kickerIcon={<Users size={13} aria-hidden />}
      kicker={t("nav.reception")}
      kickerMeta={t("patients.directory")}
      title={
        <>
          {t("nav.patients")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · directory
          </span>
        </>
      }
      description={t("reception.patientsSubtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Users size={12} className="text-sky-300" />
            {counts.all} {t("nav.patients").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <BedDouble size={12} className="text-amber-300" />
            {counts.admitted} {t("patients.admitted").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Users size={18} />}
          label={t("patients.directory")}
          value={countsQuery.isLoading ? "…" : counts.all}
          sub={`${counts.admitted} ${t("patients.admitted").toLowerCase()}`}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              search.refetch();
              countsQuery.refetch();
            }}
            className={HERO_GHOST}
          >
            <RefreshCw
              size={13}
              className={search.isFetching || countsQuery.isFetching ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/reception/patients/new" className={HERO_PRIMARY}>
            <UserPlus size={14} className="text-emerald-600" /> {t("reception.newPatient")}
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
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("patients.filterAll")}
          value={countsQuery.isLoading ? "…" : String(counts.all)}
          sub={t("patients.directory")}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("patients.filterAdmitted")}
          value={countsQuery.isLoading ? "…" : String(counts.admitted)}
          sub={t("ipd.subtitle")}
          active={filter === "admitted"}
          onClick={() => setFilter("admitted")}
          pulse={counts.admitted > 0}
        />
        <StatTile
          icon={<ClipboardCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("patients.filterRegistered")}
          value={countsQuery.isLoading ? "…" : String(counts.registered)}
          sub={t("patients.registered")}
          active={filter === "registered"}
          onClick={() => setFilter("registered")}
        />
        <StatTile
          icon={<UserCheck size={16} />}
          tone="bg-slate-100 text-slate-500"
          label={t("patients.filterDischarged")}
          value={countsQuery.isLoading ? "…" : String(counts.discharged)}
          sub={t("patients.discharged")}
          active={filter === "discharged"}
          onClick={() => setFilter("discharged")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("patients.directory")}
            caption={
              search.isLoading
                ? t("common.loading")
                : t("patients.patientCount", { count: patients.length })
            }
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented<FilterKey>
              ariaLabel="Filter patients"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f.key,
                label: filterLabels[f.key],
                count: counts[f.key],
              }))}
            />
            <PanelSearch
              value={q}
              onChange={setQ}
              placeholder={t("common.search")}
              className="sm:max-w-xs"
            />
          </div>

          {search.isLoading ? (
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : !patients.length ? (
            <EmptyBlock
              icon={<Users size={19} />}
              title={t("patients.noPatients")}
              body={t("patients.directorySubtitle")}
              actions={
                <Link
                  href="/hospital/reception/patients/new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <UserPlus size={13} /> {t("reception.newPatient")}
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {patients.map((p) => (
                <li key={p.id}>
                  <RailRow
                    tone={p.currentlyAdmitted ? "amber" : p.status === "discharged" ? "slate" : "sky"}
                    icon={
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[11px] font-bold text-white">
                        {patientInitials(p.name)}
                      </span>
                    }
                    title={
                      <Link
                        href={`/hospital/reception/patients/${p.id}`}
                        className="hover:text-sky-700"
                      >
                        {p.name ?? "—"}
                      </Link>
                    }
                    meta={
                      <>
                        <span className="font-mono text-[11px]">{p.mrn ?? t("patients.actions.noMrn")}</span>
                        {p.phone ? ` · ${p.phone}` : ""}
                        {p.registeredAt ? ` · ${formatDate(p.registeredAt, locale)}` : ""}
                      </>
                    }
                    trailing={
                      <>
                        {p.currentlyAdmitted ? (
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE_BADGE.amber)}>
                            {t("patients.admitted")}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                            STATUS_BADGE[p.status ?? ""] ?? TONE_BADGE.slate,
                          )}
                        >
                          {p.status === "registered"
                            ? t("patients.registered")
                            : p.status === "discharged"
                              ? t("patients.discharged")
                              : p.status}
                        </span>
                        <Link
                          href={`/hospital/reception/patients/${p.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                        >
                          {t("patients.actions.view")}
                          <ArrowRight size={13} aria-hidden />
                        </Link>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="patients-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: UserPlus,
                label: t("reception.newPatient"),
                hint: "Registration",
                href: "/hospital/reception/patients/new",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: DoorOpen,
                label: t("nav.walkIns"),
                hint: "Queue",
                href: "/hospital/reception/walk-ins",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                icon: CalendarDays,
                label: t("nav.appointments"),
                hint: "Schedule",
                href: "/hospital/reception/appointments",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<BedDouble size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("nav.ipd")}
              caption={t("ipd.subtitle")}
              href="/hospital/ipd"
              linkLabel={t("dashboard.viewAll")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {counts.admitted} {t("patients.filterAdmitted").toLowerCase()} — open
              the IPD board for ward assignments and discharges.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
