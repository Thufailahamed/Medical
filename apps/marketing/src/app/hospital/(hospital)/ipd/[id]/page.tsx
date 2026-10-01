"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  BedDouble,
  ClipboardPlus,
  FileText,
  Heart,
  Hospital,
  LogOut,
  StickyNote,
  User,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatDate } from "@/hospital/lib/format";
import { cn } from "@/portal/lib/utils";
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
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  HERO_DANGER_CHIP,
  HeroPulse,
  HeroTile,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";

type HandoffType = "none" | "hospital" | "clinic";

const EMPTY_DISCHARGE_FORM = {
  dischargeDiagnosis: "",
  dischargeInstructions: "",
  followUpDate: "",
  handoffType: "none" as HandoffType,
  handoffHospitalId: "",
  handoffClinicId: "",
  handoffFollowUpPlan: "",
};

type Admission = {
  id: string;
  status?: string;
  reason?: string | null;
  wardName?: string | null;
  bedNumber?: string | null;
  admittedAt?: string | null;
  dischargedAt?: string | null;
  diagnosisAtAdmission?: string | null;
  admissionType?: string | null;
};

type AdmissionNote = {
  id: string;
  kind?: string;
  body?: string;
  recordedAt?: string | null;
};

type AdmissionDetail = {
  admission: Admission;
  patient: { id?: string; name?: string | null } | null;
  notes: AdmissionNote[];
};

type Facility = { id: string; name: string; address?: string | null };

const NOTE_BADGE: Record<string, string> = {
  progress: TONE_BADGE.sky,
  vitals: TONE_BADGE.emerald,
  medication: TONE_BADGE.violet,
  other: TONE_BADGE.slate,
};

