"use client";

/**
 * Patient-scoped vital hooks (doctor portal).
 *
 * - usePatientVitals       → vitals list + latest summary for a patient.
 * - useCreatePatientVital  → mutation for the doctor-side "Record reading" form.
 *
 * Tenant scoping flows from `tenantContextMiddleware` via the
 * `x-active-hospital-id` / `x-active-clinic-id` headers injected by
 * `@/portal/lib/api`. The new `POST /doctor-portal/vitals` route
 * enforces `canAccessPatient` server-side, so doctor-only access is
 * guaranteed even if the client somehow reaches the wrong patient.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, qk } from "@/portal/lib/api";
import {
  type RecordPatientVitalInput,
  type VitalType,
  type VitalContext,
} from "@healthcare/shared/vitals";

export interface VitalRecord {
  id: string;
  type: VitalType;
  value: number;
  secondaryValue: number | null;
  unit: string | null;
  classification: string | null;
  context: VitalContext | null;
  source: string | null;
  notes: string | null;
  recordedAt: string;
}

export interface PatientVitalsSummary {
  vitals: VitalRecord[];
  latestVitals: Array<{
    type: VitalType;
    value: number;
    secondaryValue: number | null;
    unit: string | null;
    classification: string | null;
    recordedAt: string;
  }>;
}

/** Vitals list + latest snapshot for a single patient. */
export function usePatientVitals(patientId: string | null | undefined) {
  return useQuery({
    queryKey: ["doctor-portal", "patient", patientId, "summary"],
    queryFn: () =>
      api<PatientVitalsSummary>(`/doctor-portal/patients/${patientId}/summary`),
    enabled: !!patientId,
    select: (d) => ({
      vitals: d.vitals ?? [],
      latestVitals: d.latestVitals ?? [],
    }),
    staleTime: 15_000,
  });
}

/** Record a vital on behalf of a patient (doctor → /doctor-portal/vitals). */
export function useCreatePatientVital(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<RecordPatientVitalInput, "patientId">) =>
      api<{ vital: VitalRecord }>("/doctor-portal/vitals", {
        method: "POST",
        json: { ...input, patientId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.patientSummary(patientId),
      });
      qc.invalidateQueries({
        queryKey: qk.patientOverview(patientId),
      });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "vitals"] });
    },
  });
}