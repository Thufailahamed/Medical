"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type {
  RecordAttachment,
  RecordCreateInput,
  RecordUpdateInput,
} from "@healthcare/shared/contracts";
import type { LabResultRow, RecordRow, RecordStats } from "@/patient/types/patient";

export function useRecords(params: {
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
  tags?: string;
  archived?: "true" | "all" | "only";
  scope?: "own" | "family";
  familyMemberId?: string;
  sort?: "newest" | "oldest" | "relevance";
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

// ─── SP2a write-path additions ────────────────────────────────────────

export function useRecordAttachments(id: string) {
  return useQuery<{ files: RecordAttachment[] }>({
    queryKey: patientKeys.recordAttachments(id),
    queryFn: () =>
      api<{ files: RecordAttachment[] }>(patientPaths.records.attachments(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordLabResults(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "lab_report"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.lab(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordImagingFindings(id: string) {
  return useQuery<{ item: unknown }>({
    queryKey: patientKeys.recordChildren(id, "imaging"),
    queryFn: () =>
      api<{ item: unknown }>(patientPaths.records.children.imaging(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordDischargeEvents(id: string) {
  return useQuery<{ item: unknown }>({
    queryKey: patientKeys.recordChildren(id, "discharge_summary"),
    queryFn: () =>
      api<{ item: unknown }>(patientPaths.records.children.discharge(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordVaccinationDoses(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "vaccination"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.vaccination(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useRecordPrescriptionItems(id: string) {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.recordChildren(id, "prescription"),
    queryFn: () =>
      api<{ items: unknown[] }>(patientPaths.records.children.prescription(id)),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

export function useCreateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordCreateInput) =>
      api<{ id: string; envelopeVersion: string }>(
        patientPaths.records.create(),
        { method: "POST", json: input },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
    },
  });
}

export function useUpdateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordUpdateInput) => {
      const { id, ...rest } = input;
      return api<{ record: RecordRow }>(
        patientPaths.records.update(id),
        { method: "PATCH", json: rest },
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.id) });
    },
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.records.delete(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
    },
  });
}

export function useArchiveRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: RecordRow }>(patientPaths.records.update(id), {
        method: "PATCH",
        json: { archived: true },
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(id) });
    },
  });
}

export function useRestoreRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: RecordRow }>(patientPaths.records.update(id), {
        method: "PATCH",
        json: { archived: false },
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(id) });
    },
  });
}

export function useMoveRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; familyMemberId: string | null }) =>
      api<{ record: RecordRow }>(patientPaths.records.update(vars.id), {
        method: "PATCH",
        json: { familyMemberId: vars.familyMemberId },
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["patient", "records"] });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.id) });
    },
  });
}

export function useAddAttachment(recordId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      fd.append("recordId", recordId);
      return api<{ file: RecordAttachment }>(
        patientPaths.records.attachmentUpload(),
        { method: "POST", body: fd },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.recordAttachments(recordId) });
      qc.invalidateQueries({ queryKey: patientKeys.record(recordId) });
    },
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; recordId: string }) =>
      api<{ message: string }>(patientPaths.records.attachmentDelete(vars.id), {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: patientKeys.recordAttachments(vars.recordId) });
      qc.invalidateQueries({ queryKey: patientKeys.record(vars.recordId) });
    },
  });
}

export function usePresignAttachment() {
  return useMutation({
    mutationFn: (vars: { fileId: string }) =>
      api<{ token: string; expiresAt: string; url: string }>(
        patientPaths.records.attachmentPresign(),
        { method: "POST", json: vars },
      ),
  });
}

export function useReExtractRecord(recordId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ result: unknown }>(patientPaths.records.reExtract(recordId), {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.record(recordId) });
      qc.invalidateQueries({ queryKey: ["patient", "records", recordId] });
    },
  });
}

// ─── SP2b bulk + search ───────────────────────────────────────────────

function invalidateRecordLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["patient", "records"] });
}

export function useRecordSearch(query: string, opts?: { limit?: number }) {
  const trimmed = query.trim();
  const limit = opts?.limit ?? 50;
  return useQuery<{ records: RecordRow[]; total: number }>({
    queryKey: patientKeys.recordSearch(trimmed, limit),
    queryFn: () =>
      api<{ records: RecordRow[]; total: number }>(
        patientPaths.records.search(trimmed, limit),
      ),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useBulkDeleteRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number; denied: Array<{ id: string; reason: string }> }>(
        patientPaths.records.bulkDelete(),
        { method: "POST", json: { ids } },
      ),
    onSuccess: () => invalidateRecordLists(qc),
  });
}

export function useBulkArchiveRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ archived: number; denied: Array<{ id: string; reason: string }> }>(
        patientPaths.records.bulkArchive(),
        { method: "POST", json: { ids } },
      ),
    onSuccess: () => invalidateRecordLists(qc),
  });
}

export function useBulkRestoreRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ restored: number; denied: Array<{ id: string; reason: string }> }>(
        patientPaths.records.bulkRestore(),
        { method: "POST", json: { ids } },
      ),
    onSuccess: () => invalidateRecordLists(qc),
  });
}

export function useBulkTagRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; add?: string[]; remove?: string[] }) =>
      api<{ updated: number; denied: Array<{ id: string; reason: string }> }>(
        patientPaths.records.bulkTag(),
        { method: "POST", json: data },
      ),
    onSuccess: () => invalidateRecordLists(qc),
  });
}

export function useBulkMoveRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; familyMemberId: string | null }) =>
      api<{ moved: number; denied: Array<{ id: string; reason: string }> }>(
        patientPaths.records.bulkMove(),
        { method: "POST", json: data },
      ),
    onSuccess: () => invalidateRecordLists(qc),
  });
}
