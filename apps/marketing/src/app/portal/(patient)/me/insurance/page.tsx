"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  FileText,
  Search,
  ArrowRight,
  Activity,
  ChevronRight,
  Building2,
  Star,
  Sparkles,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDate, formatLkr } from "@/portal/lib/format";

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
  claimedAmountLkr: number;
  submittedAt: string | null;
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

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  payment_pending: "warn",
  grace: "warn",
  lapsed: "danger",
  cancelled: "neutral",
  expired: "neutral",
  approved: "success",
  rejected: "danger",
  under_review: "warn",
  more_info_needed: "warn",
  submitted: "warn",
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function PatientInsuranceHome() {
  const t = useT();

  const enrollmentsQ = useQuery({
    queryKey: ["insurance", "enrollments", "me"],
    queryFn: () =>
      api<{ enrollments: Enrollment[]; total: number }>(
        "/insurance-marketplace/enrollments/me",
      ),
  });
  const claimsQ = useQuery({
    queryKey: ["insurance", "claims", "me"],
    queryFn: () =>
      api<{ claims: Claim[]; total: number }>("/insurance-marketplace/claims/me"),
  });
  const catalogQ = useQuery({
    queryKey: ["insurance", "catalog", { preview: 1 }],
    queryFn: () =>
      api<{ providers: Provider[]; plans: unknown[] }>(
        "/insurance-marketplace/catalog",
      ),
  });

  const enrollments = enrollmentsQ.data?.enrollments ?? [];
  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const claims = claimsQ.data?.claims ?? [];
  const pendingClaims = claims.filter((c) =>
    ["submitted", "under_review", "more_info_needed"].includes(c.status),
  );
  const providers = catalogQ.data?.providers?.slice(0, 6) ?? [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-brand to-brand-strong text-white border-0 !shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/70 font-bold">
              <Sparkles size={12} />
              Marketplace
            </div>
            <h1 className="text-2xl font-bold mt-1">
              {t("patientPortal.insurance.title", "Insurance")}
            </h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">
              {t(
                "patientPortal.insurance.tagline",
                "Browse plans, file claims, check coverage — all in one place.",
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href="/portal/me/insurance/marketplace"
                className="portal-btn portal-btn-secondary portal-btn-md !bg-white !text-brand-strong hover:!bg-white/90"
              >
                <Search size={14} />
                {t("patientPortal.insurance.browse", "Browse plans")}
              </Link>
              <Link
                href="/portal/me/insurance/coverage-check"
                className="portal-btn portal-btn-md !bg-white/15 !text-white hover:!bg-white/25 border !border-white/30"
              >
                <Activity size={14} />
                {t("patientPortal.insurance.coverageCheck", "Coverage check")}
              </Link>
            </div>
          </div>
          <div className="hidden md:flex h-16 w-16 rounded-2xl bg-white/15 items-center justify-center backdrop-blur-sm">
            <ShieldCheck size={32} className="text-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/20">
          <Stat label="Providers" value={catalogQ.data?.providers?.length ?? 0} />
          <Stat label="Active policies" value={activeEnrollments.length} />
          <Stat label="Pending claims" value={pendingClaims.length} />
        </div>
      </Card>

      {/* Active policies */}
      <section>
        <SectionHeading
          title={t("patientPortal.insurance.activePolicies", "Active policies")}
          right={
            <Link
              href="/portal/me/insurance/marketplace"
              className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
            >
              {t("patientPortal.insurance.browse", "Browse plans")}
              <ArrowRight size={12} />
            </Link>
          }
        />
        {enrollmentsQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : activeEnrollments.length === 0 ? (
          <Card className="text-center py-8">
            <ShieldCheck size={28} className="mx-auto text-text-muted" />
            <p className="text-sm text-text-soft mt-2">
              {t(
                "patientPortal.insurance.noActive",
                "No active policies",
              )}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {t(
                "patientPortal.insurance.noActiveBody",
                "Browse the marketplace to get coverage in minutes.",
              )}
            </p>
            <div className="mt-4">
              <Link href="/portal/me/insurance/marketplace">
                <Button size="sm">
                  {t("patientPortal.insurance.browse", "Browse plans")}
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeEnrollments.map((e) => (
              <Link
                key={e.id}
                href={`/portal/me/insurance/policy/${e.id}`}
                className="block"
              >
                <Card className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-text text-sm truncate">
                        {e.policyNumber ?? `Policy ${e.id.slice(0, 8)}`}
                      </div>
                      <Pill tone={STATUS_TONE[e.status] ?? "neutral"}>
                        {statusLabel(e.status)}
                      </Pill>
                    </div>
                    <div className="text-xs text-text-soft mt-0.5">
                      {formatLkr(e.coverageAmountLkr)} coverage ·{" "}
                      {formatLkr(e.premiumAmountLkr)} / {e.billingCycle}
                    </div>
                    {e.nextPremiumDueAt ? (
                      <div className="text-[11px] text-amber-700 mt-1 inline-flex items-center gap-1">
                        <Wallet size={10} />
                        {t(
                          "patientPortal.insurance.nextPremiumDue",
                          "Next premium due {{date}}",
                          { date: formatDate(e.nextPremiumDueAt) },
                        )}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight size={16} className="text-text-muted shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pending claims */}
      {pendingClaims.length > 0 ? (
        <section>
          <SectionHeading
            title={t(
              "patientPortal.insurance.pendingClaims",
              "Pending claims",
            )}
            right={
              <Link
                href="/portal/me/insurance/claims"
                className="text-xs text-brand hover:text-brand-strong font-semibold"
              >
                {t("patientPortal.home.viewAll", "View all")}
              </Link>
            }
          />
          <div className="space-y-2">
            {pendingClaims.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                href={`/portal/me/insurance/claims/${c.id}`}
                className="block"
              >
                <Card className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-warn-soft text-amber-700 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-text text-sm truncate">
                        {c.claimNumber ?? `Claim ${c.id.slice(0, 8)}`}
                      </div>
                      <Pill tone={STATUS_TONE[c.status] ?? "warn"}>
                        {statusLabel(c.status)}
                      </Pill>
                    </div>
                    <div className="text-xs text-text-soft mt-0.5">
                      {formatLkr(c.claimedAmountLkr)} claimed
                      {c.submittedAt
                        ? ` · ${formatDate(c.submittedAt)}`
                        : ""}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-muted shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick actions */}
      <section>
        <SectionHeading
          title={t("patientPortal.home.actions", "Quick actions")}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickAction
            href="/portal/me/insurance/marketplace"
            icon={<Search size={16} />}
            title={t(
              "patientPortal.insurance.browse",
              "Browse plans",
            )}
            body={t(
              "patientPortal.insurance.browseBody",
              "Compare plans from top insurers.",
            )}
          />
          <QuickAction
            href="/portal/me/insurance/coverage-check"
            icon={<Activity size={16} />}
            title={t(
              "patientPortal.insurance.coverageCheck",
              "Coverage check",
            )}
            body={t(
              "patientPortal.insurance.coverageCheckBody",
              "Estimate out-of-pocket before treatment.",
            )}
          />
          <QuickAction
            href="/portal/me/insurance/claims/new"
            icon={<FileText size={16} />}
            title={t(
              "patientPortal.insurance.submitClaim",
              "Submit a claim",
            )}
            body={t(
              "patientPortal.insurance.submitClaimBody",
              "Reimbursement claims with upload.",
            )}
          />
        </div>
      </section>

      {/* Featured providers */}
      {providers.length > 0 ? (
        <section>
          <SectionHeading
            title={t("patientPortal.insurance.providers", "Top insurers")}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providers.map((p) => (
              <Link
                key={p.id}
                href={`/portal/me/insurance/marketplace/${p.slug}`}
                className="block"
              >
                <Card className="h-full flex flex-col gap-1.5">
                  <div className="h-9 w-9 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center">
                    <Building2 size={16} />
                  </div>
                  <div className="text-sm font-bold text-text truncate">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-text-soft">
                    <Star
                      size={10}
                      className="text-amber-500"
                      fill="currentColor"
                    />
                    {p.ratingAvg.toFixed(1)}{" "}
                    <span className="text-text-muted">
                      ({p.ratingCount})
                    </span>
                  </div>
                  {p.claimSettlementRatioPct != null ? (
                    <div className="text-[11px] text-text-muted">
                      {p.claimSettlementRatioPct}% claim settlement
                    </div>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/70 mt-0.5">{label}</div>
    </div>
  );
}

function SectionHeading({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-text">{title}</h2>
      {right}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/60 bg-surface-1 hover:bg-surface-2/50 transition-colors"
    >
      <div className="p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text">{title}</div>
          <div className="text-xs text-text-soft mt-0.5">{body}</div>
        </div>
        <ChevronRight size={16} className="text-text-muted shrink-0 mt-1" />
      </div>
    </Link>
  );
}