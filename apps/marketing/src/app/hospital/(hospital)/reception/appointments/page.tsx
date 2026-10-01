"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  DoorOpen,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";
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

type ApptStatus = "booked" | "completed" | "cancelled" | "no_show" | string;

const STATUS_BADGE: Record<string, string> = {
  booked: TONE_BADGE.sky,
  confirmed: TONE_BADGE.sky,
  checked_in: TONE_BADGE.amber,
  completed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.rose,
  no_show: TONE_BADGE.slate,
};

type Filter = "all" | "upcoming" | "completed";

type Appointment = {
  id: string;
  patientName?: string | null;
  patientId?: string;
  doctorName?: string | null;
  doctorId?: string;
  startsAt?: string | null;
  date?: string | null;
  status?: string;
};

export default function ReceptionAppointmentsPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments"),
    refetchInterval: 60_000,
  });

  const appointments = useMemo(
    () => query.data?.appointments ?? [],
    [query.data],
  );

  const counts = useMemo(() => {
    const completed = appointments.filter((a) => a.status === "completed").length;
    const cancelled = appointments.filter(
      (a) => a.status === "cancelled" || a.status === "no_show",
    ).length;
    return {
      total: appointments.length,
      upcoming: appointments.length - completed - cancelled,
      completed,
    };
  }, [appointments]);

  const filtered = useMemo(() => {
    let rows = appointments;
    if (filter === "upcoming") {
      rows = rows.filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show");
    } else if (filter === "completed") {
      rows = rows.filter((a) => a.status === "completed");
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((a) =>
        [a.patientName, a.doctorName, a.status]
          .some((v) => typeof v === "string" && v.toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [appointments, filter, q]);

  const hero = (
    <DoctorHero
      kickerIcon={<CalendarDays size={13} aria-hidden />}
      kicker={t("nav.reception")}
      kickerMeta={t("nav.appointments")}
      title={
        <>
          {t("nav.appointments")}{" "}
          <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
            · schedule
          </span>
        </>
      }
      description={t("reception.appointmentsSubtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Clock size={12} className="text-sky-300" />
            {counts.upcoming} upcoming
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {counts.completed} completed
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<CalendarDays size={18} />}
          label={t("nav.appointments")}
          value={query.isLoading ? "…" : counts.total}
          sub={counts.upcoming > 0 ? `${counts.upcoming} still to see` : "Schedule is clear"}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => query.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={query.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/reception/walk-ins" className={HERO_PRIMARY}>
            <DoorOpen size={14} className="text-emerald-600" /> {t("nav.walkIns")}
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
          icon={<CalendarDays size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("nav.appointments")}
          value={query.isLoading ? "…" : String(counts.total)}
          sub={t("reception.appointmentsSubtitle")}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Upcoming"
          value={query.isLoading ? "…" : String(counts.upcoming)}
          sub="Booked or checked in"
          active={filter === "upcoming"}
          onClick={() => setFilter("upcoming")}
          pulse={counts.upcoming > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Completed"
          value={query.isLoading ? "…" : String(counts.completed)}
          sub="Seen today"
          active={filter === "completed"}
          onClick={() => setFilter("completed")}
        />
        <StatTile
          icon={<ClipboardList size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.walkIns")}
          value="→"
          sub={t("reception.walkInSubtitle")}
          href="/hospital/reception/walk-ins"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<CalendarDays size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("nav.appointments")}
            caption={t("reception.appointmentsSubtitle")}
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented<Filter>
              ariaLabel="Filter appointments"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.total },
                { value: "upcoming", label: "Upcoming", count: counts.upcoming },
                { value: "completed", label: "Completed", count: counts.completed },
              ]}
            />
            <PanelSearch
              value={q}
              onChange={setQ}
              placeholder={t("common.search")}
              className="sm:max-w-xs"
            />
          </div>

          {query.isLoading ? (
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyBlock
              icon={<CalendarDays size={19} />}
              title={t("reception.noAppointments")}
              body="Scheduled appointments will appear here once booked."
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filtered.map((a) => (
                <li key={a.id}>
                  <RailRow
                    tone={a.status === "completed" ? "emerald" : a.status === "cancelled" || a.status === "no_show" ? "slate" : "sky"}
                    active={a.status !== "cancelled" && a.status !== "no_show"}
                    icon={<Clock size={16} />}
                    title={a.patientName ?? a.patientId}
                    meta={`${formatTime(a.startsAt ?? a.date, locale)} · ${a.doctorName ?? a.doctorId ?? "—"}`}
                    trailing={
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                          STATUS_BADGE[a.status as ApptStatus] ?? TONE_BADGE.slate,
                        )}
                      >
                        {(a.status ?? "booked").replace(/_/g, " ")}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="appointments-quick-actions"
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
                icon: Users,
                label: t("nav.patients"),
                hint: "Directory",
                href: "/hospital/reception/patients",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<Users size={16} />}
              tone="bg-violet-50 text-violet-600"
              title={t("patients.directory")}
              caption={t("reception.patientsSubtitle")}
              href="/hospital/reception/patients"
              linkLabel={t("dashboard.viewAll")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Look up a patient record before booking — search by name, NIC, or
              MRN from the directory.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
