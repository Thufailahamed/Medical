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
        className: "bg-sky-50 text-sky-700 border-sky-200/80",
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
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export default function InsurancePage() {
  const t = useT();

  const catalogQ = useQuery({
    queryKey: ["patient", "insurance", "catalog"],
    queryFn: () =>
      api<{ providers: Provider[]; totalPlans: number }>("/insurance/catalog"),
  });

  const enrollmentsQ = useQuery({
    queryKey: ["patient", "insurance", "enrollments"],
    queryFn: () =>
      api<{ enrollments: Enrollment[] }>("/insurance/enrollments/mine"),
  });

  const claimsQ = useQuery({
    queryKey: ["patient", "insurance", "claims"],
    queryFn: () => api<{ claims: Claim[] }>("/insurance/claims/mine"),
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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Sparkles size={12} className="text-sky-300" />
                Healthcare Coverage &amp; Insurance Marketplace
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Health Insurance &amp; Policy Management
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Compare certified medical plans, track cashless hospital network coverage, and file instant reimbursement claims.
              </p>
            </div>

            {/* Header Actions (Clean Tailwind Buttons) */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/patient/insurance/coverage-check"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Activity size={13} />
                <span>Coverage Check</span>
              </Link>
              <Link
                href="/patient/insurance/marketplace"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <Search size={14} className="text-sky-700" />
                <span>Browse Plans</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <Link
              href="/patient/insurance/marketplace"
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-all"
            >
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Building2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Partner Insurers
                </p>
                <p className="text-base font-extrabold text-white">
                  {catalogQ.data?.providers?.length ?? 6} Providers
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Policies
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeEnrollments.length} Active
                </p>
              </div>
            </div>

            <Link
              href="/patient/insurance/claims"
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-all"
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Pending Claims
                </p>
                <p className="text-base font-extrabold text-white">
                  {pendingClaims.length} Claims
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Cashless Network
                </p>
                <p className="text-base font-extrabold text-white">100+ Hospitals</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Active Policies Section ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Your Active Policies</span>
            {activeEnrollments.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeEnrollments.length} Covered
              </span>
            ) : null}
          </h2>
          <Link
            href="/patient/insurance/marketplace"
            className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1"
          >
            <span>Browse Plans</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {enrollmentsQ.isLoading ? (
          <div className="space-y-2.5">
            <div className="h-20 w-full rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
            <div className="h-20 w-full rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          </div>
        ) : activeEnrollments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  No Active Health Insurance Policy Connected
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg leading-relaxed">
                  Protect yourself and your family against unforeseen hospitalization and medical expenses. Enroll in a certified health plan with cashless hospital admissions in minutes.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-600 font-medium">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Instant Cashless Approval
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-sky-700">
                    <CheckCircle2 size={13} className="text-sky-600" />
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
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShieldCheck size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-sky-700 transition-colors truncate">
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
                      <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {e.providerName ? (
                          <span className="text-slate-700 font-semibold">
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
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. Quick Actions Grid ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-900">
          Insurance Services &amp; Tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <Link
            href="/patient/insurance/marketplace"
            className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                Browse Insurance Plans
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Compare individual, family floater, and senior citizen plans from certified insurers.
              </p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>

          <Link
            href="/patient/insurance/coverage-check"
            className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                Instant Coverage Check
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Estimate out-of-pocket expenses for surgeries, procedures, or hospital stays.
              </p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>

          <Link
            href="/patient/insurance/claims"
            className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-start gap-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                Claims &amp; Reimbursements
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Submit bills, upload hospital discharge sheets, and track live payout status.
              </p>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform mt-0.5" />
          </Link>
        </div>
      </section>

      {/* ── 4. Pending Claims Section ──────────────────────────────────────── */}
      {pendingClaims.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Active Reimbursement Claims</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {pendingClaims.length} Pending
              </span>
            </h2>
            <Link
              href="/patient/insurance/claims"
              className="text-xs font-bold text-sky-700 hover:text-sky-800"
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
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-700 transition-colors truncate">
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
                      <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-slate-900 font-bold">
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
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all shrink-0" />
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
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Accredited Insurance Partners</span>
            </h2>
            <Link
              href="/patient/insurance/marketplace"
              className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1"
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
                className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center font-black text-sm">
                      <Building2 size={18} />
                    </div>
                    {p.claimSettlementRatioPct != null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        <Percent size={10} />
                        {p.claimSettlementRatioPct}% Settlement
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                    {p.name}
                  </h3>
                  {p.tagline ? (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {p.tagline}
                    </p>
                  ) : null}
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                    <span>{p.ratingAvg.toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">({p.ratingCount})</span>
                  </div>

                  <span className="font-bold text-sky-700 group-hover:underline flex items-center gap-0.5">
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