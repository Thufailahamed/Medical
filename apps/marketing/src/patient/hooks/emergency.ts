"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
  type EmergencyQrData,
} from "@healthcare/shared/contracts";

export function useEmergencyQR() {
  return useQuery<{ qrData: EmergencyQrData }>({
    queryKey: patientKeys.emergencyQr(),
    queryFn: () =>
      api<{ qrData: EmergencyQrData }>(patientPaths.emergency.qr()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useTriggerSOS() {
  return useMutation({
    mutationFn: (data: {
      latitude?: number;
      longitude?: number;
      message?: string;
    } = {}) =>
      api<{
        emergency: { id: string };
        nearestHospital?: { name: string } | null;
        notifiedContacts?: unknown[];
      }>(patientPaths.emergency.sos(), { method: "POST", json: data }),
  });
}
