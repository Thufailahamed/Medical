"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HERO_CHIP,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
} from "@/patient/components/workspace";

interface EnrollmentDetail {
  enrollment: {
    id: string;
    status: string;
    policyNumber: string | null;
    premiumAmountLkr: number;
    coverageAmountLkr: number;
    billingCycle: string;
  };
}

export default function PaymentPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = use(params);

  const q = useQuery({
    queryKey: ["insurance", "enrollment", enrollmentId],
    queryFn: () =>
      api<EnrollmentDetail>(
        `/insurance-marketplace/enrollments/${enrollmentId}`,
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.enrollment.status;
      // poll while still pending payment
      return status === "payment_pending" ? 5_000 : false;
    },
  });

  const payTrigger = usePayTrigger(enrollmentId);
  const e = q.data?.enrollment;
  const isPending = e?.status === "payment_pending";

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

      <PatientHero
        overlap={false}
        kickerIcon={<CreditCard size={13} aria-hidden />}
        kicker="Insurance"
        kickerMeta="Premium payment"
        title={
          <>
            Pay your <HeroAccent>premium</HeroAccent>
          </>
        }
        description="Complete the premium payment via payments.lk secure checkout — coverage activates as soon as it clears."
        chips={
          <>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              payments.lk secure checkout
            </span>
            {isPending ? <span className={HERO_CHIP}>Auto-verifying every 5s</span> : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {q.isLoading ? (
            <section className={PANEL}>
              <PanelSkeleton rows={3} />
            </section>
          ) : !e ? (
            <section className={PANEL}>
              <EmptyBlock
                icon={<CreditCard size={19} />}
                title="Policy not found"
                body="This enrollment may have been removed or is not linked to your account."
              />
            </section>
          ) : (
            <section className={PANEL}>
              <PanelHeader
                icon={<Wallet size={16} />}
                tone="bg-sky-50 text-sky-600"
                title={`Policy ${e.policyNumber ?? e.id.slice(0, 8)}`}
                caption={`${e.billingCycle} billing`}
                action={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      isPending
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {isPending ? "Payment pending" : "Active"}
                  </span>
                }
              />

              <div className="mt-4 rounded-2xl bg-slate-50 p-5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Amount due ({e.billingCycle})
                </div>
                <div className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                  {formatLkr(e.premiumAmountLkr)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Coverage up to {formatLkr(e.coverageAmountLkr)}
                </div>
              </div>

              {payTrigger.checkoutUrl ? (
                <div className="mt-5 space-y-3">
                  <p className="text-sm text-slate-600">
                    Opening payments.lk secure checkout. You&apos;ll be redirected back to
                    your policy page once payment clears.
                  </p>
                  <a
                    href={payTrigger.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-bold text-white transition hover:bg-sky-500"
                  >
                    <ExternalLink size={15} /> Open payments.lk checkout
                  </a>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => payTrigger.refetch()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 transition hover:text-sky-600"
                    >
                      <RefreshCw size={12} className={payTrigger.isFetching ? "animate-spin" : ""} />
                      I&apos;ve paid — verify
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => payTrigger.refetch()}
                    disabled={payTrigger.isFetching}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={payTrigger.isFetching ? "animate-spin" : ""} />
                    Generate checkout
                  </button>
                </div>
              )}

              {isPending ? (
                <p className="mt-4 text-center text-[11px] text-slate-400">
                  Status auto-refreshes every 5 seconds.
                </p>
              ) : null}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-5">
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Secure checkout"
              caption="How payment works."
            />
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-500">
              <li className="flex items-start gap-2">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                Payment is processed by payments.lk — card details never touch this app.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                Your e-card is issued automatically once the premium clears.
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                Cancel any time before paying — no amount is charged.
              </li>
            </ul>
          </section>

          <QuickToolsPanel
            id="pay-tools"
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
    </PatientPage>
  );
}

function usePayTrigger(enrollmentId: string) {
  const q = useQuery({
    queryKey: ["insurance", "pay", enrollmentId],
    queryFn: () =>
      api<{ checkoutUrl?: string; status?: string }>(
        `/insurance-marketplace/enrollments/${enrollmentId}/pay`,
        { method: "POST", json: {} },
      ),
    enabled: false,
    retry: false,
  });
  return {
    checkoutUrl: q.data?.checkoutUrl,
    refetch: q.refetch,
    isFetching: q.isFetching,
  };
}
