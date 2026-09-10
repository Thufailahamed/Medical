"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";

export type InsuranceStatus = "active" | "pending" | "lapsed" | "expired";

export interface InsurancePolicy {
  provider: string;
  number: string;
  status: InsuranceStatus;
  renewsAt: string | null;
}

export interface InsuranceSummary {
  policy: InsurancePolicy | null;
  claimsOpen: number;
}

interface InsuranceRow {
  providerName?: string;
  policyNumber?: string;
  status?: string;
  renewalDate?: string | null;
}

function normalizeStatus(s: string | undefined): InsuranceStatus {
  if (s === "active" || s === "pending" || s === "lapsed" || s === "expired") return s;
  if (s === "expired") return "expired";
  return "active";
}

export function useInsurance() {
  return useQuery<InsuranceSummary>({
    queryKey: patientKeys.insurance(),
    queryFn: async () => {
      const res = await api<{ insurance: InsuranceRow[] }>(patientPaths.insurance.mine());
      const rows = res?.insurance ?? [];
      const first = rows[0];
      const policy: InsurancePolicy | null = first
        ? {
            provider: first.providerName ?? "",
            number: first.policyNumber ?? "",
            status: normalizeStatus(first.status),
            renewsAt: first.renewalDate ?? null,
          }
        : null;
      return { policy, claimsOpen: 0 };
    },
    ...PATIENT_QUERY_DEFAULTS,
  });
}
