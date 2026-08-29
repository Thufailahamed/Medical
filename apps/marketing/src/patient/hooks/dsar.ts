"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
  type DsarJob,
} from "@healthcare/shared/contracts";

export function useDsarJobs() {
  return useQuery<{ items: DsarJob[] }>({
    queryKey: patientKeys.dsarJobs(),
    queryFn: () => api<{ items: DsarJob[] }>(patientPaths.dsar.jobs()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useDsarExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ id: string; status: string; bundle?: unknown }>(
        patientPaths.dsar.export(),
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.dsarJobs() });
    },
  });
}

export function useDsarErasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) =>
      api<{ id: string; status: string; result?: unknown }>(
        patientPaths.dsar.erasure(),
        { method: "POST", json: { notes } },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.dsarJobs() });
      qc.invalidateQueries({ queryKey: patientKeys.consents() });
    },
  });
}

export function useDsarRectification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fields: Array<{
        recordId: string;
        field: string;
        proposedValue: string;
      }>;
      notes?: string;
    }) =>
      api<{ id: string; status: string }>(patientPaths.dsar.rectification(), {
        method: "POST",
        json: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.dsarJobs() });
    },
  });
}
