"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
  type ConsentAuditEntry,
  type ConsentGrant,
  type ConsentIssueInput,
} from "@healthcare/shared/contracts";

export function useConsentsMine() {
  return useQuery<{ items: ConsentGrant[] }>({
    queryKey: patientKeys.consentsMine(),
    queryFn: () =>
      api<{ items: ConsentGrant[] }>(patientPaths.consents.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useConsentsIssued() {
  return useQuery<{ items: ConsentGrant[] }>({
    queryKey: patientKeys.consentsIssued(),
    queryFn: () =>
      api<{ items: ConsentGrant[] }>(patientPaths.consents.issued()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useConsentAudit() {
  return useQuery<{ items: ConsentAuditEntry[] }>({
    queryKey: patientKeys.consentsAudit(),
    queryFn: () =>
      api<{ items: ConsentAuditEntry[] }>(patientPaths.consents.audit()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useIssueConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConsentIssueInput) =>
      api<{ id: string; expiresAt: string }>(patientPaths.consents.create(), {
        method: "POST",
        json: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.consents() });
    },
  });
}

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ revoked: boolean }>(patientPaths.consents.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.consents() });
    },
  });
}
