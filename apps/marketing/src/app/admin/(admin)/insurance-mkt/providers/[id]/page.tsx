"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgePercent,
  Building2,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  Globe,
  Hash,
  Hospital,
  Package,
  Pencil,
  Phone,
  Receipt,
  ShieldCheck,
  Star,
  Users,
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
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PRIMARY_BTN,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { InfoField, humanize } from "@/portal/components/admin/AdminDirectory";
import {
  FormField,
  MKT_INPUT,
  PLAN_TYPE_TONE,
  claimTone,
  enrollmentTone,
  lkrCompact,
  useMktClaims,
  useMktEnrollments,
  useMktPlans,
  useMktProviders,
  type MktProvider,
} from "@/portal/components/admin/insurance-mkt";

export default function AdminInsuranceProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useMktProviders();
  const { data: plansData } = useMktPlans(id);
  const { data: enrData } = useMktEnrollments();
  const { data: claimData } = useMktClaims();
  const [editing, setEditing] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      adminApi(`/admin/insurance-providers/${id}`, { method: "PUT", json: patch }),
    onSuccess: (_, patch) => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-providers"] });
      if ("isPublished" in patch) toast.success(patch.isPublished ? "Provider published" : "Provider unpublished");
      else {
        toast.success("Provider updated");
        setEditing(false);
      }
    },
    onError: (e: unknown) => toast.error("Update failed", e instanceof Error ? e.message : undefined),
  });

  const back = (
    <Link href="/admin/insurance-mkt/providers" className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700">
      <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
      Back to providers
    </Link>
  );

  const p = data?.providers.find((x) => x.id === id);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6" role="status" aria-label="Loading">
        {back}
        <div className="h-56 animate-pulse rounded-[20px] bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 [&_a:hover]:no-underline">
        {back}
        <div className={PANEL}>
          <EmptyBlock className="mt-0" icon={<Building2 size={19} />} title="Provider not found" body="It may have been removed, or the link is out of date." />
        </div>
      </div>
    );
  }

  const plans = plansData?.plans ?? [];
  const enrollments = (enrData?.enrollments ?? []).filter((e) => e.providerId === id);
  const claims = (claimData?.claims ?? []).filter((c) => c.providerId === id);
  const activePolicies = enrollments.filter((e) => e.status === "active");
  const annualBook = activePolicies.reduce((a, e) => a + e.premiumAmountLkr * (e.billingCycle === "monthly" ? 12 : 1), 0);
  const livePlans = plans.filter((x) => x.isPublished).length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {back}

      <div>
        <DoctorHero
          leading={
            p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="" className="h-[76px] w-[76px] rounded-[20px] bg-white object-contain p-2 ring-1 ring-white/20" />
            ) : (
              <span className="grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br from-amber-400 to-orange-600 text-2xl font-semibold text-white shadow-[0_12px_32px_-8px_rgba(245,158,11,0.6)] ring-1 ring-inset ring-white/25">
                {p.name.slice(0, 2).toUpperCase()}
              </span>
            )
          }
          kickerIcon={<Building2 size={13} aria-hidden />}
          kicker="Insurance provider"
          kickerMeta={p.slug}
          title={p.name}
          description={p.tagline || "No tagline yet"}
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className={cn("h-2 w-2 rounded-full", p.isPublished ? "bg-emerald-400" : "bg-slate-400")} aria-hidden />
                {p.isPublished ? "Live in marketplace" : "Draft — hidden from patients"}
              </span>
              {p.regulatorLicense ? (
                <span className={cn(HERO_CHIP, "font-mono")}>
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  {p.regulatorLicense}
                </span>
              ) : null}
              {(p.ratingCount ?? 0) > 0 ? (
                <span className={HERO_CHIP}>
                  <Star size={12} className="text-amber-300" fill="currentColor" aria-hidden />
                  {(p.ratingAvg ?? 0).toFixed(1)} · {(p.ratingCount ?? 0).toLocaleString()} reviews
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              {p.websiteUrl ? (
                <a href={p.websiteUrl} target="_blank" rel="noreferrer" className={HERO_GHOST}>
                  <Globe size={15} aria-hidden />
                  Website
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => save.mutate({ isPublished: !p.isPublished })}
                disabled={save.isPending}
                className={p.isPublished ? HERO_GHOST : HERO_PRIMARY}
              >
                {p.isPublished ? <EyeOff size={15} aria-hidden /> : <Eye size={15} className="text-sky-600" aria-hidden />}
                {p.isPublished ? "Unpublish" : "Publish"}
              </button>
            </>
          }
        />
        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Plans" icon={<Package size={16} />} tone="bg-violet-50 text-violet-600" value={String(plans.length)} sub={`${livePlans} published`} progress={plans.length ? Math.round((livePlans / plans.length) * 100) : null} />
          <StatTile label="Active policies" icon={<Users size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(activePolicies.length)} sub={`${enrollments.length} total enrollments`} />
          <StatTile label="Annual premium" icon={<ClipboardList size={16} />} tone="bg-sky-50 text-sky-600" value={lkrCompact(annualBook)} sub="From active policies" />
          <StatTile label="Claim settlement" icon={<BadgePercent size={16} />} tone="bg-amber-50 text-amber-600" value={p.claimSettlementRatioPct != null ? `${p.claimSettlementRatioPct}%` : "—"} sub={`${claims.length} marketplace claim${claims.length === 1 ? "" : "s"}`} progress={p.claimSettlementRatioPct ?? null} />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Plans */}
          <section className={PANEL} aria-labelledby="pv-plans">
            <PanelHeader id="pv-plans" icon={<Package size={16} />} tone="bg-violet-50 text-violet-600" title="Plans" caption={`${plans.length} product${plans.length === 1 ? "" : "s"} from ${p.name}`} href="/admin/insurance-mkt/plans" linkLabel="All plans" />
            {plans.length === 0 ? (
              <EmptyBlock icon={<Package size={19} />} title="No plans yet" body="Create a plan under this provider from the plan catalogue." />
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {plans.map((pl) => (
                  <li key={pl.id}>
                    <Link
                      href={`/admin/insurance-mkt/plans/${pl.id}`}
                      className="group flex h-full flex-col rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{pl.name}</span>
                          <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", PLAN_TYPE_TONE[pl.planType] ?? "bg-slate-100 text-slate-600")}>
                            {humanize(pl.planType)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {pl.isFeatured ? <Star size={13} className="text-amber-500" fill="currentColor" aria-label="Featured" /> : null}
                          <Pill tone={pl.isPublished ? "success" : "neutral"}>{pl.isPublished ? "Live" : "Draft"}</Pill>
                        </span>
                      </span>
                      <span className="mt-3 flex items-baseline gap-1">
                        <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">{formatLkr(pl.monthlyPremiumLkr)}</span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </span>
                      <span className="mt-auto flex items-center justify-between pt-3 text-[11px] text-slate-400">
                        <span>{lkrCompact(pl.coverageSummaryLkr)} cover · {pl.enrollmentCount ?? 0} enrolled</span>
                        <ChevronRight size={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent policies */}
          <section className={PANEL} aria-labelledby="pv-enr">
            <PanelHeader id="pv-enr" icon={<Users size={16} />} tone="bg-emerald-50 text-emerald-600" title="Recent policies" caption={`${enrollments.length} enrollment${enrollments.length === 1 ? "" : "s"}`} href="/admin/insurance-mkt/enrollments" linkLabel="All enrollments" />
            {enrollments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">No one has enrolled with this provider yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {enrollments.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/users/${e.userId}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", enrollmentTone(e.status).rail)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">{e.userName}</span>
                        <span className="block truncate text-[11px] text-slate-400">{e.planName}{e.policyNumber ? ` · ${e.policyNumber}` : ""}</span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                        {formatLkr(e.premiumAmountLkr)}/{e.billingCycle === "monthly" ? "mo" : "yr"}
                      </span>
                      <Pill tone={enrollmentTone(e.status).pill}>{humanize(e.status)}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:col-span-4" aria-label="Provider profile">
          <section className={PANEL} aria-labelledby="pv-profile">
            <PanelHeader
              id="pv-profile"
              icon={<Building2 size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Profile"
              caption="Shown on the marketplace listing"
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
              <ProviderEditForm provider={p} saving={save.isPending} onCancel={() => setEditing(false)} onSave={(patch) => save.mutate(patch)} />
            ) : (
              <>
                {p.description ? <p className="mt-4 text-[13px] leading-relaxed text-slate-600">{p.description}</p> : null}
                <dl className="mt-4 flex flex-col gap-2">
                  <InfoField icon={<ShieldCheck size={15} />} label="Regulator licence" mono copyValue={p.regulatorLicense}>{p.regulatorLicense || "—"}</InfoField>
                  <InfoField icon={<Phone size={15} />} label="Support phone" copyValue={p.supportPhone}>{p.supportPhone || "—"}</InfoField>
                  <InfoField icon={<Globe size={15} />} label="Website" copyValue={p.websiteUrl}>{p.websiteUrl ? p.websiteUrl.replace(/^https?:\/\//, "") : "—"}</InfoField>
                  <InfoField icon={<Hospital size={15} />} label="Cashless hospitals">{p.cashlessHospitalCount ?? "—"}</InfoField>
                  <InfoField icon={<Hash size={15} />} label="Slug" mono copyValue={p.slug}>{p.slug}</InfoField>
                </dl>
              </>
            )}
          </section>

          {claims.length ? (
            <section className={PANEL} aria-labelledby="pv-claims">
              <PanelHeader id="pv-claims" icon={<Receipt size={16} />} tone="bg-sky-50 text-sky-600" title="Recent claims" caption={`${claims.length} filed`} href="/admin/insurance-mkt/claims" linkLabel="All" />
              <ul className="mt-4 flex flex-col gap-0.5">
                {claims.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/insurance-mkt/claims/${c.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", claimTone(c.status).rail)} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900 group-hover:text-sky-700">{c.patientName}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{lkrCompact(c.amountRequestedLkr)}</span>
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

function ProviderEditForm({
  provider: p,
  saving,
  onCancel,
  onSave,
}: {
  provider: MktProvider;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    name: p.name,
    tagline: p.tagline ?? "",
    description: p.description ?? "",
    regulatorLicense: p.regulatorLicense ?? "",
    supportPhone: p.supportPhone ?? "",
    websiteUrl: p.websiteUrl ?? "",
    claimSettlementRatioPct: p.claimSettlementRatioPct != null ? String(p.claimSettlementRatioPct) : "",
    cashlessHospitalCount: p.cashlessHospitalCount != null ? String(p.cashlessHospitalCount) : "",
  });

  const submit = () => {
    // Only send changed, valid values — the API rejects empty URLs and nulls.
    const patch: Record<string, unknown> = {};
    const text = ["name", "tagline", "description", "regulatorLicense", "supportPhone", "websiteUrl"] as const;
    for (const k of text) {
      const v = f[k].trim();
      if (v && v !== (p[k] ?? "")) patch[k] = v;
    }
    if (f.claimSettlementRatioPct !== "" && Number(f.claimSettlementRatioPct) !== p.claimSettlementRatioPct) {
      patch.claimSettlementRatioPct = Number(f.claimSettlementRatioPct);
    }
    if (f.cashlessHospitalCount !== "" && Number(f.cashlessHospitalCount) !== p.cashlessHospitalCount) {
      patch.cashlessHospitalCount = Math.round(Number(f.cashlessHospitalCount));
    }
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSave(patch);
  };

  return (
    <div className="mt-4 flex flex-col gap-3.5">
      <FormField label="Name">
        <input className={MKT_INPUT} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </FormField>
      <FormField label="Tagline">
        <input className={MKT_INPUT} value={f.tagline} maxLength={200} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
      </FormField>
      <FormField label="Description">
        <textarea className={`${MKT_INPUT} h-24 resize-none py-2.5`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Settlement %">
          <input className={MKT_INPUT} type="number" min={0} max={100} value={f.claimSettlementRatioPct} onChange={(e) => setF({ ...f, claimSettlementRatioPct: e.target.value })} />
        </FormField>
        <FormField label="Cashless hospitals">
          <input className={MKT_INPUT} type="number" min={0} value={f.cashlessHospitalCount} onChange={(e) => setF({ ...f, cashlessHospitalCount: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Regulator licence">
        <input className={`${MKT_INPUT} font-mono text-[13px]`} value={f.regulatorLicense} onChange={(e) => setF({ ...f, regulatorLicense: e.target.value })} />
      </FormField>
      <FormField label="Support phone">
        <input className={MKT_INPUT} value={f.supportPhone} onChange={(e) => setF({ ...f, supportPhone: e.target.value })} />
      </FormField>
      <FormField label="Website" hint="Must start with https://">
        <input className={MKT_INPUT} type="url" value={f.websiteUrl} onChange={(e) => setF({ ...f, websiteUrl: e.target.value })} />
      </FormField>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={submit} disabled={saving || !f.name.trim()} className={cn(PRIMARY_BTN, "h-10 flex-1 justify-center")}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] hover:text-slate-900">
          Cancel
        </button>
      </div>
    </div>
  );
}
