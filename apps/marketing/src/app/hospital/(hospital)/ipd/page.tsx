"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BedDouble,
  ClipboardPlus,
  Hospital,
  RefreshCw,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
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
  PRIMARY_BTN,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  HeroPulse,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type StatusFilter = "" | "admitted" | "discharged" | "transferred";

type AdmissionRow = {
  id: string;
  patientName?: string | null;
  patientId?: string;
  reason?: string | null;
  wardName?: string | null;
  bedNumber?: string | null;
  status?: string;
  admittedAt?: string | null;
};

type WardOption = { id: string; name: string };

const STATUS_BADGE: Record<string, string> = {
  admitted: TONE_BADGE.amber,
  discharged: TONE_BADGE.emerald,
  transferred: TONE_BADGE.sky,
  dama: TONE_BADGE.slate,
  deceased: TONE_BADGE.rose,
};

const STATUS_RAIL: Record<string, "amber" | "emerald" | "sky" | "slate"> = {
  admitted: "amber",
  discharged: "emerald",
  transferred: "sky",
};

export default function IpdPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("admitted");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    reason: "",
    diagnosisAtAdmission: "",
    wardId: "",
    bedId: "",
  });

  const list = useQuery({
    queryKey: ["admissions", statusFilter],
    queryFn: () =>
      api<{ admissions: AdmissionRow[] }>(
        `/hospital-portal/admissions${statusFilter ? `?status=${statusFilter}` : ""}`
      ),
    refetchInterval: 30_000,
  });

  // Unfiltered snapshot so the stat tiles can show real counts.
  const countsQuery = useQuery({
    queryKey: ["admissions", "counts"],
    queryFn: () => api<{ admissions: AdmissionRow[] }>("/hospital-portal/admissions"),
    staleTime: 30_000,
  });

  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: WardOption[] }>("/hospital-portal/wards"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/hospital-portal/admissions", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      setOpen(false);
      toast.success("Patient admitted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const admissions = list.data?.admissions ?? [];

  const counts = useMemo(() => {
    const all = countsQuery.data?.admissions ?? [];
    return {
      all: all.length,
      admitted: all.filter((a) => a.status === "admitted").length,
      discharged: all.filter((a) => a.status === "discharged").length,
      transferred: all.filter((a) => a.status === "transferred").length,
    };
  }, [countsQuery.data]);

  const hero = (
    <DoctorHero
      kickerIcon={<BedDouble size={13} aria-hidden />}
      kicker={t("nav.inpatient")}
      kickerMeta={t("nav.ipd")}
      title={
        <>
          {t("nav.ipd")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · census
          </span>
        </>
      }
      description={t("ipd.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <BedDouble size={12} className="text-amber-300" />
            {counts.admitted} {t("ipd.status.admitted").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <Hospital size={12} className="text-sky-300" />
            {wards.data?.wards?.length ?? "…"} {t("nav.wards").toLowerCase()}
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<BedDouble size={18} />}
          label={t("ipd.status.admitted")}
          value={countsQuery.isLoading ? "…" : counts.admitted}
          sub={`${counts.discharged} ${t("ipd.status.discharged").toLowerCase()}`}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              list.refetch();
              countsQuery.refetch();
            }}
            className={HERO_GHOST}
          >
            <RefreshCw
              size={13}
              className={list.isFetching || countsQuery.isFetching ? "animate-spin" : ""}
            />
            {t("common.refresh")}
          </button>
          <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
            <ClipboardPlus size={14} className="text-emerald-600" /> {t("ipd.admitPatient")}
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
          icon={<Users size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("common.all")}
          value={countsQuery.isLoading ? "…" : String(counts.all)}
          sub={t("ipd.subtitle")}
          active={statusFilter === ""}
          onClick={() => setStatusFilter("")}
        />
        <StatTile
          icon={<BedDouble size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("ipd.status.admitted")}
          value={countsQuery.isLoading ? "…" : String(counts.admitted)}
          sub="Currently in a ward"
          active={statusFilter === "admitted"}
          onClick={() => setStatusFilter("admitted")}
          pulse={counts.admitted > 0}
        />
        <StatTile
          icon={<Undo2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("ipd.status.discharged")}
          value={countsQuery.isLoading ? "…" : String(counts.discharged)}
          sub="Completed stays"
          active={statusFilter === "discharged"}
          onClick={() => setStatusFilter("discharged")}
        />
        <StatTile
          icon={<ArrowRight size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("ipd.status.transferred")}
          value={countsQuery.isLoading ? "…" : String(counts.transferred)}
          sub="Moved between wards"
          active={statusFilter === "transferred"}
          onClick={() => setStatusFilter("transferred")}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<BedDouble size={16} />}
            tone="bg-amber-50 text-amber-600"
            title={t("nav.ipd")}
            caption={
              list.isLoading
                ? t("common.loading")
                : `${admissions.length} ${statusFilter ? t(`ipd.status.${statusFilter}`).toLowerCase() : t("common.all").toLowerCase()}`
            }
          />
          <div className="mt-4">
            <Segmented<StatusFilter>
              ariaLabel="Filter admissions"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: t("common.all"), count: counts.all },
                { value: "admitted", label: t("ipd.status.admitted"), count: counts.admitted },
                { value: "discharged", label: t("ipd.status.discharged"), count: counts.discharged },
                { value: "transferred", label: t("ipd.status.transferred"), count: counts.transferred },
              ]}
            />
          </div>

          {list.isLoading ? (
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : admissions.length === 0 ? (
            <EmptyBlock
              icon={<BedDouble size={19} />}
              title={t("ipd.noAdmissions")}
              body="Admissions matching this filter will appear here."
              actions={
                <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BTN}>
                  <ClipboardPlus size={13} /> {t("ipd.admitPatient")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {admissions.map((a) => (
                <li key={a.id}>
                  <RailRow
                    tone={STATUS_RAIL[a.status ?? ""] ?? "slate"}
                    active={a.status !== "discharged"}
                    icon={<BedDouble size={16} />}
                    title={a.patientName ?? a.patientId ?? "—"}
                    meta={`${a.reason ?? "—"} · ${a.wardName ?? "—"}${a.bedNumber ? ` / ${a.bedNumber}` : ""} · ${formatDate(a.admittedAt, locale)}`}
                    trailing={
                      <>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                            STATUS_BADGE[a.status ?? ""] ?? TONE_BADGE.slate,
                          )}
                        >
                          {a.status}
                        </span>
                        <Link
                          href={`/hospital/ipd/${a.id}`}
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
            id="ipd-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: Hospital,
                label: t("nav.wards"),
                hint: "Capacity",
                href: "/hospital/wards",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: BedDouble,
                label: t("nav.beds"),
                hint: "Board",
                href: "/hospital/beds",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                icon: UserPlus,
                label: t("reception.newPatient"),
                hint: "Registration",
                href: "/hospital/reception/patients/new",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<Hospital size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("nav.wards")}
              caption="Ward capacity across the facility"
              href="/hospital/wards"
              linkLabel={t("dashboard.viewAll")}
            />
            <ul className="mt-4 flex flex-col gap-1.5">
              {(wards.data?.wards ?? []).slice(0, 6).map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/hospital/wards/${w.id}`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-sky-50 text-sky-600">
                      <Hospital size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900 group-hover:text-sky-700">
                      {w.name}
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
              {(wards.data?.wards ?? []).length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
                  {t("wards.noWards")}
                </li>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("ipd.admitPatient")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              wardId: form.wardId || null,
              bedId: form.bedId || null,
            });
          }}
        >
          <FormField label={t("ipd.patientId")} required>
            <input
              required
              className={FIELD_INPUT}
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.reason")}>
            <input
              className={FIELD_INPUT}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.diagnosis")}>
            <textarea
              rows={2}
              className={FIELD_TEXTAREA}
              value={form.diagnosisAtAdmission}
              onChange={(e) => setForm({ ...form, diagnosisAtAdmission: e.target.value })}
            />
          </FormField>
          <FormField label={t("ipd.ward")}>
            <select
              className={FIELD_INPUT}
              value={form.wardId}
              onChange={(e) => setForm({ ...form, wardId: e.target.value })}
            >
              <option value="">—</option>
              {wards.data?.wards?.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={SECONDARY_BTN}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={create.isPending} className={PRIMARY_BTN}>
              {t("ipd.admit")}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
