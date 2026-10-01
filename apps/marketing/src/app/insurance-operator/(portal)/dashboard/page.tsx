"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  useInsuranceOperatorClaims,
  useInsuranceOperatorDashboard,
  useInsuranceOperatorEnrollments,
} from "../../hooks/useApi";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  Badge,
  HeroPulse,
  PanelSkeleton,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  type Tone,
} from "@/patient/components/workspace";
import { formatDate } from "@/portal/lib/format";

const STATUS_TONE: Record<string, Tone> = {
  submitted: "amber",
  under_review: "sky",
  more_info_needed: "violet",
  approved: "emerald",
  rejected: "rose",
  paid: "emerald",
};

function statusLabel(s: string | null | undefined) {
  return (s ?? "unknown").replace(/_/g, " ");
}

export default function InsuranceOperatorDashboard() {
  const { data, isLoading } = useInsuranceOperatorDashboard();
  const stats = data?.stats;

  // Queue preview — most recent submitted claims awaiting review.
  const pendingQuery = useInsuranceOperatorClaims("submitted");
  const pendingClaims = pendingQuery.data?.claims ?? [];
  const queuePreview = pendingClaims.slice(0, 6);

  // Claim rows carry enrollmentId only — resolve claimant names and policy
  // numbers from the enrollments list (shared query cache).
  const enrollmentsQuery = useInsuranceOperatorEnrollments();
  const enrollments = enrollmentsQuery.data?.enrollments ?? [];
  const enrollmentById = new Map(
    enrollments.map((e) => [e.id, { name: e.userName ?? "", policy: e.policyNumber ?? "" }]),
  );
  const claimantName = (c: { enrollmentId: string; patientName?: string | null }) =>
    c.patientName || enrollmentById.get(c.enrollmentId)?.name || "Unknown claimant";
  const policyNumber = (c: { enrollmentId: string; policyNumber?: string | null }) =>
    c.policyNumber || enrollmentById.get(c.enrollmentId)?.policy || "—";

  // The API has no "premium collected" field — show the active premium book.
  const premiumBook = enrollments
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + (e.premiumAmountLkr ?? 0), 0);
  const totalEnrollments = enrollments.length || (stats?.totalEnrollments ?? 0);

  const dateLabel = new Date().toLocaleDateString("en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hero = (
    <DoctorHero
      kicker="Underwriting operations"
      kickerIcon={<ShieldCheck size={12} />}
      kickerMeta={dateLabel}
      title="Insurance command center"
      description="Review inbound claims, approve payouts, and monitor the policyholders covered under your plans."
      chips={
        <>
          <span className={HERO_CHIP}>
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
            </span>
            Adjuster desk live
          </span>
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} /> {stats?.activeEnrollments ?? 0} active policies
          </span>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} /> {stats?.pendingClaims ?? 0} claims awaiting review
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Banknote size={18} />}
          label="Premium book"
          value={`LKR ${premiumBook.toLocaleString()}`}
          sub={premiumBook > 0 ? "Active recurring premium" : "No active premium yet"}
        />
      }
      actions={
        <>
          <Link href="/insurance-operator/enrollments" className={HERO_GHOST}>
            <Users size={14} /> Enrollments
          </Link>
          <Link href="/insurance-operator/claims?status=submitted" className={HERO_PRIMARY}>
            Review queue
            {(stats?.pendingClaims ?? 0) > 0 ? (
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-800">
                {stats?.pendingClaims}
              </span>
            ) : null}
            <ArrowRight size={14} />
          </Link>
        </>
      }
    />
  );

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-6">
        {hero}
        <HeroOverlap>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[112px] animate-pulse rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
              />
            ))}
          </div>
        </HeroOverlap>
        <PanelSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hero}

      {/* ── Floating stat strip ── */}
      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            href="/insurance-operator/enrollments"
            label="Total enrollments"
            icon={<ShieldCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(totalEnrollments)}
            sub="Policies issued"
          />
          <StatTile
            href="/insurance-operator/enrollments"
            label="Active policies"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(stats?.activeEnrollments ?? 0)}
            sub="In-force coverage"
          />
          <StatTile
            href="/insurance-operator/claims?status=submitted"
            label="Pending claims"
            icon={<ClipboardList size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(stats?.pendingClaims ?? 0)}
            sub="Awaiting adjudication"
            pulse={(stats?.pendingClaims ?? 0) > 0}
            badge={
              (stats?.pendingClaims ?? 0) > 0
                ? { text: "Needs action", tone: "bg-amber-50 text-amber-700" }
                : { text: "Clear", tone: "bg-emerald-50 text-emerald-700" }
            }
          />
          <StatTile
            href="/insurance-operator/claims?status=approved"
            label="Settled (MTD)"
            icon={<Banknote size={16} />}
            tone="bg-indigo-50 text-indigo-600"
            value={String(stats?.approvedClaimsMtd ?? 0)}
            sub="Payouts sent this month"
          />
        </div>
      </HeroOverlap>

      {/* ── Operations grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${PANEL} xl:col-span-2`}>
          <PanelHeader
            icon={<ClipboardCheck size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Claims awaiting review"
            caption={
              pendingClaims.length > 0
                ? `Showing ${queuePreview.length} of ${pendingClaims.length} submitted claims`
                : "Newly submitted claims appear here first"
            }
            href="/insurance-operator/claims"
            linkLabel="Open queue"
          />
          {pendingQuery.isLoading ? (
            <ul className="mt-4 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-50" />
              ))}
            </ul>
          ) : queuePreview.length === 0 ? (
            <EmptyBlock
              icon={<ClipboardCheck size={19} />}
              title="Queue synchronized & clear"
              body="No submitted claims are waiting. New reimbursements will stream here as policyholders file them."
              actions={
                <Link
                  href="/insurance-operator/claims"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  View all claims
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {queuePreview.map((c) => (
                <li key={c.id}>
                  <RailRow
                    tone={STATUS_TONE[c.status] ?? "slate"}
                    icon={<FileText size={15} />}
                    title={
                      <span className="flex items-center gap-2">
                        {claimantName(c)}
                        <Badge tone={STATUS_TONE[c.status] ?? "slate"}>{statusLabel(c.status)}</Badge>
                      </span>
                    }
                    meta={`Policy ${policyNumber(c)} · ${statusLabel(c.treatmentType)}${
                      c.createdAt ? ` · ${formatDate(c.createdAt)}` : ""
                    }`}
                    trailing={
                      <>
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          LKR {(c.amountRequestedLkr ?? 0).toLocaleString()}
                        </span>
                        <Link
                          href={`/insurance-operator/claims/${c.id}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          aria-label={`Review claim for ${claimantName(c)}`}
                        >
                          <ChevronRight size={15} />
                        </Link>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Quick jumps */}
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[11.5px] text-slate-400">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Quick jumps:</span>
            <Link href="/insurance-operator/claims?status=submitted" className="hover:text-slate-700 hover:underline underline-offset-2">
              Pending review
            </Link>
            <span>·</span>
            <Link href="/insurance-operator/claims?status=more_info_needed" className="hover:text-slate-700 hover:underline underline-offset-2">
              Needs info
            </Link>
            <span>·</span>
            <Link href="/insurance-operator/enrollments" className="hover:text-slate-700 hover:underline underline-offset-2">
              Policy book
            </Link>
          </div>
        </section>

        {/* ── Aside: quick tools + settlement telemetry ── */}
        <aside className="flex flex-col gap-4">
          <QuickToolsPanel
            id="ins-quick-tools"
            title="Adjuster workflows"
            tag="One click"
            tools={[
              {
                href: "/insurance-operator/claims?status=submitted",
                label: "Pending claims",
                hint: `${stats?.pendingClaims ?? 0} to review`,
                icon: ClipboardList,
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                href: "/insurance-operator/claims?status=approved",
                label: "Approved",
                hint: `${stats?.approvedClaimsMtd ?? 0} this month`,
                icon: CheckCircle2,
                tone: "from-emerald-500 to-emerald-700 shadow-emerald-500/30",
              },
              {
                href: "/insurance-operator/enrollments",
                label: "Enrollments",
                hint: `${stats?.activeEnrollments ?? 0} active`,
                icon: ShieldCheck,
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                href: "/insurance-operator/claims?status=more_info_needed",
                label: "Needs info",
                hint: "Awaiting claimant docs",
                icon: FileText,
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<Landmark size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Settlement ledger"
              caption="Month-to-date payout summary"
              action={<Badge tone="emerald">Live</Badge>}
            />
            <ul className="mt-4 space-y-2.5 text-[12.5px]">
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Premium collected</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  LKR {premiumBook.toLocaleString()}
                </span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Payouts settled</span>
                <span className="font-semibold tabular-nums text-emerald-700">
                  {stats?.approvedClaimsMtd ?? 0} MTD
                </span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Providers on book</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {stats?.totalProviders ?? 0}
                </span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Policy retention</span>
                <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                  <ShieldCheck size={13} />
                  {totalEnrollments
                    ? `${Math.round(((stats?.activeEnrollments ?? 0) / totalEnrollments) * 100)}%`
                    : "—"}
                </span>
              </li>
            </ul>
          </section>

          <PromoCard
            kicker="Claims integrity"
            title="Every decision is audit-logged"
            body={`${totalEnrollments} policyholders see adjudication outcomes in real time.`}
            href="/insurance-operator/claims"
            icon={<ClipboardCheck size={20} />}
          />
        </aside>
      </div>
    </div>
  );
}
