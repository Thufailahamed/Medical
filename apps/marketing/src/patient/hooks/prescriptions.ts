"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { PrescriptionRow } from "@healthcare/shared/contracts";

export function usePrescriptions() {
  return useQuery<{ prescriptions: PrescriptionRow[] }>({
    queryKey: patientKeys.prescriptions(),
    queryFn: () =>
      api<{ prescriptions: PrescriptionRow[] }>(
        patientPaths.prescriptions.mine()
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function usePrescription(id: string) {
  return useQuery<{ prescription: PrescriptionRow }>({
    queryKey: patientKeys.prescription(id),
    queryFn: () =>
      api<{ prescription: PrescriptionRow }>(
        patientPaths.prescriptions.detail(id)
      ),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function usePrescriptionPdfUrl() {
  return useMutation({
    mutationFn: (id: string) => {
      const url = patientPaths.prescriptions.pdf(id);
      return api<{ url: string }>(url);
    },
  });
}