function initials(name?: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export default function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const { id } = use(params);
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const activeHospitalId = useAuthStore((s) => s.activeHospitalId);

  const admission = useQuery({
    queryKey: ["admission", id],
    queryFn: () => api<AdmissionDetail>(`/hospital-portal/admissions/${id}`),
  });

  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeForm, setDischargeForm] = useState(EMPTY_DISCHARGE_FORM);
  const [noteForm, setNoteForm] = useState({ kind: "progress", body: "" });
  const [transferForm, setTransferForm] = useState({ wardId: "", bedId: "" });

  const hospitalsQ = useQuery({
    queryKey: ["hospitals", "handoff"],
    queryFn: () => api<{ hospitals: Facility[] }>("/hospitals"),
    enabled: dischargeOpen && dischargeForm.handoffType === "hospital",
  });
  const clinicsQ = useQuery({
    queryKey: ["clinics", "handoff-directory"],
    queryFn: () => api<{ clinics: Facility[] }>("/clinics?directory=1"),
    enabled: dischargeOpen && dischargeForm.handoffType === "clinic",
  });

  const closeDischargeModal = () => {
    setDischargeOpen(false);
    setDischargeForm(EMPTY_DISCHARGE_FORM);
  };

  const buildDischargePayload = () => {
    const body: Record<string, unknown> = {
      dischargeDiagnosis: dischargeForm.dischargeDiagnosis || undefined,
      dischargeInstructions: dischargeForm.dischargeInstructions || undefined,
      followUpDate: dischargeForm.followUpDate || undefined,
    };

    if (dischargeForm.handoffType === "hospital" && dischargeForm.handoffHospitalId) {
      body.handoffTo = {
        hospitalId: dischargeForm.handoffHospitalId,
        followUpPlan: dischargeForm.handoffFollowUpPlan.trim() || undefined,
      };
    } else if (dischargeForm.handoffType === "clinic" && dischargeForm.handoffClinicId) {
      body.handoffTo = {
        clinicId: dischargeForm.handoffClinicId,
        followUpPlan: dischargeForm.handoffFollowUpPlan.trim() || undefined,
      };
    }

    return body;
  };

  const discharge = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ ok: boolean; handoffId?: string | null; shareRequestId?: string | null }>(
        `/hospital-portal/admissions/${id}/discharge`,
        { method: "POST", json: body }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      closeDischargeModal();
      if (data?.handoffId) {
        toast.success("Patient discharged and handoff sent");
      } else {
        toast.success("Patient discharged");
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const addNote = useMutation({
    mutationFn: (body: { kind: string; body: string }) =>
      api(`/hospital-portal/admissions/${id}/notes`, { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      setNoteOpen(false);
      setNoteForm({ kind: "progress", body: "" });
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const transfer = useMutation({
    mutationFn: (body: { wardId: string | null; bedId: string | null }) =>
      api(`/hospital-portal/admissions/${id}/transfer`, { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission", id] });
      setTransferOpen(false);
      toast.success("Transferred");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const a = admission.data?.admission;
  const patient = admission.data?.patient;
  const notes = admission.data?.notes ?? [];
  const isAdmitted = a?.status === "admitted";

  const hero = (
    <DoctorHero
      kickerIcon={<BedDouble size={13} aria-hidden />}
      kicker={t("nav.ipd")}
      kickerMeta={t("ipd.admission")}
      leading={
        <HeroTile tone="from-amber-400 to-orange-600">
          <span className="text-2xl font-bold">{initials(patient?.name)}</span>
        </HeroTile>
      }
      title={
        <>
          {patient?.name ?? t("ipd.admission")}{" "}
          {a?.status ? (
            <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
              · {a.status}
            </span>
          ) : null}
        </>
      }
      description={a?.reason ?? t("ipd.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Hospital size={12} className="text-sky-300" />
            {a?.wardName ?? "—"}
            {a?.bedNumber ? ` / ${t("ipd.bed")} ${a.bedNumber}` : ""}
          </span>
          <span className={HERO_CHIP}>
            <ClipboardPlus size={12} className="text-emerald-300" />
            {t("common.from")}: {a?.admittedAt ? formatDate(a.admittedAt, locale) : "—"}
          </span>
          {a?.status && a.status !== "admitted" ? (
            <span className={HERO_DANGER_CHIP}>
              <LogOut size={12} />
              {a.status}
            </span>
          ) : null}
        </>
      }
      aside={
        a ? (
          <HeroPulse
            icon={<StickyNote size={18} />}
            label={t("ipd.notes")}
            value={notes.length}
            sub={isAdmitted ? "Active admission" : t("ipd.status.discharged")}
          />
        ) : undefined
      }
      actions={
        <>
          <Link href="/hospital/ipd" className={HERO_GHOST}>
            <ArrowLeft size={13} /> {t("common.back")}
          </Link>
          {isAdmitted ? (
            <>
              <button type="button" onClick={() => setNoteOpen(true)} className={HERO_GHOST}>
                <StickyNote size={13} /> {t("ipd.addNote")}
              </button>
              <button type="button" onClick={() => setTransferOpen(true)} className={HERO_GHOST}>
                <ArrowRightLeft size={13} /> {t("ipd.transfer")}
              </button>
              <button type="button" onClick={() => setDischargeOpen(true)} className={HERO_PRIMARY}>
                <LogOut size={14} className="text-emerald-600" /> {t("ipd.discharge")}
              </button>
            </>
          ) : null}
        </>
      }
    />
  );

  if (admission.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        {hero}
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </HeroOverlap>
      </div>
    );
  }

  if (admission.isError || !a) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
        {hero}
        <section className={PANEL}>
          <EmptyBlock
            icon={<BedDouble size={19} />}
            title={t("errors.notFound")}
            body="This admission could not be loaded — it may have been discharged or belongs to another facility."
            actions={
              <Link
                href="/hospital/ipd"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <ArrowLeft size={13} /> {t("common.back")}
              </Link>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Heart size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("common.status")}
          value={a.status ?? "—"}
          sub={`${t("common.from")} ${a.admittedAt ? formatDate(a.admittedAt, locale) : "—"}`}
          pulse={isAdmitted}
        />
        <StatTile
          icon={<Hospital size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("ipd.ward")}
          value={a.wardName ?? "—"}
          sub={`${t("ipd.bed")} ${a.bedNumber ?? "—"}`}
          href="/hospital/wards"
        />
        <StatTile
          icon={<StickyNote size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("ipd.notes")}
          value={String(notes.length)}
          sub={notes.length ? "Clinical notes on this stay" : t("ipd.noNotes")}
        />
        <StatTile
          icon={<User size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.patients")}
          value="→"
          sub={t("patients.directory")}
          href={patient?.id ? `/hospital/reception/patients/${patient.id}` : "/hospital/reception/patients"}
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {/* Admission summary */}
          <section className={PANEL}>
            <PanelHeader
              icon={<BedDouble size={16} />}
              tone="bg-amber-50 text-amber-600"
              title={t("ipd.admission")}
              caption={a.reason ?? t("ipd.subtitle")}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DetailField label={t("common.status")} value={a.status} />
              <DetailField label={t("ipd.ward")} value={a.wardName} />
              <DetailField label={t("ipd.bed")} value={a.bedNumber} />
              <DetailField label={t("ipd.admission")} value={a.admissionType} />
              <DetailField
                label={t("common.from")}
                value={a.admittedAt ? formatDate(a.admittedAt, locale) : null}
              />
              <DetailField
                label={t("ipd.discharged")}
                value={a.dischargedAt ? formatDate(a.dischargedAt, locale) : null}
              />
              <DetailField
                label={t("ipd.diagnosis")}
                value={a.diagnosisAtAdmission}
                span2
              />
            </div>
          </section>

          {/* Notes timeline */}
          <section className={PANEL}>
            <PanelHeader
              icon={<StickyNote size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={t("ipd.notes")}
              caption={`${notes.length} ${t("common.notes").toLowerCase()}`}
              action={
                isAdmitted ? (
                  <button
                    type="button"
                    onClick={() => setNoteOpen(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-50"
                  >
                    <StickyNote size={13} /> {t("ipd.addNote")}
                  </button>
                ) : null
              }
            />
            {notes.length === 0 ? (
              <EmptyBlock
                icon={<FileText size={19} />}
                title={t("ipd.noNotes")}
                body="Progress, vitals and medication notes recorded during this stay will appear here."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <RailRow
                      tone={n.kind === "vitals" ? "emerald" : n.kind === "medication" ? "violet" : "sky"}
                      icon={<StickyNote size={16} />}
                      title={
                        <span
                          className={cn(
                            "mr-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                            NOTE_BADGE[n.kind ?? ""] ?? TONE_BADGE.slate,
                          )}
                        >
                          {n.kind ?? "note"}
                        </span>
                      }
                      meta={n.recordedAt ? formatDate(n.recordedAt, locale) : undefined}
                    >
                      <span className="mt-1.5 block whitespace-pre-wrap text-[13px] font-normal text-slate-600">
                        {n.body}
                      </span>
                    </RailRow>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<User size={16} />}
              tone="bg-violet-50 text-violet-600"
              title={t("nav.patients")}
              caption={patient?.name ?? t("patients.directory")}
              href={patient?.id ? `/hospital/reception/patients/${patient.id}` : "/hospital/reception/patients"}
              linkLabel={t("patients.actions.view")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Open the patient 360 view for full history — admissions, records,
              prescriptions, labs and vitals across facilities.
            </p>
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<Hospital size={16} />}
              tone="bg-sky-50 text-sky-600"
              title={t("nav.wards")}
              caption="Move to another ward or free the bed"
              href="/hospital/wards"
              linkLabel={t("dashboard.viewAll")}
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Use Transfer to move this admission to a different ward or bed —
              capacity is visible on the beds board.
            </p>
          </section>
        </aside>
      </div>

      {/* Discharge modal */}
      <Modal
        open={dischargeOpen}
        onClose={closeDischargeModal}
        title={t("ipd.discharge")}
        size="md"
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              dischargeForm.handoffType === "hospital" &&
              !dischargeForm.handoffHospitalId
            ) {
              toast.error("Select a receiving hospital");
              return;
            }
            if (
              dischargeForm.handoffType === "clinic" &&
              !dischargeForm.handoffClinicId
            ) {
              toast.error("Select a receiving clinic");
              return;
            }
            discharge.mutate(buildDischargePayload());
          }}
        >
          <FormField label={t("ipd.dischargeDiagnosis")}>
            <textarea
              rows={2}
              className={FIELD_TEXTAREA}
              value={dischargeForm.dischargeDiagnosis}
              onChange={(e) =>
                setDischargeForm({ ...dischargeForm, dischargeDiagnosis: e.target.value })
              }
            />
          </FormField>
          <FormField label={t("ipd.instructions")}>
            <textarea
              rows={3}
              className={FIELD_TEXTAREA}
              value={dischargeForm.dischargeInstructions}
              onChange={(e) =>
                setDischargeForm({
                  ...dischargeForm,
                  dischargeInstructions: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t("ipd.followUpDate")}>
            <input
              type="date"
              className={FIELD_INPUT}
              value={dischargeForm.followUpDate}
              onChange={(e) =>
                setDischargeForm({ ...dischargeForm, followUpDate: e.target.value })
              }
            />
          </FormField>

          <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("ipd.handoffSection")}</p>
              <p className="mt-1 text-xs text-slate-400">
                {dischargeForm.handoffType === "hospital"
                  ? t("ipd.handoffHint")
                  : dischargeForm.handoffType === "clinic"
                  ? t("ipd.handoffClinicHint")
                  : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["none", t("ipd.handoffNone")],
                  ["hospital", t("ipd.handoffHospital")],
                  ["clinic", t("ipd.handoffClinic")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDischargeForm({
                      ...dischargeForm,
                      handoffType: value,
                      handoffHospitalId: "",
                      handoffClinicId: "",
                    })
                  }
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    dischargeForm.handoffType === value
                      ? "bg-[#07233a] text-white"
                      : "bg-white text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] hover:text-slate-900"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {dischargeForm.handoffType === "hospital" ? (
              <FormField label={t("ipd.handoffTarget")}>
                <select
                  className={FIELD_INPUT}
                  value={dischargeForm.handoffHospitalId}
                  onChange={(e) =>
                    setDischargeForm({
                      ...dischargeForm,
                      handoffHospitalId: e.target.value,
                    })
                  }
                >
                  <option value="">Select hospital…</option>
                  {hospitalsQ.data?.hospitals
                    ?.filter((h) => h.id !== activeHospitalId)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              </FormField>
            ) : null}

            {dischargeForm.handoffType === "clinic" ? (
              <FormField label={t("ipd.handoffTarget")}>
                <select
                  className={FIELD_INPUT}
                  value={dischargeForm.handoffClinicId}
                  onChange={(e) =>
                    setDischargeForm({
                      ...dischargeForm,
                      handoffClinicId: e.target.value,
                    })
                  }
                >
                  <option value="">Select clinic…</option>
                  {clinicsQ.data?.clinics?.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                      {cl.address ? ` — ${cl.address}` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

            {dischargeForm.handoffType !== "none" ? (
              <FormField label={t("ipd.handoffFollowUpPlan")}>
                <textarea
                  rows={2}
                  className={FIELD_TEXTAREA}
                  placeholder={t("ipd.handoffFollowUpPlanPlaceholder")}
                  value={dischargeForm.handoffFollowUpPlan}
                  onChange={(e) =>
                    setDischargeForm({
                      ...dischargeForm,
                      handoffFollowUpPlan: e.target.value,
                    })
                  }
                />
              </FormField>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={closeDischargeModal} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={discharge.isPending} className={PRIMARY_BTN}>
              {t("ipd.confirmDischarge")}
            </button>
          </div>
        </Form>
      </Modal>

      {/* Note modal */}
      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title={t("ipd.addNote")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            addNote.mutate(noteForm);
          }}
        >
          <FormField label={t("ipd.noteKind")}>
            <select
              className={FIELD_INPUT}
              value={noteForm.kind}
              onChange={(e) => setNoteForm({ ...noteForm, kind: e.target.value })}
            >
              <option value="progress">Progress</option>
              <option value="vitals">Vitals</option>
              <option value="medication">Medication</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label={t("common.notes")} required>
            <textarea
              required
              rows={4}
              className={FIELD_TEXTAREA}
              value={noteForm.body}
              onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNoteOpen(false)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={PRIMARY_BTN}>{t("common.save")}</button>
          </div>
        </Form>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={t("ipd.transfer")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            transfer.mutate({
              wardId: transferForm.wardId || null,
              bedId: transferForm.bedId || null,
            });
          }}
        >
          <FormField label={t("ipd.ward")}>
            <input
              className={FIELD_INPUT}
              value={transferForm.wardId}
              onChange={(e) => setTransferForm({ ...transferForm, wardId: e.target.value })}
              placeholder="ward id (UUID)"
            />
          </FormField>
          <FormField label={t("ipd.bed")}>
            <input
              className={FIELD_INPUT}
              value={transferForm.bedId}
              onChange={(e) => setTransferForm({ ...transferForm, bedId: e.target.value })}
              placeholder="bed id (UUID)"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTransferOpen(false)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={PRIMARY_BTN}>{t("common.save")}</button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function DetailField({
  label,
  value,
  span2,
}: {
  label: string;
  value: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={cn("rounded-xl bg-slate-50 p-3.5", span2 && "sm:col-span-2")}>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium capitalize text-slate-900">
        {value || "—"}
      </p>
    </div>
  );
}
