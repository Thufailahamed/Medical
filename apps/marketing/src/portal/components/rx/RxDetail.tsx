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
import { formatDate, formatDateTime } from "@/portal/lib/format";
import { useT } from "@/portal/i18n";
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="dashboard-card">
          <CardHeader
            title={t("prescription.patient")}
            icon={<UserRound size={15} className="text-brand" />}
          />
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={rx.patient?.name ?? ""} size="lg" />
            <div className="flex-1 min-w-0 space-y-2">
              <DetailRow label={t("common.name")} value={rx.patient?.name} />
              {rx.patient?.nic ? (
                <DetailRow label={t("chart.nic")} value={rx.patient.nic} />
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="dashboard-card">
          <CardHeader
            title={t("prescription.doctor")}
            icon={<Stethoscope size={15} className="text-brand" />}
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <DetailRow label={t("common.name")} value={rx.doctorName} />
            <DetailRow
              label={t("settings.specialty")}
              value={rx.doctorSpecialization}
            />
            {rx.doctorSlmcNo ? (
              <DetailRow label={t("settings.slmc")} value={rx.doctorSlmcNo} />
            ) : null}
            {isSigned && rx.signedAt ? (
              <DetailRow
                label={t("rx.detail.signedBy")}
                value={`${rx.doctorName} · ${formatDateTime(rx.signedAt)}`}
                className="sm:col-span-2"
              />
            ) : null}
          </div>
          {isSigned && rx.signedPayloadHash ? (
            <div className="mt-3 portal-detail-row">
              <div className="portal-detail-row-label flex items-center gap-1">
                <Hash size={10} />
                {t("prescription.payloadHash")}
              </div>
              <div className="portal-detail-row-value font-mono text-[11px] leading-relaxed">
                {rx.signedPayloadHash}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Diagnosis */}
      {rx.diagnosis ? (
        <Card className="dashboard-card">
          <CardHeader
            title={t("prescription.diagnosis")}
            icon={<FileText size={15} className="text-brand" />}
          />
          <p className="mt-3 text-sm text-text leading-relaxed">{rx.diagnosis}</p>
        </Card>
      ) : null}

      <RxMedicineList
        medicines={rx.medicines}
        title={t("prescription.medicines")}
        emptyTitle={t("chart.medsEmpty")}
      />

      {rx.notes ? (
        <Card className="dashboard-card">
          <CardHeader title={t("common.notes")} />
          <p className="mt-3 text-sm text-text whitespace-pre-wrap leading-relaxed">
            {rx.notes}
          </p>
        </Card>
      ) : null}

      {/* Audit trail */}
      <Card padding={false} className="dashboard-card overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setAuditOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAuditOpen((v) => !v);
            }
          }}
          className="w-full px-5 py-4 flex items-center gap-2.5 text-left hover:bg-surface-2/40 transition-colors cursor-pointer"
        >
          <div className="h-8 w-8 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
            <ClipboardList size={14} className="text-brand" />
          </div>
          <span className="text-sm font-bold text-text">
            {t("rx.detail.auditTrail")}
          </span>
          {auditLogs.length ? (
            <PillBadge tone="neutral">{auditLogs.length}</PillBadge>
          ) : null}
          <span className="ml-auto text-text-muted">
            {auditOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
        {auditOpen ? (
          <ul className="border-t border-border/60 flex flex-col">
            {auditLogs.length === 0 ? (
              <li className="px-5 py-4 text-xs text-text-muted">No events</li>
            ) : (
              auditLogs.map((a) => (
                <li
                  key={a.id}
                  className="px-5 py-3 border-b border-border/40 last:border-b-0 flex items-start gap-3 hover:bg-surface-2/30 transition-colors"
                >
                  <Activity
                    size={13}
                    className="text-brand mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-text">
                      {auditActionLabel(t, a.action)}
                    </div>
                    <RxAuditDetails action={a.action} details={a.details} t={t} />
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
                    {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </Card>

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
    <div className={cn("portal-detail-row", className)}>
      <div className="portal-detail-row-label">{label}</div>
      <div className="portal-detail-row-value">{value || "—"}</div>
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
