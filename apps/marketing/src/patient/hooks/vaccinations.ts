"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type {
  VaccinationAdministeredRow,
  VaccinationSlot,
} from "@/patient/types/patient";

export function useVaccinations() {
  return useQuery<{
    administered: VaccinationAdministeredRow[];
    catalog: unknown[];
  }>({
    queryKey: patientKeys.vaccinations(),
    queryFn: () =>
      api<{ administered: VaccinationAdministeredRow[]; catalog: unknown[] }>(
        patientPaths.vaccinations.mine()
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVaccinationsDue() {
  return useQuery<{
    due: VaccinationSlot[];
    overdue: VaccinationSlot[];
    upcoming: VaccinationSlot[];
  }>({
    queryKey: patientKeys.vaccinationsDue(),
    queryFn: () =>
      api<{
        due: VaccinationSlot[];
        overdue: VaccinationSlot[];
        upcoming: VaccinationSlot[];
      }>(patientPaths.vaccinations.due()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      vaccineName: string;
      vaccineId?: string;
      dose?: string | null;
      administeredAt?: string;
      recordDate?: string;
      provider?: string | null;
      notes?: string | null;
    }) =>
      api<{ vaccination: VaccinationAdministeredRow }>(
        patientPaths.vaccinations.mine(),
        { method: "POST", json: input }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
      qc.invalidateQueries({ queryKey: patientKeys.vaccinationsDue() });
    },
  });
}
