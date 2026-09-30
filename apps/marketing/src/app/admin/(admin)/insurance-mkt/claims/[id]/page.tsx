"use client";

import { use } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Hash,
  Info,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserRound,
  XCircle,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { InfoField, humanize } from "@/portal/components/admin/AdminDirectory";
import {
  claimTone,
  enrollmentTone,
  lkrCompact,
  useMktClaims,
  useMktEnrollments,
} from "@/portal/components/admin/insurance-mkt";

const STAGES = ["submitted", "under_review", "decision", "paid"] as const;

/** Map a claim status onto the 4-stage progress track. */
function stageIndex(status: string) {
  switch (status) {
    case "submitted":
      return 0;
    case "under_review":
    case "more_info_needed":
      return 1;
    case "approved":
    case "rejected":
      return 2;
    case "paid":
      return 3;
    default:
      return 0;
  }
}

export default function AdminMarketplaceClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useMktClaims();
  const { data: enrData } = useMktEnrollments();

  const back = (
    <Link href="/admin/insurance-mkt/claims" className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700">
      <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
      Back to claims
    </Link>
  );

  const c = data?.claims.find((x) => x.id === id);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6" role="status" aria-label="Loading">
        {back}
        <div className="h-56 animate-pulse rounded-[20px] bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 [&_a:hover]:no-underline">
        {back}
        <div className={PANEL}>
          <EmptyBlock className="mt-0" icon={<Receipt size={19} />} title="Claim not found" body="It may have been removed, or the link is out of date." />
        </div>
      </div>
    );
  }

  const tone = claimTone(c.status);
  const enrollment = enrData?.enrollments.find((e) => e.id === c.enrollmentId);
  const approved = c.amountApprovedLkr ?? null;
  const approvedPct = approved != null && c.amountRequestedLkr ? Math.round((approved / c.amountRequestedLkr) * 100) : null;
  const shortfall = approved != null ? c.amountRequestedLkr - approved : null;
  const current = stageIndex(c.status);
  const rejected = c.status === "rejected";
  const otherClaims = (data?.claims ?? []).filter((x) => x.enrollmentId === c.enrollmentId && x.id !== c.id);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {back}

      <div>
        <DoctorHero
          leading={
            <span className="grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/25">
              <Receipt size={32} strokeWidth={1.75} />
            </span>
          }
          kickerIcon={<Receipt size={13} aria-hidden />}
          kicker="Marketplace claim"
          kickerMeta={`#${c.id.slice(0, 8)}`}
          title={`${humanize(c.treatmentType)} claim`}
          description={`${c.patientName} · ${c.providerName}${c.policyNumber ? ` · Policy ${c.policyNumber}` : ""}`}
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className={cn("h-2 w-2 rounded-full", tone.rail)} aria-hidden />
                {humanize(c.status)}
              </span>
              {c.submittedAt ? (
                <span className={HERO_CHIP}>
                  <CalendarDays size={12} className="text-sky-300" aria-hidden />
                  Filed {new Date(c.submittedAt).toLocaleDateString()}
                </span>
              ) : null}
            </>
          }
          actions={
            <Link href={`/admin/users/${c.userId}`} className={HERO_PRIMARY}>
              <UserRound size={15} className="text-sky-600" aria-hidden />
              Policyholder
            </Link>
          }
        />
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Requested" icon={<Banknote size={16} />} tone="bg-sky-50 text-sky-600" value={formatLkr(c.amountRequestedLkr)} sub="Amount claimed" />
          <StatTile
            label="Approved"
            icon={<Check size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={approved != null ? formatLkr(approved) : "—"}
            sub={approvedPct != null ? `${approvedPct}% of request` : "Not decided yet"}
            progress={approvedPct}
          />
          <StatTile
            label="Shortfall"
            icon={<AlertTriangle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={shortfall != null ? formatLkr(Math.max(0, shortfall)) : "—"}
            sub={shortfall != null ? "Patient pays the difference" : "Pending decision"}
          />
          <StatTile
            label="Policy cover"
            icon={<ShieldCheck size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={enrollment ? lkrCompact(enrollment.coverageAmountLkr) : "—"}
            sub={enrollment ? `${Math.round((c.amountRequestedLkr / Math.max(1, enrollment.coverageAmountLkr)) * 100)}% used by this claim` : "Policy not found"}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Progress */}
          <section className={PANEL} aria-labelledby="cl-progress">
            <PanelHeader id="cl-progress" icon={<ClipboardList size={16} />} tone="bg-sky-50 text-sky-600" title="Claim progress" caption={c.status === "more_info_needed" ? "Insurer is waiting on more information from the patient" : `Currently ${humanize(c.status).toLowerCase()}`} />
            <ol className="mt-6 grid grid-cols-4 gap-2">
              {STAGES.map((stage, i) => {
                const done = i < current || (i === current && ["approved", "paid"].includes(c.status));
                const isCurrent = i === current;
                const failed = rejected && stage === "decision";
                const label =
                  stage === "decision" ? (rejected ? "Rejected" : c.status === "approved" || c.status === "paid" ? "Approved" : "Decision") : humanize(stage);
                return (
                  <li key={stage} className="flex flex-col items-center text-center">
                    <div className="relative flex w-full items-center">
                      <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-sky-400" : "bg-slate-200")} />
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-all",
                          failed
                            ? "bg-red-500 shadow-lg shadow-red-500/30"
                            : done
                              ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                              : isCurrent
                                ? "bg-sky-500 shadow-lg shadow-sky-500/30 ring-4 ring-sky-100"
                                : "bg-slate-200 text-slate-400",
                        )}
                      >
                        {failed ? <XCircle size={16} /> : done ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </span>
                      <span className={cn("h-0.5 flex-1", i === STAGES.length - 1 ? "bg-transparent" : i < current ? "bg-sky-400" : "bg-slate-200")} />
                    </div>
                    <span className={cn("mt-2 text-xs font-semibold", isCurrent ? "text-slate-900" : "text-slate-400")}>{label}</span>
                  </li>
                );
              })}
            </ol>
            {c.status === "more_info_needed" ? (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50/80 p-3.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/15">
                <Info size={14} className="mt-0.5 shrink-0" />
                The insurer has asked the policyholder for more documents. The claim resumes once they respond in the app.
              </div>
            ) : null}
          </section>

          {/* Details */}
          <section className={PANEL} aria-labelledby="cl-details">
            <PanelHeader id="cl-details" icon={<Receipt size={16} />} tone="bg-violet-50 text-violet-600" title="Claim details" />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<Stethoscope size={15} />} label="Treatment">{humanize(c.treatmentType)}</InfoField>
              <InfoField icon={<CalendarDays size={15} />} label="Submitted">{c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "—"}</InfoField>
              <InfoField icon={<Hash size={15} />} label="Policy number" mono copyValue={c.policyNumber}>{c.policyNumber || "—"}</InfoField>
              <InfoField icon={<Hash size={15} />} label="Claim ID" mono copyValue={c.id}>{c.id}</InfoField>
            </dl>
            <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
              <Info size={11} className="mt-0.5 shrink-0" />
              Decisions are made by the insurer in the insurance operator portal. Admins have read-only oversight here.
            </p>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:col-span-4" aria-label="Policy">
          <section className={PANEL} aria-labelledby="cl-policy">
            <PanelHeader id="cl-policy" icon={<ShieldCheck size={16} />} tone="bg-emerald-50 text-emerald-600" title="Policy" caption={enrollment ? enrollment.planName : "Enrollment not found"} />
            {enrollment ? (
              <>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Pill tone={enrollmentTone(enrollment.status).pill}>{humanize(enrollment.status)}</Pill>
                  <span className="font-mono text-[11px] text-slate-400">{enrollment.policyNumber}</span>
                </div>
                <ul className="mt-4 flex flex-col gap-2 text-[13px]">
                  <li className="flex justify-between gap-2"><span className="text-slate-400">Premium</span><span className="font-medium tabular-nums text-slate-900">{formatLkr(enrollment.premiumAmountLkr)} / {enrollment.billingCycle === "monthly" ? "mo" : "yr"}</span></li>
                  <li className="flex justify-between gap-2"><span className="text-slate-400">Coverage</span><span className="font-medium tabular-nums text-slate-900">{formatLkr(enrollment.coverageAmountLkr)}</span></li>
                  {enrollment.startDate ? <li className="flex justify-between gap-2"><span className="text-slate-400">Started</span><span className="font-medium text-slate-900">{new Date(enrollment.startDate).toLocaleDateString()}</span></li> : null}
                </ul>
                <Link href={`/admin/insurance-mkt/plans/${enrollment.planId}`} className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700">
                  View plan
                  <ChevronRight size={14} />
                </Link>
              </>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">The linked enrollment couldn&apos;t be loaded.</p>
            )}
          </section>

          <Link
            href={`/admin/insurance-mkt/providers/${c.providerId}`}
            className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/30">
              <Building2 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Insurer</span>
              <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{c.providerName}</span>
            </span>
            <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
          </Link>

          {otherClaims.length ? (
            <section className={PANEL} aria-labelledby="cl-other">
              <PanelHeader id="cl-other" icon={<Receipt size={16} />} tone="bg-sky-50 text-sky-600" title="Other claims on this policy" caption={`${otherClaims.length} more`} />
              <ul className="mt-4 flex flex-col gap-0.5">
                {otherClaims.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/insurance-mkt/claims/${o.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", claimTone(o.status).rail)} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">{humanize(o.treatmentType)}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{lkrCompact(o.amountRequestedLkr)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
