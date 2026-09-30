"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
} from "@/patient/components/workspace";

export default function EnrollPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <PatientPage>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </PatientPage>
      }
    >
      <EnrollInner params={params} />
    </Suspense>
  );
}

function EnrollInner({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const cycle = (search.get("cycle") as "monthly" | "annual") ?? "annual";

  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("spouse");
  const [nomineeDob, setNomineeDob] = useState("");
  const [nic, setNic] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const planQ = useQuery({
    queryKey: ["insurance", "plan", planId],
    queryFn: () =>
      api<{
        plan: {
          id: string;
          name: string;
          planType: string;
          monthlyPremiumLkr: number;
          annualPremiumLkr: number;
          coverageSummaryLkr: number;
          providerName: string;
        };
      }>(`/insurance-marketplace/plans/${planId}`),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api<{ enrollment: { id: string } }>(
        "/insurance-marketplace/enrollments",
        {
          method: "POST",
          json: {
            planId,
            billingCycle: cycle,
            nomineeName: nomineeName.trim(),
            nomineeRelation: nomineeRelation.trim(),
            nomineeDob: nomineeDob || undefined,
            acceptTerms: true,
          },
        },
      ),
  });

  const payMut = useMutation({
    mutationFn: (enrollmentId: string) =>
      api<{ checkoutUrl?: string }>(
        `/insurance-marketplace/enrollments/${enrollmentId}/pay`,
        { method: "POST", json: {} },
      ),
  });

  const plan = planQ.data?.plan;
  const premium =
    cycle === "annual" ? plan?.annualPremiumLkr : plan?.monthlyPremiumLkr;

  const submit = async () => {
    if (!acceptTerms || !nomineeName.trim() || !nomineeRelation.trim()) return;
    const created = await createMut.mutateAsync();
    const enrollmentId = created.enrollment.id;
    await payMut.mutateAsync(enrollmentId);
    router.push(`/patient/insurance/payment/${enrollmentId}`);
  };

  const submitting = createMut.isPending || payMut.isPending;
  const canSubmit =
    acceptTerms && !!nomineeName.trim() && !!nomineeRelation.trim() && !submitting;

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href={`/patient/insurance/plans/${planId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Back to plan
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<ShieldCheck size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Direct e-enrollment"
        title={
          <>
            Enrol in <HeroAccent>{plan?.name ?? "this plan"}</HeroAccent>
          </>
        }
        description="Three quick steps — coverage starts as soon as your premium clears via payments.lk."
        chips={
          <>
            <span className={HERO_CHIP}>
              <BadgeCheck size={12} className="text-emerald-300" />
              KYC auto-verified
            </span>
            <span className={HERO_CHIP}>{cycle} billing</span>
            {plan ? <span className={HERO_CHIP}>{plan.providerName}</span> : null}
          </>
        }
      />

      {planQ.isLoading ? (
        <section className={PANEL}>
          <PanelSkeleton rows={3} />
        </section>
      ) : !plan ? (
        <section className={PANEL}>
          <EmptyBlock
            icon={<ShieldCheck size={19} />}
            title="Plan not found"
            body="This plan may no longer be listed in the marketplace."
          />
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
            <section className={PANEL}>
              <PanelHeader
                icon={<BadgeCheck size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="1 · Identity (KYC)"
                caption="Your NIC and DOB are already on file from your account."
                action={
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <Check size={10} /> Auto-verified
                  </span>
                }
              />
              <div className="mt-4">
                <label className={FIELD_LABEL}>National ID (NIC)</label>
                <input
                  className={FIELD_INPUT}
                  value={nic}
                  onChange={(e) => setNic(e.target.value)}
                  placeholder="200012345678"
                />
              </div>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<UserCheck size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="2 · Nominee"
                caption="The person who receives benefits if you can&apos;t."
              />
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label className={FIELD_LABEL}>Full name</label>
                  <input
                    className={FIELD_INPUT}
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>Relation</label>
                    <select
                      value={nomineeRelation}
                      onChange={(e) => setNomineeRelation(e.target.value)}
                      className={FIELD_INPUT}
                    >
                      {["spouse", "parent", "child", "sibling", "other"].map((r) => (
                        <option key={r} value={r}>
                          {r[0].toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>Date of birth (optional)</label>
                    <input
                      type="date"
                      className={FIELD_INPUT}
                      value={nomineeDob}
                      onChange={(e) => setNomineeDob(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className={PANEL}>
              <PanelHeader
                icon={<CreditCard size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="3 · Review &amp; accept"
                caption="Authorise the premium debit via payments.lk."
              />
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-sky-600"
                />
                <span className="text-xs leading-relaxed text-slate-600">
                  I agree to the insurer&apos;s terms, confirm that pre-existing
                  conditions have been truthfully disclosed, and authorise the
                  {cycle === "annual" ? " annual" : " monthly"} premium debit via
                  payments.lk.
                </span>
              </label>

              {createMut.isError || payMut.isError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                  Could not complete enrolment. Please retry.
                </div>
              ) : null}

              <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-6 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {submitting ? "Processing…" : "Submit & pay premium"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-5 xl:col-span-4">
            <section className={cn(PANEL, "border-2 border-sky-100")}>
              <PanelHeader
                icon={<Wallet size={16} />}
                tone="bg-sky-50 text-sky-600"
                title="Plan summary"
                caption={plan.providerName}
              />
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-900">{plan.name}</div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Premium ({cycle})
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {formatLkr(premium ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {cycle === "annual"
                      ? "Save vs monthly"
                      : `${formatLkr(plan.annualPremiumLkr)}/yr option`}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  Up to {formatLkr(plan.coverageSummaryLkr)} coverage
                </div>
              </div>
            </section>

            <PromoCard
              icon={<ShieldCheck size={21} aria-hidden />}
              kicker="Instant"
              title="Coverage activates fast"
              body="E-card issued immediately once the first premium clears at payments.lk."
              href="/patient/insurance"
            />
          </aside>
        </div>
      )}
    </PatientPage>
  );
}
