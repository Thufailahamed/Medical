"use client";

import { Suspense, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, Check, ChevronRight } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Pill } from "@/portal/components/ui/Pill";
import { Input, Field } from "@/portal/components/ui/Form";
import { Skeleton } from "@/portal/components/ui/Empty";
import { formatLkr } from "@/portal/lib/format";

export default function EnrollPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
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

  if (planQ.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!plan) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">Plan not found.</p>
      </Card>
    );
  }

  const premium =
    cycle === "annual" ? plan.annualPremiumLkr : plan.monthlyPremiumLkr;

  const submit = async () => {
    if (!acceptTerms || !nomineeName.trim() || !nomineeRelation.trim()) return;
    const created = await createMut.mutateAsync();
    const enrollmentId = created.enrollment.id;
    await payMut.mutateAsync(enrollmentId);
    router.push(`/portal/me/insurance/payment/${enrollmentId}`);
  };

  const submitting = createMut.isPending || payMut.isPending;
  const canSubmit =
    acceptTerms &&
    !!nomineeName.trim() &&
    !!nomineeRelation.trim() &&
    !submitting;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-text">Enrol in this plan</h1>
        <p className="text-sm text-text-soft mt-0.5">
          Three quick steps. Coverage starts as soon as your premium clears.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5 min-w-0">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h2 className="font-bold text-text">Identity (KYC)</h2>
              <Pill tone="success" className="ml-auto">
                <Check size={10} />
                Auto-verified
              </Pill>
            </div>
            <Field label="National ID (NIC)">
              <Input
                value={nic}
                onChange={(e) => setNic(e.target.value)}
                placeholder="200012345678"
              />
            </Field>
            <p className="text-[11px] text-text-muted">
              Your NIC and DOB are already on file from your account.
            </p>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h2 className="font-bold text-text">Nominee</h2>
            </div>
            <Field label="Full name">
              <Input
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relation">
                <select
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                >
                  {[
                    "spouse",
                    "parent",
                    "child",
                    "sibling",
                    "other",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date of birth (optional)">
                <Input
                  type="date"
                  value={nomineeDob}
                  onChange={(e) => setNomineeDob(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h2 className="font-bold text-text">Review &amp; accept</h2>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-text-soft">
                I agree to the insurer&apos;s terms, confirm that pre-existing
                conditions have been truthfully disclosed, and authorise the
                {cycle === "annual" ? " annual" : " monthly"} premium debit via
                PayHere.
              </span>
            </label>
          </Card>

          {(createMut.isError || payMut.isError) && (
            <Card className="border-red-200 bg-red-50/40">
              <p className="text-sm text-red-700">
                Could not complete enrolment. Please retry.
              </p>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={submit}
              disabled={!canSubmit}
              loading={submitting}
              size="lg"
            >
              Submit &amp; pay premium
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="border-2 border-brand/20">
            <div className="text-xs text-text-soft">Plan summary</div>
            <div className="font-bold text-text mt-1">{plan.name}</div>
            <div className="text-xs text-text-soft mt-0.5">
              {plan.providerName}
            </div>
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="text-[11px] uppercase tracking-widest text-text-muted font-bold">
                Premium ({cycle})
              </div>
              <div className="text-2xl font-bold text-brand-strong">
                {formatLkr(premium)}
              </div>
              <div className="text-[11px] text-text-muted">
                {cycle === "annual"
                  ? `Save vs monthly`
                  : `${formatLkr(plan.annualPremiumLkr)}/yr option`}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs text-text-soft">
              <ShieldCheck size={12} className="text-emerald-600" />
              Up to {formatLkr(plan.coverageSummaryLkr)} coverage
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}