"use client";

/**
 * /portal/pharmacy/[id] — pharmacy prescription detail view.
 *
 * Mirrors the doctor `<RxDetail>` layout, but:
 *   - Pulls the row from `/pharmacy/prescriptions/:id` (tenant-scoped,
 *     no ownership check).
 *   - Renders pharmacy-side actions: Dispense (primary) + Reject
 *     (danger) for `signed`; read-only banner for dispensed/cancelled.
 *   - Skips the "open patient chart" affordance (pharmacy doesn't
 *     have chart access) and the "Edit" / "Sign" / "Verify" buttons
 *     that are doctor-specific.
 *
 * The dispense / reject mutations live in
 * `apps/marketing/src/portal/hooks/usePrescription.ts` and POST to
 * `/pharmacy/prescriptions/:id/{dispense,reject}`. The reject flow
 * reuses the same modal/textarea UX from `<RxActions>` via the
 * `mode="pharmacy"` prop.
 */

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Ban,
  ShieldCheck,
  Pill,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";

import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { rxStatusToTone } from "@/portal/lib/clinicalTones";
import { formatDate, formatDateTime } from "@/portal/lib/format";
import {
  usePharmacyPrescription,
} from "@/portal/hooks/usePharmacyPrescriptions";
import {
  usePrescriptionAudit,
  usePharmacyDispense,
  usePharmacyReject,
} from "@/portal/hooks/usePrescription";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/portal/lib/api";

const BACK_HREF = "/portal/pharmacy";

export default function PharmacyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();

  const { data, isLoading, error } = usePharmacyPrescription(id);
  const rx = data?.prescription;

  // Audit trail — re-fetch via the shared /audit endpoint. Works
  // across all roles because audit is global (filtered by resource +
  // resourceId).
  const { data: auditData } = useQuery({
    queryKey: ["prescription", id, "audit"],
    queryFn: () =>
      api<{ auditLogs: any[] }>(`/audit?resource=prescription&resourceId=${id}`),
    enabled: !!id,
  });

  const dispenseMutation = usePharmacyDispense();
  const rejectMutation = usePharmacyReject();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);

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

  const isSigned = rx.status === "signed";
  const isCancelled = rx.status === "cancelled";
  const isDispensed = rx.status === "dispensed";

  async function handleDispense() {
    try {
      await dispenseMutation.mutateAsync({ id: rx!.id });
      toast.success(t("pharmacy.detail.dispenseSuccess"), `#${rx!.id.slice(0, 8)}`);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Dispense failed");
    }
  }

  async function handleReject() {
    try {
      await rejectMutation.mutateAsync({ id: rx!.id, reason: rejectReason });
      toast.success(t("pharmacy.detail.rejectSuccess"), `#${rx!.id.slice(0, 8)}`);
      setRejectOpen(false);
      setRejectReason("");
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message ?? "Reject failed");
    }
  }

  const auditLogs = auditData?.auditLogs ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={BACK_HREF}
          className="p-2 rounded-md hover:bg-surface-2 text-text-soft"
          aria-label={t("pharmacy.detail.backToList")}
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
          {isSigned ? (
            <>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<CheckCircle2 size={14} />}
                loading={dispenseMutation.isPending}
                onClick={handleDispense}
              >
                {t("pharmacy.actions.dispense")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Ban size={14} />}
                onClick={() => setRejectOpen(true)}
              >
                {t("pharmacy.actions.reject")}
              </Button>
              <Link href={`/portal/verify/${rx.id}`}>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<ShieldCheck size={14} />}
                >
                  {t("rx.actions.verify")}
                </Button>
              </Link>
              <p className="text-xs text-text-muted ml-2">
                {t("pharmacy.actions.dispenseHint")}
              </p>
            </>
          ) : null}
          {isCancelled || isDispensed ? (
            <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-success" />
              {isCancelled
                ? t("rx.detail.cancelledNote")
                : t("rx.detail.dispensedNote")}
              {isCancelled && rx.cancellationReason ? (
                <span className="text-text-muted">
                  · {rx.cancellationReason}
                </span>
              ) : null}
            </span>
          ) : null}
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
            {isDispensed && rx.dispensedAt ? (
              <DetailRow
                label={t("pharmacy.detail.dispenseSuccess")}
                value={formatDateTime(rx.dispensedAt)}
              />
            ) : null}
            {isCancelled && rx.cancelledAt ? (
              <DetailRow
                label={t("pharmacy.detail.rejectSuccess")}
                value={`${formatDateTime(rx.cancelledAt)}${
                  rx.cancellationReason ? ` · ${rx.cancellationReason}` : ""
                }`}
              />
            ) : null}
          </div>
        </Card>
      </div>

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
              {rx.medicines.length}{" "}
              {rx.medicines.length === 1 ? "med" : "meds"}
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
                  <Activity
                    size={12}
                    className="text-text-muted mt-0.5 shrink-0"
                  />
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

      {/* Reject confirm */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t("pharmacy.reject.confirmTitle")}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              leftIcon={<Ban size={14} />}
              loading={rejectMutation.isPending}
              onClick={handleReject}
              className="bg-danger text-white"
            >
              {t("pharmacy.reject.confirm")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-soft">
          {t("pharmacy.reject.confirmBody")}
        </p>
        <div className="mt-3">
          <label className="block text-[11px] text-text-soft mb-1">
            {t("pharmacy.reject.reason")}
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text"
            placeholder="e.g. Out of stock, dosage not available"
          />
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-xs text-text-soft">{label}</div>
      <div className="text-sm text-text">{value || "—"}</div>
    </div>
  );
}
