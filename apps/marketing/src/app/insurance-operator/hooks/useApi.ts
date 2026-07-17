import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "../lib/api";

export type InsuranceOperatorClaim = {
  id: string;
  enrollmentId: string;
  patientName: string;
  policyNumber: string;
  treatmentType: string;
  facility?: string | null;
  diagnosis?: string | null;
  amountRequestedLkr: number;
  amountApprovedLkr?: number | null;
  status: string;
  insurerRemarks?: string | null;
  patientRemarks?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  documents: Array<{
    id: string;
    kind: string;
    fileKey: string;
    uploadedAt: string;
  }>;
  messages: Array<{
    id: string;
    senderRole: string;
    senderName: string;
    body: string;
    createdAt: string;
  }>;
};

export type InsuranceOperatorEnrollment = {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  policyNumber: string;
  status: string;
  billingCycle: string;
  premiumAmountLkr: number;
  coverageAmountLkr: number;
  startDate: string;
  endDate?: string | null;
  nextPremiumDueAt?: string | null;
};

export type InsuranceOperatorStats = {
  totalEnrollments: number;
  activeEnrollments: number;
  pendingClaims: number;
  approvedClaimsMtd: number;
  premiumCollectedMtd: number;
};

export function useInsuranceOperatorDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<{ stats: InsuranceOperatorStats }>("/insurance-operator/dashboard"),
  });
}

export function useInsuranceOperatorClaims(status?: string) {
  return useQuery({
    queryKey: qk.claims(status),
    queryFn: () =>
      api<{ claims: InsuranceOperatorClaim[] }>(
        `/insurance-operator/claims${status ? `?status=${status}` : ""}`,
      ),
  });
}

export function useInsuranceOperatorClaim(id: string) {
  return useQuery({
    queryKey: qk.claim(id),
    queryFn: () =>
      api<{ claim: InsuranceOperatorClaim }>(`/insurance-operator/claims/${id}`),
    enabled: !!id,
  });
}

export function useInsuranceOperatorEnrollments() {
  return useQuery({
    queryKey: qk.enrollments,
    queryFn: () =>
      api<{ enrollments: InsuranceOperatorEnrollment[] }>(
        "/insurance-operator/enrollments",
      ),
  });
}

export function useDecideClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      amountApprovedLkr,
      remarks,
    }: {
      id: string;
      decision: "approve" | "reject" | "more_info";
      amountApprovedLkr?: number;
      remarks?: string;
    }) =>
      api<{ claim: InsuranceOperatorClaim }>(
        `/insurance-operator/claims/${id}/decision`,
        {
          method: "POST",
          body: { decision, amountApprovedLkr, remarks },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-operator-claim"] });
      qc.invalidateQueries({ queryKey: ["insurance-operator-claims"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function usePostClaimMessageOperator() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: string; body: string }>({
    mutationFn: ({ id, body }) =>
      api(`/insurance-operator/claims/${id}/messages`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.claim(vars.id) });
    },
  });
}