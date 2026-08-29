"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { LabResultRow, RecordRow, RecordStats } from "@/patient/types/patient";

export function useRecords(params: {
  type?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery<{ records: RecordRow[] }>({
    queryKey: patientKeys.records({ ...params }),
    queryFn: () =>
      api<{ records: RecordRow[] }>(patientPaths.records.mine(params)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecordStats() {
  return useQuery<RecordStats>({
    queryKey: patientKeys.recordStats(),
    queryFn: () => api<RecordStats>(patientPaths.records.stats()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecord(id: string) {
  return useQuery<RecordRow>({
    queryKey: patientKeys.record(id),
    queryFn: () => api<RecordRow>(patientPaths.records.detail(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useLabResults(params: { months?: number; test?: string } = {}) {
  return useQuery<{ items: LabResultRow[] }>({
    queryKey: patientKeys.labResults(params),
    queryFn: () =>
      api<{ items: LabResultRow[] }>(patientPaths.records.labResults(params)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
