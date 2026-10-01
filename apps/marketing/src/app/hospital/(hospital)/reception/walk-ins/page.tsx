"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Megaphone,
  Plus,
  RefreshCw,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { formatTime } from "@/hospital/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PRIMARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  HeroPulse,
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

type DoctorOption = {
  doctorId: string;
  name: string;
  specialization?: string;
};

export default function WalkInsPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const activeHospitalId = useAuthStore((s) => s.activeHospitalId);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["walkIns"],
    queryFn: () => api<{ walkIns: WalkIn[] }>("/walk-ins"),
  });

  const doctorsQuery = useQuery({
    queryKey: ["hospitalDoctors", activeHospitalId],
    queryFn: () =>
      activeHospitalId
        ? api<DoctorOption[]>(`/hospital-doctors?hospitalId=${activeHospitalId}`)
        : Promise.resolve([] as DoctorOption[]),
    enabled: !!activeHospitalId,
  });

  const create = useMutation({
    mutationFn: (body: { patientId: string; doctorId: string; reason: string }) =>
      api("/walk-ins", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkIns"] });
      setPatientId("");
      setDoctorId("");
      setReason("");
      toast.success("Added to queue");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const callNext = useMutation({
    mutationFn: (id: string) =>
      api(`/walk-ins/${id}/call`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["walkIns"] }),
  });

  const all = list.data?.walkIns ?? [];
  const waiting = all.filter((w) => w.status === "waiting");
  const called = all.filter((w) => w.status !== "waiting");
  const doctorCount = doctorsQuery.data?.length ?? 0;

  const hero = (
    <DoctorHero
      kickerIcon={<DoorOpen size={13} aria-hidden />}
      kicker={t("nav.reception")}
      kickerMeta={t("nav.walkIns")}
      title={
        <>
          {t("nav.walkIns")}{" "}
          <span className="bg-gradient-to-r from-amber-200 via-white to-orange-200 bg-clip-text text-transparent">
            · queue
          </span>
        </>
      }
      description={t("reception.walkInSubtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} className="text-amber-300" />
            {waiting.length} {t("reception.waiting")}
          </span>
          <span className={HERO_CHIP}>
            <Stethoscope size={12} className="text-sky-300" />
            {doctorCount} doctors
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Megaphone size={18} />}
          label={t("reception.queueNow")}
          value={list.isLoading ? "…" : waiting.length}
          sub={waiting.length > 0 ? `Next: ${waiting[0]?.patientName ?? waiting[0]?.patientId}` : "Queue is clear"}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
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
          icon={<ClipboardList size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("reception.waiting")}
          value={list.isLoading ? "…" : String(waiting.length)}
          sub={t("reception.queueNow")}
          pulse={waiting.length > 0}
        />
        <StatTile
          icon={<Megaphone size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Called / seen"
          value={list.isLoading ? "…" : String(called.length)}
          sub="Moved out of the queue"
        />
        <StatTile
          icon={<Stethoscope size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Doctors on roster"
          value={doctorsQuery.isLoading ? "…" : String(doctorCount)}
          sub="Available for walk-ins"
        />
        <StatTile
          icon={<CalendarDays size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.appointments")}
          value="→"
          sub={t("reception.appointmentsSubtitle")}
          href="/hospital/reception/appointments"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Queue */}
          <section className={PANEL}>
            <PanelHeader
              icon={<ClipboardList size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("reception.queueNow")}
              caption={
                waiting.length > 0
                  ? `${waiting.length} ${t("reception.waiting")}`
                  : t("reception.noWalkIns")
              }
            />
            {list.isLoading ? (
              <div className="mt-4 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : waiting.length === 0 ? (
              <EmptyBlock
                icon={<DoorOpen size={19} />}
                title={t("reception.noWalkIns")}
                body="Use the form to add a patient to the front-desk queue."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {waiting.map((w, i) => (
                  <li key={w.id}>
                    <RailRow
                      tone="amber"
                      icon={<span className="text-xs font-bold tabular-nums">#{i + 1}</span>}
                      title={w.patientName ?? w.patientId}
                      meta={`${w.reason ?? "—"} · ${formatTime(w.createdAt, locale)}`}
                      trailing={
                        <>
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {t("reception.waiting")}
                          </span>
                          <button
                            type="button"
                            onClick={() => callNext.mutate(w.id)}
                            disabled={callNext.isPending}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {t("reception.callNext")}
                            <ChevronRight size={13} aria-hidden />
                          </button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recently called */}
          {called.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Megaphone size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Called patients"
                caption="Already moved out of the queue"
              />
              <ul className="mt-4 flex flex-col gap-2">
                {called.slice(0, 5).map((w) => (
                  <li key={w.id}>
                    <RailRow
                      tone="slate"
                      active={false}
                      icon={<DoorOpen size={16} />}
                      title={w.patientName ?? w.patientId}
                      meta={formatTime(w.createdAt, locale)}
                      trailing={
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">
                          {w.status}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          {/* Add to queue */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Plus size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("reception.addWalkIn")}
              caption="Patient ID + doctor + reason"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!patientId || !doctorId) return;
                create.mutate({ patientId, doctorId, reason });
              }}
              className="mt-4 flex flex-col gap-3.5"
            >
              <div>
                <label htmlFor="wi-patient" className={FIELD_LABEL}>
                  {t("reception.patientIdPlaceholder")}
                </label>
                <input
                  id="wi-patient"
                  required
                  className={FIELD_INPUT}
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="wi-doctor" className={FIELD_LABEL}>
                  {t("reception.doctor")}
                </label>
                <select
                  id="wi-doctor"
                  required
                  className={FIELD_INPUT}
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                >
                  <option value="">{t("reception.selectDoctor")}</option>
                  {(doctorsQuery.data || []).map((doc) => (
                    <option key={doc.doctorId} value={doc.doctorId}>
                      {doc.name} ({doc.specialization})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wi-reason" className={FIELD_LABEL}>
                  {t("reception.reason")}
                </label>
                <input
                  id="wi-reason"
                  className={FIELD_INPUT}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <button type="submit" disabled={create.isPending} className={PRIMARY_BTN}>
                <Plus size={14} aria-hidden />
                {create.isPending ? t("common.loading") : t("common.add")}
              </button>
            </form>
          </section>

          <QuickToolsPanel
            id="walkin-quick-actions"
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
                icon: Users,
                label: t("nav.patients"),
                hint: "Directory",
                href: "/hospital/reception/patients",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
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
        </aside>
      </div>
    </div>
  );
}
