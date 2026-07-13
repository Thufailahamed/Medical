"use client";

/**
 * RxActions — per-row action affordance for prescription list views.
 *
 * Two modes:
 *   - `mode="doctor"` (default): the doctor-side actions.
 *       draft     → "Edit", "Sign"
 *       signed    → "Download PDF", "Cancel"
 *       cancelled → (read-only — nothing rendered)
 *       dispensed → (read-only — nothing rendered)
 *
 *   - `mode="pharmacy"`: the pharmacy-side actions.
 *       draft     → (nothing — pharmacy doesn't see drafts)
 *       signed    → "Dispense", "Reject"
 *       cancelled → (read-only — nothing rendered)
 *       dispensed → (read-only — nothing rendered)
 *
 * The "Edit" / "View" path is rendered by the parent (the list row's
 * own link), not by this component — RxActions is only the mutating
 * actions, NOT the navigation. Keeps the row's link semantics clean.
 *
 * Pharmacy "Reject" reuses the same modal UX as the doctor's
 * "Cancel" — modal with a reason textarea and a danger-styled
 * confirm button. The difference is the label + endpoint.
 */

import { useState } from "react";
import {
  FileSignature,
  Download,
  XCircle,
  Pencil,
  CheckCircle2,
  Ban,
} from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import {
  useSignPrescription,
  useCancelPrescription,
  useDispensePrescription,
  usePharmacyDispense,
  usePharmacyReject,
  downloadPrescriptionPdf,
} from "@/portal/hooks/usePrescription";

interface Props {
  id: string;
  status: string;
  /** When true, the edit button is hidden (use the row's own link). */
  hideEdit?: boolean;
  /** When true, render smaller "icon-only" buttons. */
  compact?: boolean;
  /** Optional hook so the parent can navigate on edit. */
  onEdit?: (id: string) => void;
  /**
   * Doctor actions vs pharmacy actions. Defaults to `"doctor"`.
   * Pharmacy mode hides Edit/Sign/Cancel/Download-PDF and shows
   * Dispense + Reject, talking to the /pharmacy/... endpoints.
   */
  mode?: "doctor" | "pharmacy";
  /**
   * Phase QR-Code Check-in & Dispensing: when the dispense originated
   * from a scanned patient QR, the originating token is forwarded to
   * the API via the `x-via-qr-token` header so the audit chain captures
   * `prescription.dispensed_via_qr`. Omit for normal pharmacy flow.
   */
  viaQrToken?: string | null;
}

