"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  FileEdit,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import {
  useInsuranceOperatorProviders,
  useInsuranceOperatorPlans,
  useCreatePlan,
  useUpdatePlan,
  type InsuranceOperatorPlan,
  type PlanDraftInput,
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
  PanelSearch,
  SECONDARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { Badge, type Tone } from "@/patient/components/workspace";
import { Modal } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";

const FIELD =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/10";

const LABEL =
  "mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

const PLAN_TYPES: { value: string; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "family_floater", label: "Family floater" },
  { value: "senior", label: "Senior" },
  { value: "critical_illness", label: "Critical illness" },
  { value: "cancer", label: "Cancer" },
  { value: "dental", label: "Dental" },
  { value: "maternity", label: "Maternity" },
];

const TYPE_TONE: Record<string, Tone> = {
  individual: "sky",
  family_floater: "violet",
  senior: "amber",
  critical_illness: "rose",
  cancer: "rose",
  dental: "emerald",
  maternity: "sky",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseList(json?: string | null): string {
  if (!json) return "";
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.join("\n") : "";
  } catch {
    return "";
  }
}

function toJsonList(text: string): string | undefined {
  const items = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return items.length ? JSON.stringify(items) : undefined;
}

type PlanFormState = {
  providerId: string;
  name: string;
  slug: string;
  planType: string;
  coverageSummaryLkr: string;
  monthlyPremiumLkr: string;
  annualPremiumLkr: string;
  annualDiscountPct: string;
  deductibleLkr: string;
  copayPct: string;
  coPaymentCapLkr: string;
  waitingPeriodDays: string;
  preExistingWaitingDays: string;
  networkHospitalCount: string;
  termMonths: string;
  keyFeatures: string;
  exclusions: string;
  coverageDetails: string;
  isFeatured: boolean;
};

const emptyPlanForm = (providerId = ""): PlanFormState => ({
  providerId,
  name: "",
  slug: "",
  planType: "individual",
  coverageSummaryLkr: "",
  monthlyPremiumLkr: "",
  annualPremiumLkr: "",
  annualDiscountPct: "10",
  deductibleLkr: "0",
  copayPct: "10",
  coPaymentCapLkr: "0",
  waitingPeriodDays: "30",
  preExistingWaitingDays: "365",
  networkHospitalCount: "0",
  termMonths: "12",
  keyFeatures: "",
  exclusions: "",
  coverageDetails: "",
  isFeatured: false,
});

