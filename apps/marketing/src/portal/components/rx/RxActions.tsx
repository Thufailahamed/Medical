"use client";

/**
 * RxActions — per-row action affordance for prescription list views.
 *
 * Renders the right set of buttons based on the row's `status`:
 *   - draft     → "Edit", "Sign"
 *   - signed    → "Download PDF", "Cancel"
 *   - cancelled → (read-only — nothing rendered)
 *   - dispensed → (read-only — nothing rendered)
 *
 * The component is intentionally compact: it's a horizontal button
 * strip that lives on the right side of a list row. The "Cancel"
 * action opens a confirm dialog (re-uses the same shape as the
 * detail page's cancel confirm via local state).
 *
 * The "Edit" / "View" path is rendered by the parent (the list row's
 * own link), not by this component — RxActions is only the mutating
 * actions, NOT the navigation. Keeps the row's link semantics clean.
 */

import { useState } from "react";
import {
  FileSignature,
  Download,
  XCircle,
  Pencil,
} from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import {
  useSignPrescription,
  useCancelPrescription,
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
}

export function RxActions({ id, status, hideEdit, compact, onEdit }: Props) {
  const t = useT();
  const signMutation = useSignPrescription();
  const cancelMutation = useCancelPrescription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  const isDraft = status === "draft";
  const isSigned = status === "signed";

  if (!isDraft && !isSigned) return null;

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

  const size = compact ? "sm" : "sm";

  return (
    <>
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {isDraft && !hideEdit ? (
          <Button
            size={size}
            variant="ghost"
            leftIcon={<Pencil size={12} />}
            onClick={() => onEdit?.(id)}
          >
            {t("rx.actions.edit")}
          </Button>
        ) : null}
        {isDraft ? (
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
        {isSigned ? (
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
        {isSigned ? (
          <Button
            size={size}
            variant="ghost"
            leftIcon={<XCircle size={12} />}
            onClick={() => setCancelOpen(true)}
          >
            {t("rx.actions.cancel")}
          </Button>
        ) : null}
      </div>

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
            placeholder="e.g. Duplicate, dosage changed"
          />
        </div>
      </Modal>
    </>
  );
}
