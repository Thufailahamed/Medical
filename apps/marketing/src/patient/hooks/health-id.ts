"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  patientKeys,
  patientPaths,
  type HealthIdPurpose,
  type HealthIdToken,
} from "@healthcare/shared/contracts";

export type { HealthIdPurpose, HealthIdToken };

/** Compact QR payload — matches mobile `encodeHealthIdPayload`. */
export function encodeHealthIdPayload(
  token: string,
  purpose: HealthIdPurpose,
  hospitalId?: string | null,
): string {
  const payload: Record<string, string> = { t: token, p: purpose };
  if (hospitalId) payload.h = hospitalId;
  return JSON.stringify(payload);
}

export function useCurrentHealthId(purpose: HealthIdPurpose = "all") {
  return useQuery<HealthIdToken | null>({
    queryKey: patientKeys.healthId(purpose),
    queryFn: async () => {
      const res = await api<{
        token: string | null;
        purpose: string | null;
        rotationSeconds?: number;
        expiresAt?: string;
        scopes?: string[];
      }>(patientPaths.healthId.current(purpose));
      if (!res.token) return null;
      return {
        token: res.token,
        purpose: (res.purpose ?? purpose) as HealthIdPurpose,
        rotationSeconds: res.rotationSeconds,
        expiresAt: res.expiresAt ?? "",
        scopes: res.scopes,
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useIssueHealthId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: HealthIdPurpose = "all") =>
      api<HealthIdToken>(patientPaths.healthId.issue(), {
        method: "POST",
        json: { purpose },
      }),
    onSuccess: (data, purpose) => {
      qc.setQueryData(patientKeys.healthId(purpose), data);
      qc.invalidateQueries({ queryKey: ["patient", "health-id"] });
    },
  });
}

export function useRevokeHealthId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purpose: HealthIdPurpose | null = "all") =>
      api<{ revoked: number }>(patientPaths.healthId.revoke(), {
        method: "POST",
        json: purpose ? { purpose } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "health-id"] });
    },
  });
}
