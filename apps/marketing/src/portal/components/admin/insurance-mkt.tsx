"use client";

/**
 * Shared types, queries and bits of UI for the admin insurance marketplace
 * (providers, plans, enrollments, marketplace claims). The API exposes list
 * endpoints only, so detail pages read from the same cached lists.
 */

import { useQuery } from "@tanstack/react-query";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { cn } from "@/portal/lib/utils";

export type MktProvider = {
  id: string;
  operatorOrgId: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  tagline?: string | null;
  description?: string | null;
  regulatorLicense?: string | null;
  claimSettlementRatioPct?: number | null;
  cashlessHospitalCount?: number | null;
  websiteUrl?: string | null;
  supportPhone?: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  isPublished: boolean;
  planCount?: number;
  enrollmentCount?: number;
  createdAt: string;
  updatedAt?: string | null;
};

export type MktPlan = {
  id: string;
  providerId: string;
  providerName?: string;
  name: string;
  slug: string;
  planType: string;
  coverageSummaryLkr: number;
  coverageDetailsJson?: string | null;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct: number | null;
  deductibleLkr: number | null;
  copayPct: number | null;
  coPaymentCapLkr: number | null;
  waitingPeriodDays: number | null;
  preExistingWaitingDays: number | null;
  networkHospitalCount: number | null;
  keyFeaturesJson?: string | null;
  exclusionsJson?: string | null;
  termMonths?: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  enrollmentCount?: number;
  createdAt: string;
};

export type MktEnrollment = {
  id: string;
  userId: string;
  planId: string;
  providerId: string;
  userName: string;
  planName: string;
  providerName: string;
  policyNumber: string | null;
  status: string;
  billingCycle: string;
  premiumAmountLkr: number;
  coverageAmountLkr: number;
  startDate: string | null;
  nextPremiumDueAt?: string | null;
  createdAt: string;
};

export type MktClaim = {
  id: string;
  enrollmentId: string;
  userId: string;
  providerId: string;
  patientName: string;
  providerName: string;
  policyNumber: string;
  treatmentType: string;
  amountRequestedLkr: number;
  amountApprovedLkr?: number | null;
  status: string;
  submittedAt?: string | null;
  createdAt?: string | null;
};

export function useMktProviders() {
  return useQuery({
    queryKey: adminQk.insuranceProviders({}),
    queryFn: () => adminApi<{ providers: MktProvider[]; total: number }>("/admin/insurance-providers"),
  });
}

export function useMktPlans(providerId?: string) {
  return useQuery({
    queryKey: adminQk.insurancePlans({ providerFilter: providerId ?? "" }),
    queryFn: () =>
      adminApi<{ plans: MktPlan[]; total: number }>(
        `/admin/insurance-plans${providerId ? `?provider_id=${providerId}` : ""}`,
      ),
  });
}

export function useMktEnrollments() {
  return useQuery({
    queryKey: adminQk.insuranceEnrollments(),
    queryFn: () => adminApi<{ enrollments: MktEnrollment[]; total: number }>("/admin/insurance-enrollments"),
  });
}

export function useMktClaims() {
  return useQuery({
    queryKey: adminQk.insuranceMarketplaceClaims(),
    queryFn: () => adminApi<{ claims: MktClaim[]; total: number }>("/admin/insurance-mkt-claims"),
  });
}

export const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
] as const;

export const PLAN_TYPE_TONE: Record<string, string> = {
  individual: "bg-sky-50 text-sky-700",
  family_floater: "bg-violet-50 text-violet-700",
  senior: "bg-amber-50 text-amber-700",
  critical_illness: "bg-red-50 text-red-600",
  cancer: "bg-rose-50 text-rose-600",
  dental: "bg-teal-50 text-teal-700",
  maternity: "bg-pink-50 text-pink-600",
};

export const ENROLLMENT_STATUSES = ["payment_pending", "active", "grace", "lapsed", "cancelled"] as const;

export function enrollmentTone(status: string): { pill: "success" | "warn" | "danger" | "neutral"; rail: string } {
  switch (status) {
    case "active":
      return { pill: "success", rail: "bg-emerald-500" };
    case "payment_pending":
      return { pill: "warn", rail: "bg-amber-400" };
    case "grace":
      return { pill: "warn", rail: "bg-orange-500" };
    case "lapsed":
      return { pill: "danger", rail: "bg-red-500" };
    default:
      return { pill: "neutral", rail: "bg-slate-300" };
  }
}

export const CLAIM_STATUSES = ["submitted", "under_review", "more_info_needed", "approved", "rejected", "paid"] as const;
export const OPEN_CLAIM_STATUSES = new Set(["submitted", "under_review", "more_info_needed"]);

export function claimTone(status: string): { pill: "success" | "warn" | "danger" | "info" | "neutral"; rail: string } {
  switch (status) {
    case "submitted":
      return { pill: "warn", rail: "bg-amber-400" };
    case "under_review":
      return { pill: "info", rail: "bg-sky-500" };
    case "more_info_needed":
      return { pill: "warn", rail: "bg-orange-500" };
    case "approved":
      return { pill: "success", rail: "bg-emerald-500" };
    case "paid":
      return { pill: "success", rail: "bg-teal-500" };
    case "rejected":
      return { pill: "danger", rail: "bg-red-500" };
    default:
      return { pill: "neutral", rail: "bg-slate-300" };
  }
}

/** Parse a JSON string column into a list of display strings. */
export function parseList(json?: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.label ?? x?.name ?? JSON.stringify(x)));
    if (v && typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}: ${String(val)}`);
  } catch {
    return json.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Compact "LKR 1.2M" style amount for stat tiles. */
export function lkrCompact(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `LKR ${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `LKR ${Math.round(n)}`;
}

/** Soft input used by the marketplace forms. */
export const MKT_INPUT =
  "h-10 w-full rounded-xl bg-slate-50 px-3 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]";

export function FormField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

/** iOS-style switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}
