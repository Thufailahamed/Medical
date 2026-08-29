"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { CareTeamMember } from "@healthcare/shared/contracts";

export function useCareTeam() {
  return useQuery<{ members: CareTeamMember[] }>({
    queryKey: patientKeys.careTeam(),
    queryFn: () => api<{ members: CareTeamMember[] }>(patientPaths.careTeam.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      role: CareTeamMember["role"];
      specialty?: string;
      organization?: string;
      phone?: string;
      email?: string;
      notes?: string;
    }) =>
      api<{ member: CareTeamMember }>(patientPaths.careTeam.add(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.careTeam() }),
  });
}

export function useRemoveCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(patientPaths.careTeam.remove(id), {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.careTeam() }),
  });
}
