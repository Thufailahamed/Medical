"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Hospital,
  Package,
  Pencil,
  Percent,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { adminApi } from "@/portal/lib/admin-api";
import { formatLkr } from "@/portal/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HeroOverlap,
  PANEL,
  PRIMARY_BTN,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { humanize } from "@/portal/components/admin/AdminDirectory";
import {
  FormField,
  MKT_INPUT,
  PLAN_TYPE_TONE,
  Toggle,
  enrollmentTone,
  lkrCompact,
  parseList,
  useMktEnrollments,
  useMktPlans,
  type MktPlan,
} from "@/portal/components/admin/insurance-mkt";

export default function AdminInsurancePlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useMktPlans();
  const { data: enrData } = useMktEnrollments();
  const [editing, setEditing] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => adminApi(`/admin/insurance-plans/${id}`, { method: "PUT", json: patch }),
    onSuccess: (_, patch) => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-plans"] });
      if ("isPublished" in patch) toast.success(patch.isPublished ? "Plan published" : "Plan unpublished");
      else if ("isFeatured" in patch) toast.success(patch.isFeatured ? "Plan featured" : "Removed from featured");
      else {
        toast.success("Plan updated");
        setEditing(false);
      }
    },
    onError: (e: unknown) => toast.error("Update failed", e instanceof Error ? e.message : undefined),
  });

  const back = (
    <Link href="/admin/insurance-mkt/plans" className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700">
      <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
      Back to plans
    </Link>
  );

  const plan = data?.plans.find((x) => x.id === id);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6" role="status" aria-label="Loading">
        {back}
        <div className="h-56 animate-pulse rounded-[20px] bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 [&_a:hover]:no-underline">
        {back}
        <div className={PANEL}>
          <EmptyBlock className="mt-0" icon={<Package size={19} />} title="Plan not found" body="It may have been removed, or the link is out of date." />
        </div>
      </div>
    );
  }

  const enrollments = (enrData?.enrollments ?? []).filter((e) => e.planId === id);
  const active = enrollments.filter((e) => e.status === "active").length;
  const features = parseList(plan.keyFeaturesJson);
  const exclusions = parseList(plan.exclusionsJson);
  const coverage = parseList(plan.coverageDetailsJson);
  const annualSaving = plan.monthlyPremiumLkr * 12 - plan.annualPremiumLkr;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {back}

      <div>
        <DoctorHero
          leading={
            <span className="grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-[0_12px_32px_-8px_rgba(139,92,246,0.6)] ring-1 ring-inset ring-white/25">
              <Package size={32} strokeWidth={1.75} />
            </span>
          }
          kickerIcon={<Package size={13} aria-hidden />}
          kicker={humanize(plan.planType)}
          kickerMeta={plan.providerName}
          title={plan.name}
          description={`${formatLkr(plan.monthlyPremiumLkr)} a month · ${lkrCompact(plan.coverageSummaryLkr)} cover · ${plan.termMonths ?? 12}-month term`}
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className={cn("h-2 w-2 rounded-full", plan.isPublished ? "bg-emerald-400" : "bg-slate-400")} aria-hidden />
                {plan.isPublished ? "Live in marketplace" : "Draft"}
              </span>
              {plan.isFeatured ? (
                <span className={HERO_CHIP}>
                  <Sparkles size={12} className="text-amber-300" aria-hidden />
                  Featured
                </span>
              ) : null}
              <Link href={`/admin/insurance-mkt/providers/${plan.providerId}`} className={cn(HERO_CHIP, "transition-colors hover:bg-white/10")}>
                <Building2 size={12} aria-hidden />
                {plan.providerName}
              </Link>
            </>
          }
          aside={
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur">
              <label className="flex items-center justify-between gap-6 text-xs font-semibold text-white/85">
                Published
                <Toggle checked={plan.isPublished} onChange={(v) => save.mutate({ isPublished: v })} label="Published" disabled={save.isPending} />
              </label>
              <label className="flex items-center justify-between gap-6 text-xs font-semibold text-white/85">
                Featured
                <Toggle checked={plan.isFeatured} onChange={(v) => save.mutate({ isFeatured: v })} label="Featured" disabled={save.isPending} />
              </label>
            </div>
          }
        />
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Monthly premium" icon={<Wallet size={16} />} tone="bg-sky-50 text-sky-600" value={formatLkr(plan.monthlyPremiumLkr)} sub="Billed monthly" />
          <StatTile
            label="Annual premium"
            icon={<CalendarClock size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={formatLkr(plan.annualPremiumLkr)}
            sub={annualSaving > 0 ? `Saves ${formatLkr(annualSaving)} a year` : "Billed yearly"}
            badge={plan.annualDiscountPct ? { text: `−${plan.annualDiscountPct}%`, tone: "bg-emerald-50 text-emerald-700" } : undefined}
          />
          <StatTile label="Coverage" icon={<ShieldCheck size={16} />} tone="bg-violet-50 text-violet-600" value={lkrCompact(plan.coverageSummaryLkr)} sub={`${plan.networkHospitalCount ?? 0} network hospitals`} />
          <StatTile label="Enrolled" icon={<Users size={16} />} tone="bg-amber-50 text-amber-600" value={String(enrollments.length)} sub={`${active} active`} progress={enrollments.length ? Math.round((active / enrollments.length) * 100) : null} />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Terms */}
          <section className={PANEL} aria-labelledby="pl-terms">
            <PanelHeader
              id="pl-terms"
              icon={<Percent size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Pricing & terms"
              caption="What the patient pays and when cover starts"
              action={
                !editing ? (
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                    <Pencil size={12} />
                    Edit
                  </button>
                ) : undefined
              }
            />
            {editing ? (
              <PlanEditForm plan={plan} saving={save.isPending} onCancel={() => setEditing(false)} onSave={(patch) => save.mutate(patch)} />
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {[
                  { icon: <Wallet size={15} />, label: "Deductible", value: formatLkr(plan.deductibleLkr ?? 0) },
                  { icon: <Percent size={15} />, label: "Co-pay", value: `${plan.copayPct ?? 0}%` },
                  { icon: <Wallet size={15} />, label: "Co-pay cap", value: plan.coPaymentCapLkr ? formatLkr(plan.coPaymentCapLkr) : "No cap" },
                  { icon: <Clock size={15} />, label: "Waiting period", value: `${plan.waitingPeriodDays ?? 0} days` },
                  { icon: <Clock size={15} />, label: "Pre-existing wait", value: `${plan.preExistingWaitingDays ?? 0} days` },
                  { icon: <Hospital size={15} />, label: "Network hospitals", value: String(plan.networkHospitalCount ?? 0) },
                ].map((t) => (
                  <div key={t.label} className="rounded-xl bg-slate-50 p-3.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">{t.icon}</span>
                    <p className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-slate-900 tabular-nums">{t.value}</p>
                    <p className="text-[11px] text-slate-400">{t.label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Features / exclusions */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className={PANEL} aria-labelledby="pl-feat">
              <PanelHeader id="pl-feat" icon={<Check size={16} />} tone="bg-emerald-50 text-emerald-600" title="Key features" caption={`${features.length} listed`} />
              <List items={features.length ? features : coverage} empty="No features listed" icon={<Check size={11} strokeWidth={3} />} tone="bg-emerald-500" />
            </section>
            <section className={PANEL} aria-labelledby="pl-excl">
              <PanelHeader id="pl-excl" icon={<X size={16} />} tone="bg-red-50 text-red-600" title="Exclusions" caption={`${exclusions.length} listed`} />
              <List items={exclusions} empty="No exclusions listed" icon={<X size={11} strokeWidth={3} />} tone="bg-red-400" />
            </section>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:col-span-4" aria-label="Policyholders">
          <section className={PANEL} aria-labelledby="pl-enr">
            <PanelHeader id="pl-enr" icon={<Users size={16} />} tone="bg-amber-50 text-amber-600" title="Policyholders" caption={`${enrollments.length} enrolled`} href="/admin/insurance-mkt/enrollments" linkLabel="All" />
            {enrollments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">Nobody has enrolled in this plan yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {enrollments.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/users/${e.userId}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", enrollmentTone(e.status).rail)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">{e.userName}</span>
                        <span className="block truncate font-mono text-[10.5px] text-slate-400">{e.policyNumber ?? "—"}</span>
                      </span>
                      <Pill tone={enrollmentTone(e.status).pill}>{humanize(e.status)}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href={`/admin/insurance-mkt/providers/${plan.providerId}`}
            className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-semibold text-white shadow-sm shadow-amber-500/30">
              {(plan.providerName ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Provider</span>
              <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{plan.providerName}</span>
            </span>
            <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
          </Link>

          <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]", PLAN_TYPE_TONE[plan.planType] ?? "bg-slate-100 text-slate-600")}>
            <Star size={12} />
            {humanize(plan.planType)} plan · slug <span className="font-mono">{plan.slug}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function List({ items, empty, icon, tone }: { items: string[]; empty: string; icon: React.ReactNode; tone: string }) {
  if (!items.length) return <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">{empty}</p>;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-700">
          <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-white", tone)}>{icon}</span>
          {it}
        </li>
      ))}
    </ul>
  );
}

function PlanEditForm({
  plan,
  saving,
  onCancel,
  onSave,
}: {
  plan: MktPlan;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const fields = [
    ["name", "Plan name", "text"],
    ["monthlyPremiumLkr", "Monthly premium (LKR)", "number"],
    ["annualPremiumLkr", "Annual premium (LKR)", "number"],
    ["coverageSummaryLkr", "Coverage (LKR)", "number"],
    ["deductibleLkr", "Deductible (LKR)", "number"],
    ["copayPct", "Co-pay %", "number"],
    ["waitingPeriodDays", "Waiting period (days)", "number"],
    ["preExistingWaitingDays", "Pre-existing wait (days)", "number"],
    ["networkHospitalCount", "Network hospitals", "number"],
  ] as const;
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([k]) => [k, String(plan[k] ?? "")])),
  );

  const submit = () => {
    const patch: Record<string, unknown> = {};
    for (const [k, , type] of fields) {
      const raw = f[k].trim();
      if (raw === "") continue;
      const v = type === "number" ? Number(raw) : raw;
      if (type === "number" && !isFinite(v as number)) continue;
      if (v !== plan[k]) patch[k] = k.endsWith("Days") || k === "networkHospitalCount" ? Math.round(v as number) : v;
    }
    if (!Object.keys(patch).length) return onCancel();
    onSave(patch);
  };

  return (
    <div className="mt-5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
        {fields.map(([k, label, type]) => (
          <FormField key={k} label={label} className={k === "name" ? "sm:col-span-2 md:col-span-3" : undefined}>
            <input className={MKT_INPUT} type={type} min={type === "number" ? 0 : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </FormField>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] hover:text-slate-900">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving} className={PRIMARY_BTN}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
