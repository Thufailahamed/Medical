"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Percent,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import { formatDate, formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

interface Enrollment {
  id: string;
  policyNumber: string | null;
  status: string;
  billingCycle: string;
  premiumAmountLkr: number;
  coverageAmountLkr: number;
  nextPremiumDueAt: string | null;
  providerName?: string | null;
  planName?: string | null;
}

interface Claim {
  id: string;
  claimNumber: string | null;
  status: string;
  amountRequestedLkr: number;
  amountApprovedLkr: number | null;
  providerName: string | null;
  createdAt: string;
}

interface Provider {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  claimSettlementRatioPct: number | null;
  ratingAvg: number;
  ratingCount: number;
  planCount?: number;
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      };
    case "grace_period":
      return {
        label: "Grace Period",
        className: "bg-amber-50 text-amber-800 border-amber-200/80",
      };
    case "lapsed":
      return {
        label: "Lapsed",
        className: "bg-rose-50 text-rose-700 border-rose-200/80",
      };
    case "submitted":
      return {
        label: "Submitted",
        className: "bg-brand-soft text-brand border-brand/25",
      };
    case "under_review":
      return {
        label: "Under Review",
        className: "bg-amber-50 text-amber-800 border-amber-200/80",
      };
    case "approved":
      return {
        label: "Approved",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "bg-rose-50 text-rose-700 border-rose-200/80",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        className: "bg-surface-2 text-text border-border",
      };
  }
}

