import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "../lib/api";

export type InsuranceOperatorClaimDoc = {
  id: string;
  kind: string;
  fileKey: string;
  uploadedAt?: string;
  createdAt?: string;
};

export type InsuranceOperatorClaimMessage = {
  id: string;
  senderUserId: string;
  senderRole: "patient" | "operator" | string;
  body: string;
  attachmentFileKey?: string | null;
  createdAt: string;
};

/** Matches the real /insurance-operator/claims row shape (raw claims table row
 *  + joined documents/messages). Claimant name & policy number are NOT on the
 *  claim — resolve them from the enrollments list via `enrollmentId`. */
export type InsuranceOperatorClaim = {
  id: string;
  enrollmentId: string;
  userId?: string;
  providerId?: string;
  treatmentType: string;
  incurringFacility?: string | null;
  facility?: string | null;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  diagnosis?: string | null;
  amountRequestedLkr: number;
  amountApprovedLkr?: number | null;
  status: string;
  insurerRemarks?: string | null;
  patientRemarks?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  transactionRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: InsuranceOperatorClaimDoc[];
  messages?: InsuranceOperatorClaimMessage[];
};

export type InsuranceOperatorDependent = {
  id: string;
  name: string;
  relation: string;
  dob?: string | null;
};

export type InsuranceOperatorEnrollment = {
  id: string;
  userId: string;
  userName: string;
  planId?: string;
  planName: string;
  providerId?: string;
  policyNumber: string;
  status: string;
  kycStatus?: string | null;
  billingCycle: string;
  premiumAmountLkr: number;
  coverageAmountLkr: number;
  startDate: string;
  endDate?: string | null;
  nextPremiumDueAt?: string | null;
  nomineeName?: string | null;
  dependents?: InsuranceOperatorDependent[];
  createdAt?: string;
};

export type InsuranceOperatorStats = {
  totalEnrollments: number;
  activeEnrollments: number;
  pendingClaims: number;
  approvedClaimsMtd: number;
  premiumCollectedMtd: number;
  totalProviders?: number;
};

/** Raw API shape is `{ org, activePolicies, pendingClaims, approvedThisMonth,
 *  totalProviders, providers }` — normalize it onto the `stats` object the
 *  UI consumes (and accept a legacy `{ stats: … }` shape if it ever returns). */
type DashboardResponse = {
  stats?: InsuranceOperatorStats;
  org?: { id: string; name?: string };
  activePolicies?: number;
  pendingClaims?: number;
  approvedThisMonth?: number;
  totalProviders?: number;
};

export function useInsuranceOperatorDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardResponse>("/insurance-operator/dashboard"),
    select: (d): { stats: InsuranceOperatorStats; org?: { id: string; name?: string } } => ({
      org: d.org,
      stats: {
        totalEnrollments: d.stats?.totalEnrollments ?? 0,
        activeEnrollments: d.stats?.activeEnrollments ?? d.activePolicies ?? 0,
        pendingClaims: d.stats?.pendingClaims ?? d.pendingClaims ?? 0,
        approvedClaimsMtd: d.stats?.approvedClaimsMtd ?? d.approvedThisMonth ?? 0,
        premiumCollectedMtd: d.stats?.premiumCollectedMtd ?? 0,
        totalProviders: d.stats?.totalProviders ?? d.totalProviders ?? 0,
      },
    }),
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

/* ─── Catalog: providers + plan drafts ─────────────────────────────── */

export type InsuranceOperatorProvider = {
  id: string;
  operatorOrgId?: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  tagline?: string | null;
  description?: string | null;
  regulatorLicense?: string | null;
  claimSettlementRatioPct?: number | null;
  cashlessHospitalCount?: number | null;
  websiteUrl?: string | null;
  supportPhone?: string | null;
  isPublished?: boolean | number;
  createdAt?: string;
  updatedAt?: string;
};

export type InsuranceOperatorPlan = {
  id: string;
  providerId: string;
  providerName?: string | null;
  slug: string;
  name: string;
  planType: string;
  coverageSummaryLkr: number;
  coverageDetailsJson?: string | null;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct?: number;
  deductibleLkr?: number;
  copayPct?: number;
  coPaymentCapLkr?: number;
  waitingPeriodDays?: number;
  preExistingWaitingDays?: number;
  networkHospitalCount?: number;
  keyFeaturesJson?: string | null;
  exclusionsJson?: string | null;
  termMonths?: number;
  isPublished?: boolean | number;
  isFeatured?: boolean | number;
  createdAt?: string;
  updatedAt?: string;
};

export function useInsuranceOperatorProviders() {
  return useQuery({
    queryKey: qk.providers,
    queryFn: () =>
      api<{ providers: InsuranceOperatorProvider[] }>(
        "/insurance-operator/providers",
      ),
  });
}

export function useInsuranceOperatorPlans() {
  return useQuery({
    queryKey: qk.plans,
    queryFn: () =>
      api<{ plans: InsuranceOperatorPlan[] }>("/insurance-operator/plans"),
  });
}

export type ProviderDraftInput = {
  name: string;
  slug: string;
  logoUrl?: string;
  tagline?: string;
  description?: string;
  regulatorLicense?: string;
  claimSettlementRatioPct?: number;
  cashlessHospitalCount?: number;
  websiteUrl?: string;
  supportPhone?: string;
};

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProviderDraftInput) =>
      api<{ provider: InsuranceOperatorProvider }>(
        "/insurance-operator/providers",
        { method: "POST", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.providers });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ProviderDraftInput & { id: string }) =>
      api<{ provider: InsuranceOperatorProvider }>(
        `/insurance-operator/providers/${id}`,
        { method: "PUT", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.providers });
    },
  });
}

export type PlanDraftInput = {
  providerId: string;
  slug: string;
  name: string;
  planType: string;
  coverageSummaryLkr: number;
  coverageDetailsJson?: string;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct?: number;
  deductibleLkr?: number;
  copayPct?: number;
  coPaymentCapLkr?: number;
  waitingPeriodDays?: number;
  preExistingWaitingDays?: number;
  networkHospitalCount?: number;
  keyFeaturesJson?: string;
  exclusionsJson?: string;
  termMonths?: number;
  isFeatured?: boolean;
};

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlanDraftInput) =>
      api<{ plan: InsuranceOperatorPlan }>("/insurance-operator/plans", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PlanDraftInput> & { id: string }) =>
      api<{ plan: InsuranceOperatorPlan }>(
        `/insurance-operator/plans/${id}`,
        { method: "PUT", body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans });
    },
  });
}

function invalidateClaimQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["insurance-operator-claim"] });
  qc.invalidateQueries({ queryKey: ["insurance-operator-claims"] });
  qc.invalidateQueries({ queryKey: qk.dashboard });
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
    onSuccess: () => invalidateClaimQueries(qc),
  });
}

/** Record a payout on an approved claim → status becomes `paid`. */
export function usePayClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      transactionRef,
      amountApprovedLkr,
    }: {
      id: string;
      transactionRef: string;
      amountApprovedLkr?: number;
    }) =>
      api<{ claim: InsuranceOperatorClaim }>(
        `/insurance-operator/claims/${id}/pay`,
        {
          method: "POST",
          body: { transactionRef, amountApprovedLkr },
        },
      ),
    onSuccess: () => invalidateClaimQueries(qc),
  });
}

/** KYC verify/reject decision on an enrollment. */
export function useKycDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "verified" | "rejected";
    }) =>
      api<{ enrollment: InsuranceOperatorEnrollment }>(
        `/insurance-operator/enrollments/${id}/kyc`,
        {
          method: "POST",
          body: { decision },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.enrollments });
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
