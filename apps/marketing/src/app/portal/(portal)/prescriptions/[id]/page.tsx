"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  FileSignature,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Pill,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill as PillBadge } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate, formatDateTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface PrescriptionDetail {
  id: string;
  patientId: string;
  hospitalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  status: string;
  signedAt: string | null;
  signedPayloadHash: string | null;
  doctorName: string;
  doctorSpecialization: string;
  doctorSlmcNo: string | null;
  patient: { name: string; nic: string | null } | null;
  medicines: Array<{
    id: string;
    name: string;
    dosage: string | null;
    frequency: string | null;
    timing: string | null;
    duration: string | null;
    instructions: string | null;
  }>;
}

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["doctor", "prescriptions", id],
    queryFn: () => api<{ prescription: PrescriptionDetail }>(`/doctor/prescriptions/${id}`),
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      setSigning(true);
      await api<{ prescription: { id: string } }>(
        `/doctor/prescriptions/${id}/sign`,
        { method: "POST", json: {} }
      );
    },
    onSuccess: () => {
      toast.success(t("prescription.signed"), `#${id}`);
      qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
    onSettled: () => setSigning(false),
  });

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/doctor/prescriptions/${id}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("portal_token")}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to download PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prescription-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(t("toast.error"), err?.message);
    } finally {
      setDownloading(false);
    }
  };

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

  const isSigned = rx.status === "signed";
  const isDraft = rx.status === "draft";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/portal/prescriptions"
          className="p-2 rounded-md hover:bg-surface-2 text-text-soft"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-text">
            {t("prescription.title")} #{id.slice(0, 8)}
          </h1>
          <p className="text-sm text-text-soft mt-0.5">
            {rx.patient?.name ?? "—"} · {rx.date ? formatDate(rx.date) : formatDateTime(rx.createdAt)}
          </p>
        </div>
        <PillBadge tone={isSigned ? "success" : isDraft ? "brand" : "neutral"}>
          {rx.status}
        </PillBadge>
      </div>

      {/* Actions */}
      <Card padding={false}>
        <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
          {isDraft && (
            <Button
              size="sm"
              leftIcon={<FileSignature size={14} />}
              loading={signing}
              onClick={() => signMutation.mutate()}
            >
              {t("prescription.sign")}
            </Button>
          )}
          {isSigned && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} />}
              loading={downloading}
              onClick={downloadPdf}
            >
              {t("prescription.downloadPdf")}
            </Button>
          )}
          <Link href={`/portal/patients/${rx.patientId}`}>
            <Button size="sm" variant="ghost">
              {t("patients.openChart")}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Prescription Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={t("prescription.patient")} />
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs text-text-soft">{t("common.name")}</span>
              <p className="text-sm text-text">{rx.patient?.name ?? "—"}</p>
            </div>
            {rx.patient?.nic && (
              <div>
                <span className="text-xs text-text-soft">{t("chart.nic")}</span>
                <p className="text-sm text-text">{rx.patient.nic}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("prescription.doctor")} />
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs text-text-soft">{t("common.name")}</span>
              <p className="text-sm text-text">{rx.doctorName}</p>
            </div>
            <div>
              <span className="text-xs text-text-soft">{t("settings.specialty")}</span>
              <p className="text-sm text-text">{rx.doctorSpecialization}</p>
            </div>
            {rx.doctorSlmcNo && (
              <div>
                <span className="text-xs text-text-soft">{t("settings.slmc")}</span>
                <p className="text-sm text-text">{rx.doctorSlmcNo}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Diagnosis */}
      {rx.diagnosis && (
        <Card>
          <CardHeader title={t("prescription.diagnosis")} />
          <p className="mt-3 text-sm text-text">{rx.diagnosis}</p>
        </Card>
      )}

      {/* Medicines */}
      <Card>
        <CardHeader
          title={t("prescription.medicines")}
          right={<PillBadge tone="brand">{rx.medicines.length} meds</PillBadge>}
        />
        {rx.medicines.length === 0 ? (
          <Empty title={t("chart.medsEmpty")} className="mt-3" />
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {rx.medicines.map((med, idx) => (
              <div
                key={med.id}
                className="flex items-start gap-3 p-3 rounded-md bg-surface-2/40 border border-border"
              >
                <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Pill size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">#{idx + 1}</span>
                    <span className="text-sm text-text">{med.name}</span>
                    {med.dosage && (
                      <PillBadge tone="neutral">{med.dosage}</PillBadge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {med.frequency && (
                      <span className="text-xs text-text-soft">{med.frequency}</span>
                    )}
                    {med.timing && (
                      <span className="text-xs text-text-soft">· {med.timing}</span>
                    )}
                    {med.duration && (
                      <span className="text-xs text-text-soft">· {med.duration}</span>
                    )}
                  </div>
                  {med.instructions && (
                    <p className="text-xs text-text-muted mt-1">{med.instructions}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notes */}
      {rx.notes && (
        <Card>
          <CardHeader title={t("common.notes")} />
          <p className="mt-3 text-sm text-text whitespace-pre-wrap">{rx.notes}</p>
        </Card>
      )}

      {/* Signature Info */}
      {isSigned && rx.signedAt && (
        <Card>
          <CardHeader title={t("prescription.signature")} />
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-success" />
              <span className="text-sm text-text">{t("prescription.signedAt")}</span>
              <span className="text-sm text-text-soft">{formatDateTime(rx.signedAt)}</span>
            </div>
            {rx.signedPayloadHash && (
              <div>
                <span className="text-xs text-text-soft">{t("prescription.payloadHash")}</span>
                <p className="text-xs text-text-muted font-mono break-all">
                  {rx.signedPayloadHash}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
