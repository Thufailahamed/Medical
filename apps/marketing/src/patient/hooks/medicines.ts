"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { MedicineRow, MedicineStats, RefillCandidate } from "@/patient/types/patient";

export function useMedications() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicines(),
    queryFn: () =>
      api<{ medicines: MedicineRow[] }>(patientPaths.medicines.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ medicine: MedicineRow }>(patientPaths.medicines.create(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useEditMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; [key: string]: unknown }) =>
      api<{ medicine: MedicineRow }>(patientPaths.medicines.detail(id), {
        method: "PATCH",
        json: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useStopMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ medicine: MedicineRow }>(patientPaths.medicines.stop(id), {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useTodayDoses() {
  return useQuery<{
    doses: Array<{ id: string; medicineId: string; takenAt: string | null; skipped: boolean }>;
  }>({
    queryKey: patientKeys.dosesToday(),
    queryFn: () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return api<{
        doses: Array<{ id: string; medicineId: string; takenAt: string | null; skipped: boolean }>;
      }>(patientPaths.doses.mine(start.toISOString(), end.toISOString()));
    },
    ...PATIENT_QUERY_DEFAULTS,
  });
}

function invalidateMedicationQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: patientKeys.all });
  qc.invalidateQueries({ queryKey: patientKeys.doses() });
}

export function useMarkDoseTaken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api(patientPaths.doses.taken(id), { method: "POST", json: { notes } }),
    onSuccess: () => invalidateMedicationQueries(qc),
  });
}

export function useSkipDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api(patientPaths.doses.skip(id), { method: "POST", json: { notes } }),
    onSuccess: () => invalidateMedicationQueries(qc),
  });
}

export function useUntakeDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(patientPaths.doses.taken(id), { method: "DELETE" }),
    onSuccess: () => invalidateMedicationQueries(qc),
  });
}

export function useMedicationsToday() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicinesToday(),
    queryFn: () =>
      api<{ medicines: MedicineRow[] }>(patientPaths.medicines.today()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMedicationStats(days = 7) {
  return useQuery<MedicineStats>({
    queryKey: patientKeys.medicineStats(days),
    queryFn: () => api<MedicineStats>(patientPaths.medicines.stats(days)),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRefillDue(days = 14) {
  return useQuery<{ refills: RefillCandidate[]; count: number }>({
    queryKey: [...patientKeys.medicineRefills(), days] as const,
    queryFn: () =>
      api<{ refills: RefillCandidate[]; count: number }>(
        patientPaths.medicines.refillDue(days)
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
