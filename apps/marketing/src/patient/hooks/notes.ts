"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { NoteRow } from "@/patient/types/patient";

export function useNotes() {
  return useQuery<{ notes: NoteRow[] }>({
    queryKey: patientKeys.notes(),
    queryFn: () => api<{ notes: NoteRow[] }>(patientPaths.notes.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string | null; body: string; pinned?: boolean }) =>
      api<{ note: NoteRow }>(patientPaths.notes.create(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useEditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: Partial<Omit<NoteRow, "id" | "createdAt" | "updatedAt">> & { id: string }) =>
      api<{ note: NoteRow }>(patientPaths.notes.detail(id), {
        method: "PUT",
        json: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.notes.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}
