"use client";

/**
 * RxDetail — the full prescription detail view, shared by
 *   - /portal/prescriptions/[id]                  (back → /portal/prescriptions)
 *   - /portal/patients/[id]/prescriptions/[rxId]  (back → patient chart tab)
 *
 * Pulls the prescription via `usePrescription`, the audit trail via
 * `usePrescriptionAudit`, and renders:
 *   - Status pill (rxStatusToTone)
 *   - Action row that adapts to status (edit/sign/discard OR
 *     download/cancel OR read-only)
 *   - Patient card (link to chart)
 *   - Doctor card (name, specialty, SLMC, signed-at, payload hash)
 *   - Medicines list (status-aware badges)
 *   - Notes
 *   - Audit trail (collapsible)
 *
 * The composer is opened in a `Drawer` for the "Edit" action; the
 * existing drawer's "Save draft" call hits PATCH /doctor/prescriptions/:id
 * because `prescriptionId` is passed in.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileSignature,
  Download,
  XCircle,
  CheckCircle,
  AlertCircle,
  Pill,
  Edit3,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Modal } from "@/portal/components/ui/Modal";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import { formatDate, formatDateTime } from "@/portal/lib/format";
import { useT } from "@/portal/i18n";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { PrescriptionComposer } from "./PrescriptionComposer";
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
  /** Where the back arrow goes. */
  backHref: string;
  /** Label for the back link, e.g. "All prescriptions" or "Patient chart". */
  backLabel: string;
  /**
   * Optional context: when opened from a patient's chart, pass the
   * patientId + allergies so the edit-mode composer can re-show the
   * allergy banner + skip the patient search step.
   */
  patientContext?: {
    id: string;
    allergies: Array<{ substance: string; severity: string }>;
  };
}

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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
      await dispenseMutation.mutateAsync(rx!.id);
      toast.success(t("rx.detail.dispensedToast"), `#${rx!.id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Dispense failed");
    }
  }

  const auditLogs = auditData?.auditLogs ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="p-2 rounded-md hover:bg-surface-2 text-text-soft"
          aria-label={backLabel}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-text truncate">
            {rx.diagnosis || t("prescription.title")}
          </h1>
          <p className="text-sm text-text-soft mt-0.5 truncate">
            #{rx.id.slice(0, 8)} · {rx.patient?.name ?? "—"} ·{" "}
            {rx.date ? formatDate(rx.date) : formatDateTime(rx.createdAt)}
          </p>
        </div>
        <PillBadge tone={rxStatusToTone(rx.status)}>{rx.status}</PillBadge>
      </div>

      {/* Actions row */}
      <Card padding={false}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-border">
          {canEdit ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Edit3 size={14} />}
                onClick={() => setEditing(true)}
              >
                {t("rx.actions.edit")}
              </Button>
              <Button
                size="sm"
                leftIcon={<FileSignature size={14} />}
                loading={signMutation.isPending}
                onClick={handleSign}
              >
                {t("rx.actions.sign")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<XCircle size={14} />}
                onClick={() => setCancelOpen(true)}
              >
                {t("rx.actions.discard")}
              </Button>
            </>
          ) : null}

          {isSigned ? (
            <>
              <Button
                size="sm"
                leftIcon={<Download size={14} />}
                loading={downloading}
                onClick={handleDownload}
              >
                {t("rx.actions.downloadPdf")}
              </Button>
              <Link href={`/portal/verify/${rx.id}`}>
                <Button size="sm" variant="secondary" leftIcon={<ShieldCheck size={14} />}>
                  {t("rx.actions.verify")}
                </Button>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<CheckCircle size={14} />}
                loading={dispenseMutation.isPending}
                onClick={handleDispense}
              >
                {t("rx.actions.dispense")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<XCircle size={14} />}
                onClick={() => setCancelOpen(true)}
              >
                {t("rx.actions.cancel")}
              </Button>
            </>
          ) : null}

          {isCancelled || isDispensed ? (
            <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
              <CheckCircle size={13} className="text-success" />
              {isCancelled
                ? t("rx.detail.cancelledNote")
                : t("rx.detail.dispensedNote")}
            </span>
          ) : null}

          <div className="ml-auto">
            <Link href={`/portal/patients/${rx.patientId}`}>
              <Button size="sm" variant="ghost">
                {t("patients.openChart")}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Patient + Doctor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t("prescription.patient")} />
          <div className="mt-3 space-y-2">
            <DetailRow label={t("common.name")} value={rx.patient?.name} />
            {rx.patient?.nic ? (
              <DetailRow label={t("chart.nic")} value={rx.patient.nic} />
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("prescription.doctor")} />
          <div className="mt-3 space-y-2">
            <DetailRow label={t("common.name")} value={rx.doctorName} />
            <DetailRow
              label={t("settings.specialty")}
              value={rx.doctorSpecialization}
            />
            {rx.doctorSlmcNo ? (
              <DetailRow
                label={t("settings.slmc")}
                value={rx.doctorSlmcNo}
              />
            ) : null}
            {isSigned && rx.signedAt ? (
              <DetailRow
                label={t("rx.detail.signedBy")}
                value={`${rx.doctorName} · ${formatDateTime(rx.signedAt)}`}
              />
            ) : null}
            {isSigned && rx.signedPayloadHash ? (
              <div>
                <div className="text-xs text-text-soft">
                  {t("prescription.payloadHash")}
                </div>
                <div className="text-xs text-text-muted font-mono break-all">
                  {rx.signedPayloadHash}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Diagnosis + Notes */}
      {rx.diagnosis ? (
        <Card>
          <CardHeader title={t("prescription.diagnosis")} />
          <p className="mt-3 text-sm text-text">{rx.diagnosis}</p>
        </Card>
      ) : null}

      {/* Medicines */}
      <Card padding={false}>
        <CardHeader
          title={t("prescription.medicines")}
          right={
            <PillBadge tone="brand">
              {rx.medicines.length} {rx.medicines.length === 1 ? "med" : "meds"}
            </PillBadge>
          }
        />
        {rx.medicines.length === 0 ? (
          <Empty title={t("chart.medsEmpty")} className="m-3" />
        ) : (
          <ul className="flex flex-col">
            {rx.medicines.map((med, idx) => {
              const ongoing = !med.endDate;
              return (
                <li
                  key={med.id}
                  className="flex items-start gap-3 px-4 py-3 border-t border-border/60 first:border-t-0"
                >
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Pill size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-text-muted">
                        #{idx + 1}
                      </span>
                      <span className="text-sm font-medium text-text">
                        {med.name}
                      </span>
                      {med.dosage ? (
                        <PillBadge tone="neutral">{med.dosage}</PillBadge>
                      ) : null}
                      {ongoing ? (
                        <PillBadge tone="info">Ongoing</PillBadge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-text-soft">
                      {med.frequency ? <span>{med.frequency}</span> : null}
                      {med.timing ? <span>· {med.timing}</span> : null}
                      {med.startDate && med.endDate ? (
                        <span>
                          · {formatDate(med.startDate)} →{" "}
                          {formatDate(med.endDate)}
                        </span>
                      ) : null}
                    </div>
                    {med.instructions ? (
                      <p className="text-xs text-text-muted mt-1">
                        {med.instructions}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {rx.notes ? (
        <Card>
          <CardHeader title={t("common.notes")} />
          <p className="mt-3 text-sm text-text whitespace-pre-wrap">
            {rx.notes}
          </p>
        </Card>
      ) : null}

      {/* Audit trail */}
      <Card padding={false}>
        <button
          type="button"
          onClick={() => setAuditOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-surface-2/40"
        >
          <ClipboardList size={14} className="text-text-soft" />
          <span className="text-sm font-medium text-text">
            {t("rx.detail.auditTrail")}
          </span>
          {auditLogs.length ? (
            <PillBadge tone="neutral">{auditLogs.length}</PillBadge>
          ) : null}
          <span className="ml-auto text-text-muted">
            {auditOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {auditOpen ? (
          <ul className="border-t border-border/60 flex flex-col">
            {auditLogs.length === 0 ? (
              <li className="px-4 py-3 text-xs text-text-muted">No events</li>
            ) : (
              auditLogs.map((a) => (
                <li
                  key={a.id}
                  className="px-4 py-2.5 border-b border-border/40 last:border-b-0 flex items-start gap-2"
                >
                  <Activity size={12} className="text-text-muted mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text">
                      {a.action}
                    </div>
                    {a.details ? (
                      <pre className="text-[10px] text-text-muted whitespace-pre-wrap break-all font-mono mt-0.5">
                        {JSON.stringify(a.details, null, 0)}
                      </pre>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </Card>

      {/* Edit drawer */}
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

      {/* Cancel confirm */}
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
        <p className="text-sm text-text-soft">
          {t("rx.cancel.confirmBody")}
        </p>
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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-text-soft">{label}</div>
      <div className="text-sm text-text">{value || "—"}</div>
    </div>
  );
}

/** Derive a duration-days number from a start/end pair. */
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
