"use client";

/**
 * RxDetail — the full prescription detail view, shared by
 *   - /portal/prescriptions/[id]                  (back → /portal/prescriptions)
 *   - /portal/patients/[id]/prescriptions/[rxId]  (back → patient chart tab)
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileSignature,
  Download,
  XCircle,
  CheckCircle,
  Edit3,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  UserRound,
  Stethoscope,
  Hash,
  FileText,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";
import { Modal } from "@/portal/components/ui/Modal";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import { ageFrom, formatDate, formatDateTime } from "@/portal/lib/format";
import { useT } from "@/portal/i18n";
import { usePatientHeader } from "@/portal/components/patient/PatientHeader";
import { PrescriptionComposer } from "./PrescriptionComposer";
import { RxMedicineList } from "./RxMedicineList";
import { RxAuditDetails, auditActionLabel } from "./RxAuditDetails";
import {
  usePrescription,
  usePrescriptionAudit,
  useSignPrescription,
  useCancelPrescription,
  useDispensePrescription,
  downloadPrescriptionPdf,
} from "@/portal/hooks/usePrescription";

interface Props {
  prescriptionId: string;
  backHref: string;
  backLabel: string;
  patientContext?: {
    id: string;
    allergies: Array<{ substance: string; severity: string }>;
  };
}

const STATUS_HERO: Record<string, { bg: string; border: string; color: string }> = {
  signed: {
    bg: "rgba(16,185,129,0.2)",
    border: "rgba(52,211,153,0.4)",
    color: "#6EE7B7",
  },
  draft: {
    bg: "rgba(255,255,255,0.12)",
    border: "rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.85)",
  },
  cancelled: {
    bg: "rgba(220,38,38,0.2)",
    border: "rgba(248,113,113,0.35)",
    color: "#fecaca",
  },
  dispensed: {
    bg: "rgba(56,189,248,0.2)",
    border: "rgba(125,211,252,0.35)",
    color: "#bae6fd",
  },
};

export function RxDetail({
  prescriptionId,
  backHref,
  backLabel,
  patientContext,
}: Props) {
  const t = useT();
  const { data, isLoading, error } = usePrescription(prescriptionId);
  const { data: auditData } = usePrescriptionAudit(prescriptionId);
  const signMutation = useSignPrescription();
  const cancelMutation = useCancelPrescription();
  const dispenseMutation = useDispensePrescription();
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const rx = data?.prescription;
  const { data: patientOverview } = usePatientHeader(rx?.patientId ?? "");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !rx) {
    return <Empty title={t("errors.notFound")} />;
  }

  const isDraft = rx.status === "draft";
  const isSigned = rx.status === "signed";
  const isCancelled = rx.status === "cancelled";
  const isDispensed = rx.status === "dispensed";
  const canEdit = isDraft;
  const statusStyle = STATUS_HERO[rx.status] ?? STATUS_HERO.draft;
  const auditLogs = auditData?.auditLogs ?? [];
  const patientData = patientOverview?.patient;
  const userData = patientOverview?.user;
  const allergies = patientOverview?.allergies ?? [];
  const age = patientData?.dob ? ageFrom(patientData.dob) : null;

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadPrescriptionPdf({ id: rx!.id });
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSign() {
    try {
      await signMutation.mutateAsync({ id: rx!.id });
      toast.success(t("prescription.signed"), `#${rx!.id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Sign failed");
    }
  }

  async function handleCancel() {
    try {
      await cancelMutation.mutateAsync({ id: rx!.id, reason: cancelReason });
      toast.success(t("prescription.cancelled"), `#${rx!.id.slice(0, 8)}`);
      setCancelOpen(false);
      setCancelReason("");
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Cancel failed");
    }
  }

  async function handleDispense() {
    try {
      await dispenseMutation.mutateAsync({
        id: rx!.id,
        dispenseToken: rx!.dispenseToken,
      });
      toast.success(t("rx.detail.dispensedToast"), `#${rx!.id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Dispense failed");
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Hero header — matches dashboard banner */}
      <div className="dashboard-hero relative rounded-2xl p-5 md:p-6 text-white overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Link
              href={backHref}
              aria-label={backLabel}
              className="portal-hero-action shrink-0 mt-0.5"
            >
              <ArrowLeft size={14} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/50">
                  {t("prescription.title")}
                </span>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize"
                  style={{
                    background: statusStyle.bg,
                    borderColor: statusStyle.border,
                    color: statusStyle.color,
                  }}
                >
                  {t(`rx.status.${rx.status}`)}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">
                {rx.diagnosis || t("prescription.untitled")}
              </h1>
              <p className="text-sm text-white/60 mt-1 truncate">
                #{rx.id.slice(0, 8)} · {rx.patient?.name ?? "—"} ·{" "}
                {rx.date ? formatDate(rx.date) : formatDateTime(rx.createdAt)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="portal-hero-action"
                  onClick={() => setEditing(true)}
                >
                  <Edit3 size={12} />
                  {t("rx.actions.edit")}
                </button>
                <button
                  type="button"
                  className="portal-hero-action portal-hero-action-primary"
                  disabled={signMutation.isPending}
                  onClick={handleSign}
                >
                  <FileSignature size={12} />
                  {signMutation.isPending ? t("prescription.signing") : t("rx.actions.sign")}
                </button>
                <button
                  type="button"
                  className="portal-hero-action portal-hero-action-danger"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle size={12} />
                  {t("rx.actions.discard")}
                </button>
              </>
            ) : null}

            {isSigned ? (
              <>
                <button
                  type="button"
                  className="portal-hero-action portal-hero-action-primary"
                  disabled={downloading}
                  onClick={handleDownload}
                >
                  <Download size={12} />
                  {t("rx.actions.downloadPdf")}
                </button>
                <Link
                  href={`/portal/verify/${rx.id}`}
                  className="portal-hero-action"
                >
                  <ShieldCheck size={12} />
                  {t("rx.actions.verify")}
                </Link>
                <button
                  type="button"
                  className="portal-hero-action"
                  disabled={dispenseMutation.isPending || !rx.dispenseToken}
                  title={
                    rx.dispenseToken
                      ? undefined
                      : t("pharmacy.actions.missingTokenTitle")
                  }
                  onClick={handleDispense}
                >
                  <CheckCircle size={12} />
                  {t("rx.actions.dispense")}
                </button>
                <button
                  type="button"
                  className="portal-hero-action portal-hero-action-danger"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle size={12} />
                  {t("rx.actions.cancel")}
                </button>
              </>
            ) : null}

            {(isCancelled || isDispensed) && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/70 px-2">
                <CheckCircle size={13} className="text-emerald-300" />
                {isCancelled
                  ? t("rx.detail.cancelledNote")
                  : t("rx.detail.dispensedNote")}
              </span>
            )}

            <Link
              href={`/portal/patients/${rx.patientId}`}
              className="portal-hero-action ml-auto"
            >
              <ExternalLink size={12} />
              {t("patients.openChart")}
            </Link>
          </div>

          {/* Signature strip */}
          {isSigned && rx.signedAt ? (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl text-[11px]"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span className="text-white/50 font-semibold uppercase tracking-wide">
                {t("prescription.signedAt")}
              </span>
              <span className="font-semibold text-white/90">
                {formatDateTime(rx.signedAt)}
              </span>
              {rx.signedPayloadHash ? (
                <>
                  <span className="hidden sm:inline text-white/20">·</span>
                  <span className="text-white/50 font-semibold uppercase tracking-wide">
                    {t("prescription.payloadHash")}
                  </span>
                  <span className="font-mono text-white/70 truncate max-w-[280px]">
                    {rx.signedPayloadHash.slice(0, 16)}…
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Patient + Doctor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Patient Information Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                  <UserRound size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t("prescription.patient")}
                </h3>
              </div>
              <Link
                href={`/portal/patients/${rx.patientId}`}
                className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 transition-colors"
              >
                <span>{t("patients.openChart")}</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {/* Patient Header Row */}
            <div className="mt-4 flex items-center gap-3.5">
              <Avatar
                name={userData?.name || rx.patient?.name || ""}
                size="lg"
                className="ring-2 ring-slate-100 shadow-2xs shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {userData?.name || rx.patient?.name || "Patient"}
                </h4>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {age != null && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                      {age} yrs · {patientData?.sex ?? "—"}
                    </span>
                  )}
                  {patientData?.bloodGroup && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                      🩸 {patientData.bloodGroup}
                    </span>
                  )}
                  {(patientData?.nic || rx.patient?.nic) && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                      NIC: {patientData?.nic || rx.patient?.nic}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Key Clinical Details */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <DetailRow
                label="Date of Birth"
                value={patientData?.dob ? formatDate(patientData.dob) : "—"}
              />
              <DetailRow
                label="Phone Number"
                value={userData?.phone || "—"}
              />
              <DetailRow
                label="Email Address"
                value={userData?.email || "—"}
                className="col-span-2"
              />
            </div>
          </div>

          {/* Allergy Status Strip */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            {allergies.length > 0 ? (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800">
                <AlertTriangle size={15} className="text-rose-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">Known Allergies: </span>
                  <span>
                    {allergies
                      .map((a) => `${a.substance} (${a.severity})`)
                      .join(", ")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>No known drug or environmental allergies on file</span>
              </div>
            )}
          </div>
        </div>

        {/* Doctor Information Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Stethoscope size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t("prescription.doctor")}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>SLMC Verified</span>
              </span>
            </div>

            {/* Doctor Profile */}
            <div className="mt-4 flex items-center gap-3.5">
              <Avatar
                name={rx.doctorName || "Dr. Dev"}
                size="lg"
                className="ring-2 ring-slate-100 shadow-2xs shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {rx.doctorName || "Dr. Dev"}
                </h4>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {rx.doctorSpecialization || "General Practice"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                    Reg: {rx.doctorSlmcNo || "SLMC-12345"}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DetailRow
                label={t("common.name")}
                value={rx.doctorName || "Dr. Dev"}
              />
              <DetailRow
                label={t("settings.specialty")}
                value={rx.doctorSpecialization || "General Practice"}
              />
              {isSigned && rx.signedAt ? (
                <DetailRow
                  label={t("rx.detail.signedBy")}
                  value={`${rx.doctorName} · ${formatDateTime(rx.signedAt)}`}
                  className="sm:col-span-2"
                />
              ) : null}
            </div>
          </div>

          {/* Cryptographic Hash Strip */}
          {isSigned && rx.signedPayloadHash ? (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 text-slate-500 font-medium">
                <Hash size={13} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-700">Digital Seal:</span>
                <span className="font-mono text-slate-500 truncate">
                  {rx.signedPayloadHash.slice(0, 24)}…
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase shrink-0">
                Verified
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Clinical Findings & Prescriptions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Prescribed Pharmacotherapy Ledger */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <RxMedicineList
            medicines={rx.medicines}
            title={t("prescription.medicines")}
            emptyTitle={t("chart.medsEmpty")}
          />

          {/* Clinical Instructions / Notes */}
          {rx.notes && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
                  <FileText size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Doctor's Instructions & Notes
                </h3>
              </div>
              <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                {rx.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right 1 Col: Diagnosis & Verification Context */}
        <div className="flex flex-col gap-4">
          {/* Diagnosis Card */}
          {rx.diagnosis && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 shrink-0">
                  <Activity size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t("prescription.diagnosis")}
                </h3>
              </div>
              <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100/80">
                <span className="text-[10.5px] font-bold text-sky-700 uppercase tracking-wider block mb-1">
                  Primary Clinical Indication
                </span>
                <p className="text-sm font-extrabold text-slate-900 leading-snug">
                  {rx.diagnosis}
                </p>
              </div>
            </div>
          )}

          {/* Audit Trail Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setAuditOpen((v) => !v)}
              className="w-full px-4.5 py-4 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100 shrink-0">
                  <ClipboardList size={14} />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {t("rx.detail.auditTrail")}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Immutable event ledger
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {auditLogs.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {auditLogs.length}
                  </span>
                )}
                {auditOpen ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </div>
            </button>

            {auditOpen && (
              <div className="p-4 pt-0 border-t border-slate-100">
                <div className="mt-3 flex flex-col divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 capitalize">
                          {auditActionLabel(t, log.action)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <RxAuditDetails action={log.action} details={log.details} t={t} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title={t("prescription.editTitle")}
        size="xl"
      >
        <PrescriptionComposer
          patientId={rx.patientId}
          patientAllergies={patientContext?.allergies ?? []}
          prescriptionId={rx.id}
          initialDiagnosis={rx.diagnosis ?? ""}
          initialNotes={rx.notes ?? ""}
          initialItems={rx.medicines.map((m) => ({
            id: m.id,
            name: m.name,
            masterMedicineId: m.masterMedicineId,
            dosage: m.dosage ?? "",
            frequency: m.frequency ?? "OD",
            timing: m.timing ?? "",
            durationDays: durationFromEndDate(m.startDate, m.endDate),
            instructions: m.instructions ?? "",
            ongoing: !m.endDate,
          }))}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </Drawer>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t("rx.cancel.confirmTitle")}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              leftIcon={<XCircle size={14} />}
              loading={cancelMutation.isPending}
              onClick={handleCancel}
              className="bg-danger text-white"
            >
              {t("rx.cancel.confirm")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-soft">{t("rx.cancel.confirmBody")}</p>
        <div className="mt-3">
          <label className="block text-[11px] text-text-soft mb-1">
            {t("rx.cancel.reason")}
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text"
            placeholder="e.g. Duplicate, dosage changed, patient discharged"
          />
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-0.5 min-w-0", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</span>
      <span className="text-xs font-bold text-slate-900 truncate">{value || "—"}</span>
    </div>
  );
}

function durationFromEndDate(
  start: string | null,
  end: string | null
): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / (24 * 60 * 60 * 1000)));
}