export default function PlansPage() {
  const sp = useSearchParams();
  const providerFilter = sp.get("provider") ?? null;

  const providersQuery = useInsuranceOperatorProviders();
  const providers = providersQuery.data?.providers ?? [];
  const { data, isLoading, refetch, isRefetching } = useInsuranceOperatorPlans();
  const plans = useMemo(() => data?.plans ?? [], [data]);

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; plan: InsuranceOperatorPlan } | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm(providerFilter ?? ""));
  const [slugTouched, setSlugTouched] = useState(false);

  const openCreate = () => {
    setForm(emptyPlanForm(providerFilter ?? providers[0]?.id ?? ""));
    setSlugTouched(false);
    setModal({ mode: "create" });
  };
  const openEdit = (p: InsuranceOperatorPlan) => {
    setForm({
      providerId: p.providerId,
      name: p.name ?? "",
      slug: p.slug ?? "",
      planType: p.planType ?? "individual",
      coverageSummaryLkr: String(p.coverageSummaryLkr ?? ""),
      monthlyPremiumLkr: String(p.monthlyPremiumLkr ?? ""),
      annualPremiumLkr: String(p.annualPremiumLkr ?? ""),
      annualDiscountPct: String(p.annualDiscountPct ?? 10),
      deductibleLkr: String(p.deductibleLkr ?? 0),
      copayPct: String(p.copayPct ?? 10),
      coPaymentCapLkr: String(p.coPaymentCapLkr ?? 0),
      waitingPeriodDays: String(p.waitingPeriodDays ?? 30),
      preExistingWaitingDays: String(p.preExistingWaitingDays ?? 365),
      networkHospitalCount: String(p.networkHospitalCount ?? 0),
      termMonths: String(p.termMonths ?? 12),
      keyFeatures: parseList(p.keyFeaturesJson),
      exclusions: parseList(p.exclusionsJson),
      coverageDetails: p.coverageDetailsJson ?? "",
      isFeatured: !!p.isFeatured,
    });
    setSlugTouched(true);
    setModal({ mode: "edit", plan: p });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plans.filter(
      (p) =>
        (!providerFilter || p.providerId === providerFilter) &&
        (!term ||
          [p.name, p.providerName ?? "", p.planType, p.slug]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [plans, search, providerFilter]);

  const publishedCount = plans.filter((p) => !!p.isPublished).length;
  const featuredCount = plans.filter((p) => !!p.isFeatured).length;
  const filterProvider = providers.find((p) => p.id === providerFilter);

  const onSubmit = async () => {
    const coverageDetails = form.coverageDetails.trim();
    if (coverageDetails) {
      try {
        JSON.parse(coverageDetails);
      } catch {
        toast.error("Invalid JSON", "Coverage details must be valid JSON, or leave it blank.");
        return;
      }
    }
    const body: PlanDraftInput = {
      providerId: form.providerId,
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      planType: form.planType,
      coverageSummaryLkr: Number(form.coverageSummaryLkr),
      monthlyPremiumLkr: Number(form.monthlyPremiumLkr),
      annualPremiumLkr: Number(form.annualPremiumLkr),
      annualDiscountPct: form.annualDiscountPct ? Number(form.annualDiscountPct) : undefined,
      deductibleLkr: form.deductibleLkr ? Number(form.deductibleLkr) : undefined,
      copayPct: form.copayPct ? Number(form.copayPct) : undefined,
      coPaymentCapLkr: form.coPaymentCapLkr ? Number(form.coPaymentCapLkr) : undefined,
      waitingPeriodDays: form.waitingPeriodDays ? Number(form.waitingPeriodDays) : undefined,
      preExistingWaitingDays: form.preExistingWaitingDays ? Number(form.preExistingWaitingDays) : undefined,
      networkHospitalCount: form.networkHospitalCount ? Number(form.networkHospitalCount) : undefined,
      termMonths: form.termMonths ? Number(form.termMonths) : undefined,
      keyFeaturesJson: toJsonList(form.keyFeatures),
      exclusionsJson: toJsonList(form.exclusions),
      coverageDetailsJson: coverageDetails || undefined,
      isFeatured: form.isFeatured,
    };
    if (!body.providerId || !body.name || !body.slug) return;
    if (!Number.isFinite(body.coverageSummaryLkr) || body.coverageSummaryLkr <= 0) return;
    if (!Number.isFinite(body.monthlyPremiumLkr) || body.monthlyPremiumLkr <= 0) return;
    if (!Number.isFinite(body.annualPremiumLkr) || body.annualPremiumLkr <= 0) return;
    try {
      if (modal?.mode === "edit") {
        await updatePlan.mutateAsync({ id: modal.plan.id, ...body });
        toast.success("Plan updated", "Saved as a draft — a super admin republishes it.");
      } else {
        await createPlan.mutateAsync(body);
        toast.success("Plan drafted", "Submitted for review — a super admin publishes it to the marketplace.");
      }
      setModal(null);
    } catch {
      toast.error("Action failed", "Please try again.");
    }
  };

  const submitDisabled =
    !form.providerId ||
    !form.name.trim() ||
    !form.coverageSummaryLkr ||
    !form.monthlyPremiumLkr ||
    !form.annualPremiumLkr ||
    createPlan.isPending ||
    updatePlan.isPending;

  return (
    <div className="flex flex-col gap-6">
      <DoctorHero
        kicker="Insurer portfolio"
        kickerIcon={<Layers size={12} />}
        kickerMeta={`${plans.length} plan${plans.length === 1 ? "" : "s"} across ${providers.length} provider${providers.length === 1 ? "" : "s"}`}
        title="Insurance plans"
        description="Design the products policyholders buy. Drafts are reviewed and published to the marketplace by a super admin."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Layers size={12} /> {plans.length} total
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} /> {publishedCount} live
            </span>
            <span className={HERO_CHIP}>
              <Star size={12} /> {featuredCount} featured
            </span>
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => refetch()} className={HERO_GHOST}>
              <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} /> Refresh
            </button>
            <Link href="/insurance-operator/providers" className={HERO_GHOST}>
              <Building2 size={14} /> Providers
            </Link>
            <button type="button" onClick={openCreate} className={HERO_PRIMARY}>
              <Plus size={14} /> New plan
            </button>
          </>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Plans"
            icon={<Layers size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(plans.length)}
            sub="Products on file"
          />
          <StatTile
            label="Published"
            icon={<ShieldCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(publishedCount)}
            sub="Live on marketplace"
          />
          <StatTile
            label="Featured"
            icon={<Star size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(featuredCount)}
            sub="Highlighted products"
          />
          <StatTile
            href="/insurance-operator/providers"
            label="Providers"
            icon={<Building2 size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(providers.length)}
            sub="Underwriting entities"
          />
        </div>
      </HeroOverlap>

      <section className={PANEL}>
        <PanelHeader
          icon={<Layers size={16} />}
          tone="bg-sky-50 text-sky-600"
          title={filterProvider ? `Plans · ${filterProvider.name}` : "Plan catalog"}
          caption={
            isLoading
              ? "Loading catalog…"
              : `${filtered.length} of ${plans.length} plans${filterProvider ? ` · filtered to ${filterProvider.name}` : ""}`
          }
          action={
            <div className="flex items-center gap-2">
              {providerFilter ? (
                <Link
                  href="/insurance-operator/plans"
                  className="inline-flex h-9 items-center rounded-lg bg-sky-50 px-3 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                >
                  Clear provider filter
                </Link>
              ) : null}
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search plan, type, provider…"
                ariaLabel="Search plans"
              />
            </div>
          }
        />

        {isLoading ? (
          <ul className="mt-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-50" />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Layers size={19} />}
            title={plans.length === 0 ? "No plans yet" : "No plans match"}
            body={
              plans.length === 0
                ? providers.length === 0
                  ? "Create a provider first — every plan is attached to an underwriting entity."
                  : "Draft your first plan — coverage, premium and waiting periods become a sellable product once published."
                : `No results for “${search}”.`
            }
            actions={
              plans.length === 0 ? (
                providers.length === 0 ? (
                  <Link href="/insurance-operator/providers" className="text-xs font-semibold text-sky-700 hover:underline">
                    Create a provider first
                  </Link>
                ) : (
                  <button type="button" onClick={openCreate} className="text-xs font-semibold text-sky-700 hover:underline">
                    Draft a plan
                  </button>
                )
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-100 lg:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Provider</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3 text-right">Premium</th>
                    <th className="px-5 py-3 text-right">Coverage</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-sky-50/40">
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-sky-50 text-sky-600">
                            <Layers size={15} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">
                              {p.name}
                              {p.isFeatured ? <Star size={11} className="mb-0.5 ml-1.5 inline text-amber-500" /> : null}
                            </span>
                            <span className="block font-mono text-[11px] text-slate-400">{p.slug}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{p.providerName || "—"}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={TYPE_TONE[p.planType] ?? "slate"}>
                          {PLAN_TYPES.find((t) => t.value === p.planType)?.label ?? p.planType}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                        LKR {(p.monthlyPremiumLkr ?? 0).toLocaleString()}
                        <span className="block text-[10.5px] font-normal text-slate-400">/ mo</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-600">
                        LKR {(p.coverageSummaryLkr ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.isPublished ? <Badge tone="emerald">Live</Badge> : <Badge tone="slate">Draft</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-700"
                        >
                          <FileEdit size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]"
                >
                  <span
                    className={cn(
                      "absolute inset-y-4 left-0 w-[3px] rounded-r-full",
                      p.isPublished ? "bg-emerald-500" : "bg-slate-300",
                    )}
                    aria-hidden
                  />
                  <div className="ml-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {p.name}
                        {p.isFeatured ? <Star size={11} className="shrink-0 text-amber-500" /> : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {p.providerName || "—"} · {PLAN_TYPES.find((t) => t.value === p.planType)?.label ?? p.planType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-700"
                    >
                      <FileEdit size={14} />
                    </button>
                  </div>
                  <div className="ml-2 mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <p className="text-xs font-semibold tabular-nums text-slate-900">
                        LKR {(p.monthlyPremiumLkr ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">per month</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <p className="text-xs font-semibold tabular-nums text-slate-900">
                        LKR {(p.coverageSummaryLkr ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">coverage</p>
                    </div>
                  </div>
                  <div className="ml-2 mt-3 flex items-center justify-between">
                    {p.isPublished ? <Badge tone="emerald">Live</Badge> : <Badge tone="slate">Draft</Badge>}
                    <span className="text-[11px] text-slate-400">{p.termMonths ?? 12}-month term</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Create / edit plan modal ── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        size="xl"
        title={modal?.mode === "edit" ? `Edit ${modal.plan.name}` : "New insurance plan"}
        subtitle="Plans are created as drafts — a super admin reviews and publishes them to the marketplace."
        footer={
          <>
            <button type="button" onClick={() => setModal(null)} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitDisabled}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
            >
              {createPlan.isPending || updatePlan.isPending
                ? "Saving…"
                : modal?.mode === "edit"
                  ? "Save changes"
                  : "Create plan draft"}
            </button>
          </>
        }
      >
        {providers.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You need a provider entity before creating plans.{" "}
            <Link href="/insurance-operator/providers" className="font-semibold underline underline-offset-2">
              Create one first
            </Link>
            .
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Identity */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <Sparkles size={11} /> Identity
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Provider *</span>
                  <select
                    value={form.providerId}
                    onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">Select provider…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Plan type *</span>
                  <select
                    value={form.planType}
                    onChange={(e) => setForm((f) => ({ ...f, planType: e.target.value }))}
                    className={FIELD}
                  >
                    {PLAN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Plan name *</span>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                    }}
                    placeholder="e.g. Family Health Plus"
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Slug *</span>
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                    }}
                    placeholder="family-health-plus"
                    className={cn(FIELD, "font-mono text-xs")}
                  />
                </label>
                <label className="flex items-center gap-2.5 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                  />
                  <span className="text-sm text-slate-700">
                    Featured plan <span className="text-slate-400">— highlighted on the marketplace once published</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Pricing & coverage */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <ShieldCheck size={11} /> Pricing & coverage
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>Coverage (LKR) *</span>
                  <input type="number" min={1} value={form.coverageSummaryLkr} onChange={(e) => setForm((f) => ({ ...f, coverageSummaryLkr: e.target.value }))} placeholder="500000" className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Monthly premium *</span>
                  <input type="number" min={1} value={form.monthlyPremiumLkr} onChange={(e) => setForm((f) => ({ ...f, monthlyPremiumLkr: e.target.value }))} placeholder="3500" className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Annual premium *</span>
                  <input type="number" min={1} value={form.annualPremiumLkr} onChange={(e) => setForm((f) => ({ ...f, annualPremiumLkr: e.target.value }))} placeholder="38000" className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Annual discount %</span>
                  <input type="number" min={0} max={100} value={form.annualDiscountPct} onChange={(e) => setForm((f) => ({ ...f, annualDiscountPct: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Deductible (LKR)</span>
                  <input type="number" min={0} value={form.deductibleLkr} onChange={(e) => setForm((f) => ({ ...f, deductibleLkr: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Copay %</span>
                  <input type="number" min={0} max={100} value={form.copayPct} onChange={(e) => setForm((f) => ({ ...f, copayPct: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Copay cap (LKR)</span>
                  <input type="number" min={0} value={form.coPaymentCapLkr} onChange={(e) => setForm((f) => ({ ...f, coPaymentCapLkr: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Term (months)</span>
                  <input type="number" min={1} value={form.termMonths} onChange={(e) => setForm((f) => ({ ...f, termMonths: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Network hospitals</span>
                  <input type="number" min={0} value={form.networkHospitalCount} onChange={(e) => setForm((f) => ({ ...f, networkHospitalCount: e.target.value }))} className={FIELD} />
                </label>
              </div>
            </div>

            {/* Underwriting rules */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <ArrowRight size={11} /> Underwriting rules
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Waiting period (days)</span>
                  <input type="number" min={0} value={form.waitingPeriodDays} onChange={(e) => setForm((f) => ({ ...f, waitingPeriodDays: e.target.value }))} className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Pre-existing wait (days)</span>
                  <input type="number" min={0} value={form.preExistingWaitingDays} onChange={(e) => setForm((f) => ({ ...f, preExistingWaitingDays: e.target.value }))} className={FIELD} />
                </label>
              </div>
            </div>

            {/* Features & exclusions */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <Layers size={11} /> Features & exclusions
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Key features — one per line</span>
                  <textarea
                    value={form.keyFeatures}
                    onChange={(e) => setForm((f) => ({ ...f, keyFeatures: e.target.value }))}
                    rows={4}
                    placeholder={"Cashless admission\nFree annual check-up\nAmbulance cover"}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Exclusions — one per line</span>
                  <textarea
                    value={form.exclusions}
                    onChange={(e) => setForm((f) => ({ ...f, exclusions: e.target.value }))}
                    rows={4}
                    placeholder={"Cosmetic procedures\nSelf-inflicted injuries"}
                    className={FIELD}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={LABEL}>Coverage details — optional JSON</span>
                  <textarea
                    value={form.coverageDetails}
                    onChange={(e) => setForm((f) => ({ ...f, coverageDetails: e.target.value }))}
                    rows={3}
                    placeholder='{"inpatient": "Up to LKR 500,000", "outpatient": "LKR 50,000 / year"}'
                    className={cn(FIELD, "font-mono text-xs")}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
