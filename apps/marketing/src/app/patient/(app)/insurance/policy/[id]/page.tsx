"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  X,
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
  InfoField,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

interface EnrollmentDetail {
  enrollment: {
    id: string;
    policyNumber: string | null;
    status: string;
    billingCycle: string;
    premiumAmountLkr: number;
    coverageAmountLkr: number;
    startDate: string | null;
    endDate: string | null;
    nextPremiumDueAt: string | null;
    lastPremiumPaidAt: string | null;
    kycStatus: string;
    nomineeName: string | null;
    nomineeRelation: string | null;
    nomineeDob: string | null;
    dependents: Array<{ id: string; name: string; relation: string; dob: string | null }>;
    planName?: string;
    planType?: string;
    providerName?: string;
  };
}

const STATUS_TONE: Record<string, Tone> = {
  active: "emerald",
  payment_pending: "amber",
  grace: "amber",
  lapsed: "rose",
  cancelled: "slate",
  expired: "slate",
};

export default function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [now] = useState(() => Date.now());

  const q = useQuery({
    queryKey: ["insurance", "enrollment", id],
    queryFn: () =>
      api<EnrollmentDetail>(`/insurance-marketplace/enrollments/${id}`),
  });

  const renewMut = useMutation({
    mutationFn: () =>
      api<{ checkoutUrl?: string }>(
        `/insurance-marketplace/enrollments/${id}/renew`,
        { method: "POST", json: {} },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance"] }),
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      api(`/insurance-marketplace/enrollments/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance"] });
      window.location.href = "/patient/insurance";
    },
  });

  const e = q.data?.enrollment;

  const dueIn = e?.nextPremiumDueAt
    ? Math.ceil((new Date(e.nextPremiumDueAt).getTime() - now) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = dueIn !== null && dueIn < 0;
  const isDueSoon = dueIn !== null && dueIn >= 0 && dueIn <= 7;

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/insurance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Insurance hub
        </Link>
      </div>

      {q.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      ) : !e ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<ShieldCheck size={19} />}
            title="Policy not found"
            body="This enrollment may have been removed or is not linked to your account."
          />
        </section>
      ) : (
        <>
          <PatientHero
            kickerIcon={<ShieldCheck size={13} aria-hidden />}
            kicker="Insurance"
            kickerMeta={e.providerName ?? "Policy"}
            title={
              <>
                {e.planName ?? "Policy"}{" "}
                <HeroAccent>· {e.policyNumber ?? e.id.slice(0, 8)}</HeroAccent>
              </>
            }
            description={`${e.billingCycle} billing · ${formatLkr(e.premiumAmountLkr)} premium · up to ${formatLkr(e.coverageAmountLkr)} coverage.`}
            chips={
              <>
                <span className={e.status === "active" ? HERO_CHIP : HERO_DANGER_CHIP}>
                  <ShieldCheck size={12} className={e.status === "active" ? "text-emerald-300" : ""} />
                  <span className="capitalize">{e.status.replace(/_/g, " ")}</span>
                </span>
                <span className={HERO_CHIP}>
                  <Building2 size={12} className="text-sky-300" />
                  {e.providerName ?? "Insurer"}
                </span>
                {isOverdue ? (
                  <span className={HERO_DANGER_CHIP}>
                    <AlertTriangle size={12} /> {`${-dueIn}d overdue`}
                  </span>
                ) : isDueSoon ? (
                  <span className={HERO_CHIP}>
                    <AlertTriangle size={12} className="text-amber-300" /> Due in {dueIn}d
                  </span>
                ) : null}
              </>
            }
            actions={
              <>
                <Link href={`/patient/insurance/ecard/${e.id}`} className={HERO_GHOST}>
                  <CreditCard size={13} /> E-card
                </Link>
                <button
                  type="button"
                  onClick={() => renewMut.mutate()}
                  disabled={renewMut.isPending}
                  className={HERO_PRIMARY}
                >
                  <RefreshCw size={14} className={renewMut.isPending ? "animate-spin text-sky-600" : "text-sky-600"} />
                  Renew / pay
                </button>
              </>
            }
          />

          <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              label="Coverage"
              value={formatLkr(e.coverageAmountLkr)}
              sub="Annual sum insured"
            />
            <StatTile
              icon={<Wallet size={16} />}
              tone="bg-sky-50 text-sky-600"
              label="Premium"
              value={formatLkr(e.premiumAmountLkr)}
              sub={`${e.billingCycle} billing`}
            />
            <StatTile
              icon={<Calendar size={16} />}
              tone={isOverdue ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}
              label="Next premium"
              value={e.nextPremiumDueAt ? formatDate(e.nextPremiumDueAt) : "—"}
              sub={isOverdue ? "Overdue" : isDueSoon ? "Due soon" : "On schedule"}
              pulse={isOverdue || isDueSoon}
            />
            <StatTile
              icon={<Users size={16} />}
              tone="bg-violet-50 text-violet-600"
              label="Covered members"
              value={String(e.dependents?.length ?? 0)}
              sub={e.nomineeName ? `Nominee: ${e.nomineeName}` : "No nominee on file"}
            />
          </HeroOverlap>

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex flex-col gap-5 xl:col-span-8">
              {(isDueSoon || isOverdue) && e.status === "active" ? (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-amber-900">
                        {isOverdue ? "Payment overdue" : "Premium due soon"}
                      </div>
                      <div className="mt-0.5 text-sm text-amber-800">
                        {formatLkr(e.premiumAmountLkr)} due{" "}
                        {e.nextPremiumDueAt ? formatDate(e.nextPremiumDueAt) : "soon"}
                        {dueIn !== null
                          ? ` (${isOverdue ? `${-dueIn} days overdue` : `in ${dueIn} days`})`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => renewMut.mutate()}
                    disabled={renewMut.isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-500 disabled:opacity-50"
                  >
                    <CreditCard size={14} /> Pay now
                  </button>
                </section>
              ) : null}

              {renewMut.data?.checkoutUrl ? (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div>
                    <div className="font-bold text-amber-900">Renewal checkout ready</div>
                    <div className="mt-0.5 text-xs text-amber-800">
                      Open payments.lk to complete renewal.
                    </div>
                  </div>
                  <a
                    href={renewMut.data.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-500"
                  >
                    <ExternalLink size={14} /> Open checkout
                  </a>
                </section>
              ) : null}

              <section className={PANEL}>
                <PanelHeader
                  icon={<Calendar size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="Schedule"
                  caption="Premium and coverage dates."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoField icon={<Calendar size={14} />} label="Start date">
                    {e.startDate ? formatDate(e.startDate) : "—"}
                  </InfoField>
                  <InfoField icon={<Calendar size={14} />} label="End date">
                    {e.endDate ? formatDate(e.endDate) : "—"}
                  </InfoField>
                  <InfoField icon={<Wallet size={14} />} label="Last premium paid">
                    {e.lastPremiumPaidAt ? formatDate(e.lastPremiumPaidAt) : "—"}
                  </InfoField>
                  <InfoField icon={<Wallet size={14} />} label="Next premium due">
                    {e.nextPremiumDueAt ? formatDate(e.nextPremiumDueAt) : "—"}
                  </InfoField>
                </div>
              </section>

              {e.dependents && e.dependents.length > 0 ? (
                <section className={PANEL}>
                  <PanelHeader
                    icon={<Users size={16} />}
                    tone="bg-violet-50 text-violet-600"
                    title={`Covered members (${e.dependents.length})`}
                    caption="Dependents on this policy."
                  />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {e.dependents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-[11px] font-bold text-violet-600">
                          {d.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-900">{d.name}</div>
                          <div className="text-[11px] capitalize text-slate-400">
                            {d.relation}
                            {d.dob ? ` · ${formatDate(d.dob)}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {e.status === "active" ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Cancel this policy? This action cannot be undone.")) {
                        cancelMut.mutate();
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                  >
                    <X size={12} /> Cancel policy
                  </button>
                </div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-5 xl:col-span-4">
              <section className={PANEL}>
                <PanelHeader
                  icon={<UserCheck size={16} />}
                  tone="bg-emerald-50 text-emerald-600"
                  title="Nominee"
                  caption="Beneficiary on file."
                />
                {e.nomineeName ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name</span>
                      <span className="font-medium text-slate-900">{e.nomineeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Relation</span>
                      <span className="capitalize text-slate-900">{e.nomineeRelation}</span>
                    </div>
                    {e.nomineeDob ? (
                      <div className="flex justify-between">
                        <span className="text-slate-500">DOB</span>
                        <span className="text-slate-900">{formatDate(e.nomineeDob)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">No nominee on file.</p>
                )}
              </section>

              <section className={PANEL}>
                <PanelHeader
                  icon={<CreditCard size={16} />}
                  tone="bg-sky-50 text-sky-600"
                  title="E-card"
                  caption="Cashless admission pass."
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Present your digital e-card at any network hospital — the insurer settles
                  directly, no upfront payment.
                </p>
                <Link
                  href={`/patient/insurance/ecard/${e.id}`}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500"
                >
                  <ExternalLink size={14} /> View e-card
                </Link>
              </section>

              <QuickToolsPanel
                id="pol-tools"
                title="Insurance"
                tools={[
                  {
                    icon: ShieldCheck,
                    label: "Policies",
                    hint: "My cover",
                    href: "/patient/insurance",
                    tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  },
                  {
                    icon: Building2,
                    label: "Marketplace",
                    hint: "All plans",
                    href: "/patient/insurance/marketplace",
                    tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
                  },
                  {
                    icon: Wallet,
                    label: "Claims",
                    hint: "File & track",
                    href: "/patient/insurance/claims",
                    tone: "from-amber-500 to-orange-500 shadow-amber-500/30",
                  },
                ]}
              />
            </aside>
          </div>
        </>
      )}
    </PatientPage>
  );
}

