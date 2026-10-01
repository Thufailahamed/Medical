"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  RefreshCw,
  Search,
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
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PromoCard,
  QuickToolsPanel,
  RailRow,
} from "@/patient/components/workspace";

type WalkIn = {
  id: string;
  patientName?: string | null;
  patientId?: string;
  reason?: string | null;
  createdAt?: string | null;
  status?: string;
};

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

export default function ReceptionPage() {
  const t = useT();
  const locale = useAuthStore((s) => s.locale);

  const walkInsQ = useQuery({
    queryKey: ["walkIns", "today"],
    queryFn: () => api<{ walkIns: WalkIn[] }>("/walk-ins?status=waiting"),
    refetchInterval: 30_000,
  });

  const appointmentsQ = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => api<{ appointments: Appointment[] }>("/appointments?today=1"),
    refetchInterval: 60_000,
  });

  const walkIns = walkInsQ.data?.walkIns ?? [];
  const appointments = appointmentsQ.data?.appointments ?? [];

  const hero = (
    <DoctorHero
      kickerIcon={<DoorOpen size={13} aria-hidden />}
      kicker={t("nav.reception")}
      kickerMeta="Front desk"
      title={
        <>
          {t("nav.reception")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · today
          </span>
        </>
      }
      description={t("reception.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} className="text-amber-300" />
            {walkIns.length} {t("reception.waiting")}
          </span>
          <span className={HERO_CHIP}>
            <CalendarDays size={12} className="text-sky-300" />
            {appointments.length} {t("reception.todayAppointments").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<DoorOpen size={18} />}
          label={t("reception.quickWalkIn")}
          value={walkInsQ.isLoading ? "…" : walkIns.length}
          sub={walkIns.length > 0 ? "Patients in the queue" : "Queue is clear"}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              walkInsQ.refetch();
              appointmentsQ.refetch();
            }}
            className={HERO_GHOST}
          >
            <RefreshCw
              size={13}
              className={walkInsQ.isFetching || appointmentsQ.isFetching ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/reception/patients/new" className={HERO_PRIMARY}>
            <UserPlus size={14} className="text-emerald-600" /> {t("reception.registerNew")}
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
          icon={<DoorOpen size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("reception.quickWalkIn")}
          value={walkInsQ.isLoading ? "…" : String(walkIns.length)}
          sub={t("reception.queueNow")}
          href="/hospital/reception/walk-ins"
          pulse={walkIns.length > 0}
        />
        <StatTile
          icon={<CalendarDays size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("reception.todayAppointments")}
          value={appointmentsQ.isLoading ? "…" : String(appointments.length)}
          sub={t("reception.appointmentsSubtitle")}
          href="/hospital/reception/appointments"
        />
        <StatTile
          icon={<UserPlus size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("reception.newPatient")}
          value="→"
          sub={t("reception.newPatientSubtitle")}
          href="/hospital/reception/patients/new"
        />
        <StatTile
          icon={<Users size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.patients")}
          value="→"
          sub={t("reception.patientsSubtitle")}
          href="/hospital/reception/patients"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Live walk-in queue */}
          <section className={PANEL}>
            <PanelHeader
              icon={<ClipboardList size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("reception.queueNow")}
              caption={t("reception.walkInSubtitle")}
              href="/hospital/reception/walk-ins"
              linkLabel={t("reception.openQueue")}
            />
            {walkInsQ.isLoading ? (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : walkIns.length === 0 ? (
              <EmptyBlock
                icon={<DoorOpen size={19} />}
                title={t("reception.noWalkIns")}
                body="Walk-ins registered at the front desk will appear here in queue order."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {walkIns.slice(0, 8).map((w, i) => (
                  <li key={w.id}>
                    <RailRow
                      tone="amber"
                      icon={
                        <span className="text-xs font-bold tabular-nums">#{i + 1}</span>
                      }
                      title={w.patientName ?? w.patientId}
                      meta={w.reason ?? "—"}
                      trailing={
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          {formatTime(w.createdAt, locale)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Today's appointments */}
          <section className={PANEL}>
            <PanelHeader
              icon={<CalendarDays size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("reception.todayAppointments")}
              caption={t("reception.appointmentsSubtitle")}
              href="/hospital/reception/appointments"
              linkLabel={t("reception.openList")}
            />
            {appointmentsQ.isLoading ? (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <EmptyBlock
                icon={<CalendarDays size={19} />}
                title={t("reception.noAppointments")}
                body="Booked appointments for today will appear here."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {appointments.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <RailRow
                      tone="sky"
                      icon={<CalendarDays size={16} />}
                      title={a.patientName ?? a.patientId}
                      meta={`${formatTime(a.startsAt ?? a.date, locale)} · ${a.doctorName ?? a.doctorId ?? "—"}`}
                      trailing={
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-sky-700">
                          {a.status ?? "booked"}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="reception-quick-actions"
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
              icon={<Search size={16} />}
              tone="bg-violet-50 text-violet-600"
              title={t("patients.directory")}
              caption={t("reception.patientsSubtitle")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Search by name, NIC, or MRN from the topbar — or open the full
              directory to filter by registration status.
            </p>
            <Link
              href="/hospital/reception/patients"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {t("nav.patients")} <ArrowRight size={13} />
            </Link>
          </section>

          <PromoCard
            href="/hospital/reception/patients"
            kicker={t("nav.patients")}
            title={t("patients.directory")}
            body={t("patients.directorySubtitle")}
            icon={<Users size={20} />}
          />
        </aside>
      </div>
    </div>
  );
}
