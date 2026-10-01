"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Percent,
  Receipt,
  Search,
  Shield,
  ShieldCheck,
  Star,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDate, formatLkr } from "@/portal/lib/format";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  StatTile,
  TONE_BADGE,
  type Tone,
} from "@/patient/components/workspace";

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

function statusTone(status: string): Tone {
  switch (status) {
    case "active":
    case "approved":
    case "paid":
      return "emerald";
    case "grace_period":
    case "under_review":
    case "more_info_needed":
      return "amber";
    case "lapsed":
    case "rejected":
      return "rose";
    case "submitted":
      return "sky";
    default:
      return "slate";
  }
}

export default function InsurancePage() {
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
    <PatientPage>
      <PatientHero
        kickerIcon={<Shield size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Policies & marketplace"
        title={
          <>
            Health insurance, <HeroAccent>all in one place</HeroAccent>
          </>
        }
        description="Compare certified medical plans, track cashless hospital network coverage, and file instant reimbursement claims."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Building2 size={12} className="text-sky-300" />
              {catalogQ.data?.providers?.length ?? 0} partner insurers
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              {activeEnrollments.length} active {activeEnrollments.length === 1 ? "policy" : "policies"}
            </span>
            {pendingClaims.length > 0 ? (
              <span className={HERO_DANGER_CHIP}>
                <Receipt size={12} />
                {pendingClaims.length} pending claim{pendingClaims.length === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className={HERO_CHIP}>Cashless network · 100+ hospitals</span>
          </>
        }
        actions={
          <>
            <Link href="/patient/insurance/coverage-check" className={HERO_GHOST}>
              <Activity size={13} /> Coverage check
            </Link>
            <Link href="/patient/insurance/marketplace" className={HERO_PRIMARY}>
              <Search size={14} className="text-sky-600" /> Browse plans
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Active policies"
          value={String(activeEnrollments.length)}
          sub={activeEnrollments.length > 0 ? "Coverage in force" : "No cover yet"}
        />
        <StatTile
          icon={<Receipt size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pending claims"
          value={String(pendingClaims.length)}
          sub="Underwriter review"
          pulse={pendingClaims.length > 0}
        />
        <StatTile
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Insurers"
          value={String(catalogQ.data?.providers?.length ?? providers.length)}
          sub="Accredited partners"
        />
        <StatTile
          icon={<Activity size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Coverage check"
          value="Instant"
          sub="Estimate out-of-pocket"
          href="/patient/insurance/coverage-check"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          {/* ── Active policies ────────────────────────────────────────── */}
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={`Your policies (${activeEnrollments.length})`}
              caption="Cashless cover currently in force."
              href="/patient/insurance/marketplace"
              linkLabel="Browse plans"
            />
            {enrollmentsQ.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : activeEnrollments.length === 0 ? (
              <EmptyBlock
                icon={<Shield size={19} />}
                title="No active health insurance policy"
                body="Protect yourself and your family against hospitalization and medical expenses — enrol in a certified plan with cashless admissions in minutes."
                actions={
                  <Link
                    href="/patient/insurance/marketplace"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-bold text-white transition hover:bg-sky-500"
                  >
                    Explore marketplace <ArrowRight size={13} />
                  </Link>
                }
              />
            ) : (
              <div className="mt-5 flex flex-col gap-2.5">
                {activeEnrollments.map((e) => (
                  <Link
                    key={e.id}
                    href={`/patient/insurance/policy/${e.id}`}
                    className="block"
                  >
                    <RailRow
                      tone="emerald"
                      icon={<ShieldCheck size={18} />}
                      title={
                        <>
                          {e.planName ?? e.policyNumber ?? `Policy ${e.id.slice(0, 8)}`}
                          <Badge tone={statusTone(e.status)} className="ml-2 capitalize">
                            {e.status.replace(/_/g, " ")}
                          </Badge>
                        </>
                      }
                      meta={
                        <>
                          {e.providerName ? `${e.providerName} · ` : ""}
                          {formatLkr(e.coverageAmountLkr)} cover · {formatLkr(e.premiumAmountLkr)}/{e.billingCycle}
                          {e.nextPremiumDueAt ? ` · next premium ${formatDate(e.nextPremiumDueAt)}` : ""}
                        </>
                      }
                      trailing={
                        <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Pending claims ─────────────────────────────────────────── */}
          {pendingClaims.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Receipt size={16} />}
                tone="bg-amber-50 text-amber-600"
                title={`Active reimbursement claims (${pendingClaims.length})`}
                caption="Underwriters typically respond within 48–72 hours."
                href="/patient/insurance/claims"
                linkLabel="All claims"
              />
              <div className="mt-5 flex flex-col gap-2.5">
                {pendingClaims.slice(0, 3).map((c) => (
                  <Link key={c.id} href={`/patient/insurance/claims/${c.id}`} className="block">
                    <RailRow
                      tone="amber"
                      icon={<FileText size={18} />}
                      title={
                        <>
                          {c.claimNumber ?? `Claim #${c.id.slice(0, 8)}`}
                          <Badge tone={statusTone(c.status)} className="ml-2 capitalize">
                            {c.status.replace(/_/g, " ")}
                          </Badge>
                        </>
                      }
                      meta={
                        <>
                          {formatLkr(c.amountRequestedLkr)} requested
                          {c.amountApprovedLkr != null ? ` · ${formatLkr(c.amountApprovedLkr)} approved` : ""}
                          {c.providerName ? ` · ${c.providerName}` : ""} · {formatDate(c.createdAt)}
                        </>
                      }
                      trailing={
                        <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      }
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Services ───────────────────────────────────────────────── */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Building2 size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Insurance services"
              caption="Everything you can do with your cover."
            />
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  href: "/patient/insurance/marketplace",
                  icon: Search,
                  tile: "bg-sky-50 text-sky-600",
                  title: "Browse plans",
                  desc: "Compare individual, family & senior plans.",
                },
                {
                  href: "/patient/insurance/coverage-check",
                  icon: Activity,
                  tile: "bg-violet-50 text-violet-600",
                  title: "Coverage check",
                  desc: "Estimate out-of-pocket costs instantly.",
                },
                {
                  href: "/patient/insurance/claims",
                  icon: FileText,
                  tile: "bg-amber-50 text-amber-600",
                  title: "Claims",
                  desc: "Submit bills & track payouts live.",
                },
              ].map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-sm"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tile}`}>
                    <s.icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 group-hover:text-sky-700">
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                      {s.desc}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="ins-tools"
            title="Insurance"
            tools={[
              {
                icon: Building2,
                label: "Marketplace",
                hint: "Compare plans",
                href: "/patient/insurance/marketplace",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ClipboardList,
                label: "Claims",
                hint: "Track payouts",
                href: "/patient/insurance/claims",
                tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
              },
              {
                icon: Activity,
                label: "Check",
                hint: "Coverage",
                href: "/patient/insurance/coverage-check",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          {providers.length > 0 ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Building2 size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="Accredited partners"
                caption="Licensed insurers on the marketplace."
                href="/patient/insurance/marketplace"
                linkLabel="Compare all"
              />
              <div className="mt-5 flex flex-col gap-2">
                {providers.map((p) => (
                  <Link
                    key={p.id}
                    href={`/patient/insurance/marketplace/${p.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-slate-200 hover:shadow-sm"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                      <Building2 size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-sky-700">
                        {p.name}
                      </span>
                      {p.tagline ? (
                        <span className="block truncate text-[11px] text-slate-500">
                          {p.tagline}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
                      <span className="flex items-center gap-1 font-bold text-slate-700">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        {p.ratingAvg.toFixed(1)}
                      </span>
                      {p.claimSettlementRatioPct != null ? (
                        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold ${TONE_BADGE.emerald}`}>
                          <Percent size={9} />
                          {p.claimSettlementRatioPct}% settled
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <PromoCard
            icon={<CheckCircle2 size={21} aria-hidden />}
            kicker="Cashless"
            title="Instant cashless approvals"
            body="Get admitted at 100+ network hospitals without paying upfront — your insurer settles directly."
            href="/patient/insurance/marketplace"
          />
        </div>
      </div>
    </PatientPage>
  );
}
