"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { AllergyRow } from "@/patient/types/patient";

export function useAllergies() {
  return useQuery<{ allergies: AllergyRow[] }>({
    queryKey: patientKeys.allergies(),
    queryFn: () =>
      api<{ allergies: AllergyRow[] }>(patientPaths.allergies.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      substance: string;
      severity?: AllergyRow["severity"];
      reaction?: string | null;
      onsetDate?: string | null;
      notes?: string | null;
    }) =>
      api<{ allergy: AllergyRow }>(patientPaths.allergies.mine(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useEditAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Omit<AllergyRow, "id" | "recordedAt">> & { id: string }) =>
      api<{ allergy: AllergyRow }>(patientPaths.allergies.detail(id), {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useDeleteAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.allergies.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}
