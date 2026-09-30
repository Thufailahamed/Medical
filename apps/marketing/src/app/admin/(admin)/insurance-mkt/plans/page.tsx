"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  EyeOff,
  Hospital,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { Modal } from "@/portal/components/ui/Modal";
import { adminApi } from "@/portal/lib/admin-api";
import { formatLkr } from "@/portal/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  PRIMARY_BTN,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  OrgTile,
  ROW_BTN_QUIET,
  humanize,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";
import {
  FormField,
  MKT_INPUT,
  PLAN_TYPES,
  PLAN_TYPE_TONE,
  lkrCompact,
  slugify,
  useMktPlans,
  useMktProviders,
} from "@/portal/components/admin/insurance-mkt";

type Filter = "all" | "published" | "draft" | "featured";

const EMPTY_FORM = {
  providerId: "",
  name: "",
  slug: "",
  planType: "individual",
  coverageSummaryLkr: "",
  monthlyPremiumLkr: "",
  annualPremiumLkr: "",
  copayPct: "20",
  networkHospitalCount: "100",
};

export default function AdminInsurancePlansPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  // Server-side filter: /admin/insurance-plans?provider_id=…
  const [providerFilter, setProviderFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading } = useMktPlans(providerFilter || undefined);
  const { data: providersData } = useMktProviders();
  const providers = providersData?.providers ?? [];

  const createMut = useMutation({
    mutationFn: () =>
      adminApi("/admin/insurance-plans", {
        method: "POST",
        json: {
          providerId: form.providerId,
          name: form.name.trim(),
          slug: form.slug,
          planType: form.planType,
          coverageSummaryLkr: Number(form.coverageSummaryLkr),
          monthlyPremiumLkr: Number(form.monthlyPremiumLkr),
          annualPremiumLkr: Number(form.annualPremiumLkr),
          copayPct: Number(form.copayPct),
          networkHospitalCount: Number(form.networkHospitalCount),
          deductibleLkr: 0,
          waitingPeriodDays: 30,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-plans"] });
      qc.invalidateQueries({ queryKey: ["admin", "insurance-providers"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setSlugTouched(false);
      toast.success("Plan created", "It stays a draft until you publish it.");
    },
    onError: (e: unknown) => toast.error("Could not create plan", e instanceof Error ? e.message : "Unknown error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { isPublished?: boolean; isFeatured?: boolean } }) =>
      adminApi(`/admin/insurance-plans/${id}`, { method: "PUT", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "insurance-plans"] }),
    onError: (e: unknown) => toast.error("Update failed", e instanceof Error ? e.message : undefined),
  });

  const plans = data?.plans ?? [];
  const published = plans.filter((p) => p.isPublished).length;
  const featured = plans.filter((p) => p.isFeatured).length;
  const avgMonthly = plans.length ? plans.reduce((a, p) => a + p.monthlyPremiumLkr, 0) / plans.length : 0;
  const totalEnrolled = plans.reduce((a, p) => a + (p.enrollmentCount ?? 0), 0);
  const annualAuto = Number(form.monthlyPremiumLkr) > 0 ? Math.round(Number(form.monthlyPremiumLkr) * 12 * 0.9) : 0;

  const filtered = plans.filter((p) =>
    filter === "published" ? p.isPublished : filter === "draft" ? !p.isPublished : filter === "featured" ? p.isFeatured : true,
  );

  const rows: DirectoryRow[] = filtered.map((p) => {
    const busy = toggleMut.isPending && toggleMut.variables?.id === p.id;
    return {
      id: p.id,
      name: p.name,
      href: `/admin/insurance-mkt/plans/${p.id}`,
      leading: <OrgTile icon={<Package size={17} />} tone="from-violet-500 to-purple-600 shadow-violet-500/30" />,
      accent: p.isPublished ? "bg-emerald-500" : "bg-slate-300",
      badges: (
        <>
          <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold", PLAN_TYPE_TONE[p.planType] ?? "bg-slate-100 text-slate-600")}>
            {humanize(p.planType)}
          </span>
          <Pill tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "Published" : "Draft"}</Pill>
          {p.isFeatured ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
              <Star size={10} fill="currentColor" />
              Featured
            </span>
          ) : null}
        </>
      ),
      meta: [
        { icon: <Building2 size={11} />, text: p.providerName ?? "—" },
        { icon: <Wallet size={11} />, text: `${formatLkr(p.monthlyPremiumLkr)}/mo · ${formatLkr(p.annualPremiumLkr)}/yr` },
        { icon: <ShieldCheck size={11} />, text: `${lkrCompact(p.coverageSummaryLkr)} cover`, wide: true },
        { icon: <Hospital size={11} />, text: `${p.networkHospitalCount ?? 0} hospitals`, wide: true },
        { icon: <Users size={11} />, text: `${p.enrollmentCount ?? 0} enrolled`, wide: true },
      ],
      searchText: [p.slug, p.providerName, p.planType].filter(Boolean).join(" "),
      actions: (
        <>
          <button
            type="button"
            onClick={() => toggleMut.mutate({ id: p.id, patch: { isFeatured: !p.isFeatured } })}
            disabled={busy}
            title={p.isFeatured ? "Remove from featured" : "Feature this plan"}
            aria-label={p.isFeatured ? "Remove from featured" : "Feature this plan"}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-50",
              p.isFeatured ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100 hover:text-amber-500",
            )}
          >
            <Star size={14} fill={p.isFeatured ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => toggleMut.mutate({ id: p.id, patch: { isPublished: !p.isPublished } })}
            disabled={busy}
            className={ROW_BTN_QUIET}
          >
            {p.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
            {p.isPublished ? "Unpublish" : "Publish"}
          </button>
        </>
      ),
    };
  });

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Package size={13} aria-hidden />}
          kicker="Insurance marketplace"
          kickerMeta={`${plans.length} plan${plans.length === 1 ? "" : "s"}`}
          title={
            <>
              Insurance{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                plans
              </span>
            </>
          }
          description="Health cover products patients can compare and enrol in. Featured plans are highlighted at the top of the marketplace."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Eye size={12} className="text-emerald-300" aria-hidden />
                {published} published
              </span>
              <span className={HERO_CHIP}>
                <Sparkles size={12} className="text-amber-300" aria-hidden />
                {featured} featured
              </span>
            </>
          }
          actions={
            <>
              <Link href="/admin/insurance-mkt/providers" className={HERO_GHOST}>
                <Building2 size={15} aria-hidden />
                Providers
              </Link>
              <button type="button" onClick={() => setCreateOpen(true)} className={HERO_PRIMARY}>
                <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
                New plan
              </button>
            </>
          }
        />
      }
      stats={
        <>
          <StatTile label="Plans" icon={<Package size={16} />} tone="bg-violet-50 text-violet-600" value={isLoading ? "…" : String(plans.length)} sub={`${totalEnrolled} enrollments`} active={filter === "all"} onClick={() => setFilter("all")} />
          <StatTile label="Published" icon={<Eye size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(published)} sub="Visible to patients" progress={plans.length ? Math.round((published / plans.length) * 100) : null} active={filter === "published"} onClick={() => setFilter("published")} />
          <StatTile label="Featured" icon={<Star size={16} />} tone="bg-amber-50 text-amber-600" value={String(featured)} sub="Top of the marketplace" active={filter === "featured"} onClick={() => setFilter("featured")} />
          <StatTile label="Avg. monthly premium" icon={<Wallet size={16} />} tone="bg-sky-50 text-sky-600" value={plans.length ? lkrCompact(avgMonthly) : "—"} sub="Across listed plans" />
        </>
      }
      title="Plan catalogue"
      icon={<Package size={16} />}
      tone="bg-violet-50 text-violet-600"
      rows={rows}
      total={plans.length}
      loading={isLoading}
      searchPlaceholder="Search plan, provider or type…"
      toolbar={
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          aria-label="Filter by provider"
          className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
      segmented={{
        value: filter,
        onChange: setFilter,
        options: [
          { value: "all", label: "All", count: plans.length },
          { value: "published", label: "Published", count: published },
          { value: "draft", label: "Draft", count: plans.length - published },
          { value: "featured", label: "Featured", count: featured },
        ],
      }}
      empty={{
        icon: <Package size={19} />,
        title: providerFilter ? "No plans for this provider" : "No plans yet",
        body: "Create a plan under one of your providers to list it in the marketplace.",
        actions: (
          <button type="button" onClick={() => setCreateOpen(true)} className={PRIMARY_BTN}>
            <Plus size={13} strokeWidth={2.5} />
            New plan
          </button>
        ),
      }}
    >
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New insurance plan"
        subtitle="Created as a draft — publish it from the plan page"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={
                !form.providerId ||
                !form.name.trim() ||
                form.slug.length < 2 ||
                !(Number(form.monthlyPremiumLkr) > 0) ||
                !(Number(form.annualPremiumLkr) > 0) ||
                !(Number(form.coverageSummaryLkr) > 0) ||
                createMut.isPending
              }
              className={PRIMARY_BTN}
            >
              <Plus size={13} strokeWidth={2.5} />
              {createMut.isPending ? "Creating…" : "Create plan"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Provider" className="sm:col-span-2">
              <select className={MKT_INPUT} value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                <option value="">Select a provider…</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Plan name">
              <input
                className={MKT_INPUT}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
                placeholder="e.g. Family Shield Plus"
              />
            </FormField>
            <FormField label="Slug">
              <input
                className={`${MKT_INPUT} font-mono text-[13px]`}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: slugify(e.target.value) });
                }}
                placeholder="family-shield-plus"
              />
            </FormField>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-slate-700">Plan type</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PLAN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, planType: t })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    form.planType === t ? "bg-[#07233a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {humanize(t)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50/70 p-4 sm:grid-cols-3">
            <FormField label="Monthly premium (LKR)">
              <input className={`${MKT_INPUT} bg-white`} type="number" min={0} value={form.monthlyPremiumLkr} onChange={(e) => setForm({ ...form, monthlyPremiumLkr: e.target.value })} />
            </FormField>
            <FormField label="Annual premium (LKR)" hint={annualAuto && !form.annualPremiumLkr ? `Suggested ${annualAuto.toLocaleString()} (10% off)` : undefined}>
              <input
                className={`${MKT_INPUT} bg-white`}
                type="number"
                min={0}
                value={form.annualPremiumLkr}
                onChange={(e) => setForm({ ...form, annualPremiumLkr: e.target.value })}
                onFocus={() => {
                  if (!form.annualPremiumLkr && annualAuto) setForm({ ...form, annualPremiumLkr: String(annualAuto) });
                }}
              />
            </FormField>
            <FormField label="Coverage (LKR)">
              <input className={`${MKT_INPUT} bg-white`} type="number" min={0} value={form.coverageSummaryLkr} onChange={(e) => setForm({ ...form, coverageSummaryLkr: e.target.value })} />
            </FormField>
            <FormField label="Co-pay %">
              <input className={`${MKT_INPUT} bg-white`} type="number" min={0} max={100} value={form.copayPct} onChange={(e) => setForm({ ...form, copayPct: e.target.value })} />
            </FormField>
            <FormField label="Network hospitals">
              <input className={`${MKT_INPUT} bg-white`} type="number" min={0} value={form.networkHospitalCount} onChange={(e) => setForm({ ...form, networkHospitalCount: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>
    </AdminDirectory>
  );
}
