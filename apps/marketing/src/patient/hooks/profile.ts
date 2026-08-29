"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { HealthSummary, WellnessResponse } from "@/patient/types/patient";
import type { AuthUser } from "@/portal/stores/auth";

export interface PatientProfileResponse {
  patient: {
    patients: { id: string; dateOfBirth: string | null; gender: string | null };
    users: { id: string; name: string; email: string | null; phone: string | null };
  };
}

export function usePatientProfile() {
  return useQuery<PatientProfileResponse>({
    queryKey: [...patientKeys.profile(), "record"] as const,
    queryFn: () => api<PatientProfileResponse>(patientPaths.profile.me()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useProfile() {
  return useQuery<AuthUser | null>({
    queryKey: patientKeys.profile(),
    queryFn: () =>
      api<{ user: AuthUser }>(patientPaths.profile.auth()).then((r) => r.user),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useHealthSummary() {
  return useQuery<HealthSummary>({
    queryKey: patientKeys.healthSummary(),
    queryFn: () => api<HealthSummary>(patientPaths.profile.healthSummary()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useWellness() {
  return useQuery<WellnessResponse>({
    queryKey: patientKeys.wellness(),
    queryFn: () => api<WellnessResponse>(patientPaths.profile.wellness()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