export function RxActions({
  id,
  status,
  hideEdit,
  compact,
  onEdit,
  mode = "doctor",
  viaQrToken = null,
}: Props) {
  const t = useT();
  const signMutation = useSignPrescription();
  const cancelMutation = useCancelPrescription();
  const doctorDispenseMutation = useDispensePrescription();
  const pharmacyDispenseMutation = usePharmacyDispense();
  const pharmacyRejectMutation = usePharmacyReject();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  const isDraft = status === "draft";
  const isSigned = status === "signed";
  const isPharmacy = mode === "pharmacy";

  // Pharmacy never shows draft/cancelled/dispensed actions; only
  // signed. Doctors keep the full surface.
  if (isPharmacy) {
    if (!isSigned) return null;
  } else {
    if (!isDraft && !isSigned) return null;
  }

  async function handleSign() {
    try {
      await signMutation.mutateAsync({ id });
      toast.success(t("prescription.signed"), `#${id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Sign failed");
    }
  }

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadPrescriptionPdf({ id });
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleCancel() {
    try {
      await cancelMutation.mutateAsync({ id, reason: cancelReason });
      toast.success(t("prescription.cancelled"), `#${id.slice(0, 8)}`);
      setCancelOpen(false);
      setCancelReason("");
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Cancel failed");
    }
  }

  async function handlePharmacyDispense() {
    try {
      await pharmacyDispenseMutation.mutateAsync({
        id,
        viaQrToken: viaQrToken ?? null,
      });
      toast.success(t("pharmacy.detail.dispenseSuccess"), `#${id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Dispense failed");
    }
  }

  async function handlePharmacyReject() {
    try {
      await pharmacyRejectMutation.mutateAsync({ id, reason: cancelReason });
      toast.success(t("pharmacy.detail.rejectSuccess"), `#${id.slice(0, 8)}`);
      setCancelOpen(false);
      setCancelReason("");
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Reject failed");
    }
  }

  const size = compact ? "sm" : "sm";

  // Modal copy switches on mode — pharmacy uses "reject" labels,
  // doctor uses "cancel" labels. The textarea UX is identical.
  const modalTitle = isPharmacy
    ? t("pharmacy.reject.confirmTitle")
    : t("rx.cancel.confirmTitle");
  const modalBody = isPharmacy
    ? t("pharmacy.reject.confirmBody")
    : t("rx.cancel.confirmBody");
  const modalReasonLabel = isPharmacy
    ? t("pharmacy.reject.reason")
    : t("rx.cancel.reason");
  const modalConfirmLabel = isPharmacy
    ? t("pharmacy.reject.confirm")
    : t("rx.cancel.confirm");
  const modalConfirm = isPharmacy ? handlePharmacyReject : handleCancel;
  const modalPending = isPharmacy
    ? pharmacyRejectMutation.isPending
    : cancelMutation.isPending;

  return (
    <>
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Doctor-mode actions */}
        {!isPharmacy && isDraft && !hideEdit ? (
          <Button
            size={size}
            variant="ghost"
            leftIcon={<Pencil size={12} />}
            onClick={() => onEdit?.(id)}
          >
            {t("rx.actions.edit")}
          </Button>
        ) : null}
        {!isPharmacy && isDraft ? (
          <Button
            size={size}
            variant="secondary"
            leftIcon={<FileSignature size={12} />}
            loading={signMutation.isPending}
            onClick={handleSign}
          >
            {t("rx.actions.sign")}
          </Button>
        ) : null}
        {!isPharmacy && isSigned ? (
          <Button
            size={size}
            variant="secondary"
            leftIcon={<Download size={12} />}
            loading={downloading}
            onClick={handleDownload}
          >
            {t("rx.actions.downloadPdf")}
          </Button>
        ) : null}
        {!isPharmacy && isSigned ? (
          <Button
            size={size}
            variant="ghost"
            leftIcon={<XCircle size={12} />}
            onClick={() => setCancelOpen(true)}
          >
            {t("rx.actions.cancel")}
          </Button>
        ) : null}

        {/* Pharmacy-mode actions */}
        {isPharmacy && isSigned ? (
          <Button
            size={size}
            variant="primary"
            leftIcon={<CheckCircle2 size={12} />}
            loading={pharmacyDispenseMutation.isPending}
            onClick={handlePharmacyDispense}
          >
            {t("pharmacy.actions.dispense")}
          </Button>
        ) : null}
        {isPharmacy && isSigned ? (
          <Button
            size={size}
            variant="ghost"
            leftIcon={<Ban size={12} />}
            onClick={() => setCancelOpen(true)}
          >
            {t("pharmacy.actions.reject")}
          </Button>
        ) : null}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={modalTitle}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={modalPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              leftIcon={<XCircle size={14} />}
              loading={modalPending}
              onClick={modalConfirm}
              className="bg-danger text-white"
            >
              {modalConfirmLabel}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-soft">{modalBody}</p>
        <div className="mt-3">
          <label className="block text-[11px] text-text-soft mb-1">
            {modalReasonLabel}
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text"
            placeholder={
              isPharmacy
                ? "e.g. Out of stock, dosage not available"
                : "e.g. Duplicate, dosage changed"
            }
          />
        </div>
      </Modal>
    </>
  );
}
