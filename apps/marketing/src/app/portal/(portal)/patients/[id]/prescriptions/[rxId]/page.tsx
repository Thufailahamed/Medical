"use client";

/**
 * /portal/patients/[id]/prescriptions/[rxId] — per-patient
 * prescription detail page.
 *
 * Wraps the shared `<RxDetail>` component, threading through the
 * chart-tab back link and the patient context (allergies, name)
 * so the edit-mode composer can re-show the allergy banner without
 * a second fetch.
 *
 * Previously this route 404'd — the chart tab's list rows linked
 * here assuming the page existed.
 */

import { use } from "react";
import { useQuery } from "@tanstack/react-query";

import { RxDetail } from "@/portal/components/rx/RxDetail";
import { Skeleton } from "@/portal/components/ui/Empty";
import { api } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";

interface PatientSummary {
  patient: { id: string };
  user: { name: string };
  allergies: Array<{ id: string; substance: string; severity: string }>;
}

export default function PerPatientPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string; rxId: string }>;
}) {
  const { id, rxId } = use(params);
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "summary"],
    queryFn: () => api<PatientSummary>(`/doctor-portal/patients/${id}/summary`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const patientName = data?.user?.name ?? t("common.patient");
  return (
    <RxDetail
      prescriptionId={rxId}
      backHref={`/portal/patients/${id}/prescriptions`}
      backLabel={t("rx.detail.backToChart")}
      patientContext={
        data
          ? { id, allergies: data.allergies }
          : { id, allergies: [] }
      }
    />
  );
}