export default function InsurancePage() {
  const t = useT();

  const catalogQ = useQuery({
    queryKey: ["patient", "insurance", "catalog"],
    queryFn: () =>
      api<{ providers: Provider[]; totalPlans: number }>("/insurance-marketplace/catalog"),
  });

  const enrollmentsQ = useQuery({
    queryKey: ["patient", "insurance", "enrollments"],
    queryFn: () =>
      api<{ enrollments: Enrollment[] }>("/insurance-marketplace/enrollments/me"),
  });

  const claimsQ = useQuery({
    queryKey: ["patient", "insurance", "claims"],
    queryFn: () => api<{ claims: Claim[] }>("/insurance-marketplace/claims/me"),
  });

  const enrollments = enrollmentsQ.data?.enrollments ?? [];
  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const claims = claimsQ.data?.claims ?? [];
  const pendingClaims = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  );
  const providers = catalogQ.data?.providers?.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. VYRO Ink Hero ─────────────────────────────────────────────── */}
      <PageHero
        icon={<Sparkles size={13} />}
        kicker="Healthcare Coverage & Insurance Marketplace"
        title="Health Insurance & Policy Management"
        description="Compare certified medical plans, track cashless hospital network coverage, and file instant reimbursement claims."
        actions={
          <>
            <Link href="/patient/insurance/coverage-check" className={heroSecondaryAction}>
              <Activity size={13} />
              <span>Coverage Check</span>
            </Link>
            <Link href="/patient/insurance/marketplace" className={heroPrimaryAction}>
              <Search size={14} />
              <span>Browse Plans</span>
            </Link>
          </>
        }
        footer={
          <>
            <span>{catalogQ.data?.providers?.length ?? 6} partner insurers</span>
            <span>{activeEnrollments.length} active policies</span>
            <span>{pendingClaims.length} pending claims</span>
            <span>Cashless network · 100+ hospitals</span>
          </>
        }
      />

      {/* ── 2. Active Policies Section ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <span>Your Active Policies</span>
            {activeEnrollments.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeEnrollments.length} Covered
              </span>
            ) : null}
          </h2>
          <Link
            href="/patient/insurance/marketplace"
            className="text-xs font-bold text-brand hover:text-brand inline-flex items-center gap-1"
          >
            <span>Browse Plans</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {enrollmentsQ.isLoading ? (
          <div className="space-y-2.5">
            <div className="h-20 w-full rounded-2xl bg-surface-2 animate-pulse border border-border" />
            <div className="h-20 w-full rounded-2xl bg-surface-2 animate-pulse border border-border" />
          </div>
        ) : activeEnrollments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-brand-soft border-border flex items-center justify-center text-brand shrink-0">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">
                  No Active Health Insurance Policy Connected
                </h3>
                <p className="text-xs sm:text-sm text-text-soft mt-1 max-w-lg leading-relaxed">
                  Protect yourself and your family against unforeseen hospitalization and medical expenses. Enroll in a certified health plan with cashless hospital admissions in minutes.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-text-soft font-medium">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Instant Cashless Approval
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-brand">
                    <CheckCircle2 size={13} className="text-brand" />
                    Up to LKR 5,000,000 Cover
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <CheckCircle2 size={13} className="text-amber-600" />
                    Zero Paperwork
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/patient/insurance/marketplace"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all shrink-0 flex items-center gap-1.5"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              <span>Explore Marketplace</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeEnrollments.map((e) => {
              const badge = statusBadge(e.status);
              return (
                <Link
                  key={e.id}
                  href={`/patient/insurance/policy/${e.id}`}
                  className="group rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShieldCheck size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-brand transition-colors truncate">
                          {e.planName ?? e.policyNumber ?? `Policy ${e.id.slice(0, 8)}`}
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px] font-bold border",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-text-soft font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {e.providerName ? (
                          <span className="text-text font-semibold">
                            {e.providerName}
                          </span>
                        ) : null}
                        {e.providerName ? <span>·</span> : null}
                        <span>{formatLkr(e.coverageAmountLkr)} coverage</span>
                        <span>·</span>
                        <span>{formatLkr(e.premiumAmountLkr)} / {e.billingCycle}</span>
                      </div>
                      {e.nextPremiumDueAt ? (
                        <div className="text-[11px] text-amber-700 mt-1 inline-flex items-center gap-1 font-semibold">
                          <Wallet size={11} />
                          <span>Next premium due {formatDate(e.nextPremiumDueAt)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. Quick Actions Grid ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-text">
          Insurance Services &amp; Tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <Link
            href="/patient/insurance/marketplace"
            className="group rounded-2xl border border-border bg-surface p-4 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-brand-soft border-border text-brand flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                Browse Insurance Plans
              </h3>
              <p className="text-xs text-text-soft mt-0.5 leading-relaxed">
                Compare individual, family floater, and senior citizen plans from certified insurers.
              </p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>

          <Link
            href="/patient/insurance/coverage-check"
            className="group rounded-2xl border border-border bg-surface p-4 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                Instant Coverage Check
              </h3>
              <p className="text-xs text-text-soft mt-0.5 leading-relaxed">
                Estimate out-of-pocket expenses for surgeries, procedures, or hospital stays.
              </p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>

          <Link
            href="/patient/insurance/claims"
            className="group rounded-2xl border border-border bg-surface p-4 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-text group-hover:text-brand transition-colors">
                Claims &amp; Reimbursements
              </h3>
              <p className="text-xs text-text-soft mt-0.5 leading-relaxed">
                Submit bills, upload hospital discharge sheets, and track live payout status.
              </p>
            </div>
            <ChevronRight size={16} className="text-text-muted group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>
        </div>
      </section>

      {/* ── 4. Pending Claims Section ──────────────────────────────────────── */}
      {pendingClaims.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <span>Active Reimbursement Claims</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {pendingClaims.length} Pending
              </span>
            </h2>
            <Link
              href="/patient/insurance/claims"
              className="text-xs font-bold text-brand hover:text-brand"
            >
              View All Claims
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {pendingClaims.slice(0, 3).map((c) => {
              const badge = statusBadge(c.status);
              return (
                <Link
                  key={c.id}
                  href={`/patient/insurance/claims`}
                  className="group rounded-2xl border border-border bg-surface p-4 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text text-sm group-hover:text-brand transition-colors truncate">
                          {c.claimNumber ?? `Claim #${c.id.slice(0, 8)}`}
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px] font-bold border",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-xs text-text-soft font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-text font-bold">
                          {formatLkr(c.amountRequestedLkr)} requested
                        </span>
                        {c.amountApprovedLkr != null ? (
                          <span className="text-emerald-700 font-semibold">
                            · {formatLkr(c.amountApprovedLkr)} approved
                          </span>
                        ) : null}
                        {c.providerName ? <span>· {c.providerName}</span> : null}
                        <span>· {formatDate(c.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── 5. Top Insurers Showcase ───────────────────────────────────────── */}
      {providers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <span>Accredited Insurance Partners</span>
            </h2>
            <Link
              href="/patient/insurance/marketplace"
              className="text-xs font-bold text-brand hover:text-brand inline-flex items-center gap-1"
            >
              <span>Compare All</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {providers.map((p) => (
              <Link
                key={p.id}
                href={`/patient/insurance/marketplace`}
                className="group rounded-2xl border border-border bg-surface p-4 shadow-xs hover:shadow-md hover:border-border-strong transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="h-10 w-10 rounded-xl bg-brand-soft border-border text-brand flex items-center justify-center font-black text-sm">
                      <Building2 size={18} />
                    </div>
                    {p.claimSettlementRatioPct != null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        <Percent size={10} />
                        {p.claimSettlementRatioPct}% Settlement
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-bold text-sm text-text group-hover:text-brand transition-colors truncate">
                    {p.name}
                  </h3>
                  {p.tagline ? (
                    <p className="text-xs text-text-soft mt-0.5 line-clamp-1">
                      {p.tagline}
                    </p>
                  ) : null}
                </div>

                <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-semibold text-text">
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                    <span>{p.ratingAvg.toFixed(1)}</span>
                    <span className="text-text-muted font-normal">({p.ratingCount})</span>
                  </div>

                  <span className="font-bold text-brand group-hover:underline flex items-center gap-0.5">
                    View Plans
                    <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}