"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
  rangeToFrom,
  type RangeKey,
} from "@healthcare/shared/contracts";
import type {
  SymptomRow,
  VitalAlert,
  VitalContext,
  VitalSeriesResponse,
  VitalType,
  VitalsDerived,
} from "@/patient/types/patient";

export function useVitalsSeries(type: VitalType, range: RangeKey) {
  const from = rangeToFrom(range);
  return useQuery<VitalSeriesResponse>({
    queryKey: patientKeys.vitalsSeries(type, range),
    queryFn: () =>
      api<VitalSeriesResponse>(patientPaths.vitals.series(type, from)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsAlerts(days = 7) {
  return useQuery<{ items: VitalAlert[]; count: number }>({
    queryKey: patientKeys.vitalsAlerts(days),
    queryFn: async () => {
      const res = await api<{
        alerts?: VitalAlert[];
        items?: VitalAlert[];
        count?: number;
      }>(patientPaths.vitals.alerts(days));
      const items = res.items ?? res.alerts ?? [];
      return {
        items,
        count: res.count ?? items.length,
      };
    },
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsDerived() {
  return useQuery<{ derived: VitalsDerived }>({
    queryKey: patientKeys.vitalsDerived(),
    queryFn: () =>
      api<{ derived: VitalsDerived }>(patientPaths.vitals.derived()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsSeriesRaw(type: VitalType, days: number) {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  return useQuery<VitalSeriesResponse>({
    queryKey: [...patientKeys.vitalsSeries(type, "week"), "raw", days] as const,
    queryFn: () =>
      api<VitalSeriesResponse>(patientPaths.vitals.series(type, from)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSymptoms() {
  return useQuery<{ symptoms: SymptomRow[] }>({
    queryKey: patientKeys.symptoms(),
    queryFn: () => api<{ symptoms: SymptomRow[] }>(patientPaths.vitals.symptoms()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: VitalType;
      value: number;
      secondaryValue?: number | null;
      context?: VitalContext | null;
      recordedAt?: string;
      notes?: string | null;
    }) =>
      api<{ vital: { id: string } }>(patientPaths.vitals.create(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.vitals() });
    },
  });
}

export function useDeleteVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.vitals.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.vitals() });
    },
  });
}

export function useAddSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      symptom: string;
      severity?: SymptomRow["severity"];
      startedAt?: string;
      notes?: string | null;
    }) =>
      api<{ symptom: SymptomRow }>(patientPaths.vitals.symptomCreate(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
  });
}

export function useDeleteSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.vitals.symptomDetail(id), {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
  });
}
