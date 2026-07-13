"use client";

/**
 * Pharmacy-side prescription hooks.
 *
 * Mirrors the doctor-side usePrescription hook, but talks to the
 * `/pharmacy/prescriptions` endpoints. Used by the pharmacy list
 * page and the per-prescription detail view at /portal/pharmacy.
 *
 * Mutations (usePharmacyDispense, usePharmacyReject) live in
 * `usePrescription.ts` to keep all Rx state-change hooks in one
 * place — easier to reason about than two parallel files.
 */

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";

export interface PharmacyRxRow {
  id: string;
  patientId: string;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  status: string;
  signedAt: string | null;
  dispensedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  patient: { id: string; name: string; nic: string | null };
  medicineCount: number;
}

export type PharmacyRxFilter = "signed" | "dispensed" | "cancelled" | "all";

/** Pharmacy prescription list — tenant-scoped, filtered by status. */
export function usePharmacyPrescriptions(opts: {
  status: PharmacyRxFilter;
  limit?: number;
  patientId?: string | null;
}) {
  const { status, limit = 200, patientId = null } = opts;
  return useQuery({
    queryKey: ["pharmacy", "prescriptions", status, limit, patientId],
    queryFn: () => {
      const q = new URLSearchParams();
      q.set("limit", String(limit));
      if (status !== "all") q.set("status", status);
      if (patientId) q.set("patient", patientId);
      return api<{ prescriptions: PharmacyRxRow[]; count: number }>(
        `/pharmacy/prescriptions?${q.toString()}`
      );
    },
    staleTime: 15_000,
  });
}

export interface PharmacyRxDetailMedicine {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  timing: string | null;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
}

export interface PharmacyRxDetail {
  id: string;
  patientId: string;
  hospitalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  status: string;
  signedAt: string | null;
  signedPayloadHash: string | null;
  dispensedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  doctorName: string;
  doctorSpecialization: string | null;
  doctorSlmcNo: string | null;
  patient: { name: string; nic: string | null } | null;
  medicines: PharmacyRxDetailMedicine[];
}

/** Single prescription detail (pharmacy). Tenant-scoped; no ownership
 *  check so any pharmacy user in the active tenant can view. */
export function usePharmacyPrescription(id: string | null | undefined) {
  return useQuery({
    queryKey: ["pharmacy", "prescription", id],
    queryFn: () =>
      api<{ prescription: PharmacyRxDetail }>(`/pharmacy/prescriptions/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}
