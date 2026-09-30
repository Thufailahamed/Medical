"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  Building2,
  Eye,
  EyeOff,
  FileEdit,
  Globe,
  Hash,
  Package,
  Plus,
  Star,
  Store,
  Users,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { Modal } from "@/portal/components/ui/Modal";
import { adminApi } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";
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
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";
import {
  FormField,
  MKT_INPUT,
  slugify,
  useMktProviders,
  type MktProvider,
} from "@/portal/components/admin/insurance-mkt";

type Filter = "all" | "published" | "draft";

const EMPTY_FORM = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  regulatorLicense: "",
  websiteUrl: "",
  supportPhone: "",
};

export default function AdminInsuranceProvidersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading } = useMktProviders();

  const createMut = useMutation({
    mutationFn: () => {
      // The API validates optional fields strictly (URLs, no nulls) and needs
      // an operator org id — send only what was filled in.
      const body: Record<string, unknown> = {
        operatorOrgId: `ins-${form.slug}`,
        name: form.name.trim(),
        slug: form.slug,
      };
      for (const k of ["tagline", "description", "regulatorLicense", "websiteUrl", "supportPhone"] as const) {
        const v = form[k].trim();
        if (v) body[k] = v;
      }
      return adminApi("/admin/insurance-providers", { method: "POST", json: body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-providers"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setSlugTouched(false);
      toast.success("Provider created", "It stays a draft until you publish it.");
    },
    onError: (e: unknown) => toast.error("Could not create provider", e instanceof Error ? e.message : "Unknown error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      adminApi(`/admin/insurance-providers/${id}`, { method: "PUT", json: { isPublished } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-providers"] });
      toast.success(v.isPublished ? "Provider published" : "Provider unpublished");
    },
    onError: (e: unknown) => toast.error("Update failed", e instanceof Error ? e.message : undefined),
  });

  const providers = data?.providers ?? [];
  const published = providers.filter((p) => p.isPublished).length;
  const drafts = providers.length - published;
  const totalPlans = providers.reduce((a, p) => a + (p.planCount ?? 0), 0);
  const totalEnrollments = providers.reduce((a, p) => a + (p.enrollmentCount ?? 0), 0);
  const rated = providers.filter((p) => (p.ratingCount ?? 0) > 0);
  const avgRating = rated.length ? rated.reduce((a, p) => a + (p.ratingAvg ?? 0), 0) / rated.length : null;

  const filtered = providers.filter((p) =>
    filter === "published" ? p.isPublished : filter === "draft" ? !p.isPublished : true,
  );

  const rows: DirectoryRow[] = filtered.map((p: MktProvider) => {
    const busy = toggleMut.isPending && toggleMut.variables?.id === p.id;
    return {
      id: p.id,
      name: p.name,
      href: `/admin/insurance-mkt/providers/${p.id}`,
      leading: (
        <OrgTile
          icon={<span className="text-[13px] font-semibold">{p.name.slice(0, 2).toUpperCase()}</span>}
          tone="from-amber-500 to-orange-600 shadow-amber-500/30"
        />
      ),
      accent: p.isPublished ? "bg-emerald-500" : "bg-slate-300",
      badges: (
        <>
          <Pill tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "Published" : "Draft"}</Pill>
          {(p.ratingCount ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
              <Star size={10} fill="currentColor" />
              {(p.ratingAvg ?? 0).toFixed(1)}
              <span className="font-medium text-amber-600/70">({(p.ratingCount ?? 0).toLocaleString()})</span>
            </span>
          ) : null}
        </>
      ),
      meta: [
        ...(p.tagline ? [{ text: p.tagline }] : []),
        { icon: <Package size={11} />, text: `${p.planCount ?? 0} plan${p.planCount === 1 ? "" : "s"}` },
        { icon: <Users size={11} />, text: `${p.enrollmentCount ?? 0} enrolled`, wide: true },
        ...(p.claimSettlementRatioPct != null
          ? [{ icon: <BadgePercent size={11} />, text: `${p.claimSettlementRatioPct}% settled`, wide: true }]
          : []),
        { icon: <Hash size={11} />, text: p.slug, mono: true, wide: true },
      ],
      searchText: [p.slug, p.tagline, p.regulatorLicense].filter(Boolean).join(" "),
      actions: (
        <button
          type="button"
          onClick={() => toggleMut.mutate({ id: p.id, isPublished: !p.isPublished })}
          disabled={busy}
          className={ROW_BTN_QUIET}
        >
          {p.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
          {p.isPublished ? "Unpublish" : "Publish"}
        </button>
      ),
    };
  });

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Store size={13} aria-hidden />}
          kicker="Insurance marketplace"
          kickerMeta={`${providers.length} provider${providers.length === 1 ? "" : "s"}`}
          title={
            <>
              Insurance{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                providers
              </span>
            </>
          }
          description="The insurers patients can browse and buy from in the HealthHub marketplace. Only published providers are visible to patients."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Globe size={12} className="text-emerald-300" aria-hidden />
                {published} live in the marketplace
              </span>
              {avgRating != null ? (
                <span className={HERO_CHIP}>
                  <Star size={12} className="text-amber-300" fill="currentColor" aria-hidden />
                  {avgRating.toFixed(1)} average rating
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/admin/insurance-mkt/plans" className={HERO_GHOST}>
                <Package size={15} aria-hidden />
                Plans
              </Link>
              <button type="button" onClick={() => setCreateOpen(true)} className={HERO_PRIMARY}>
                <Plus size={15} strokeWidth={2.5} className="text-sky-600" aria-hidden />
                New provider
              </button>
            </>
          }
        />
      }
      stats={
        <>
          <StatTile label="Providers" icon={<Building2 size={16} />} tone="bg-amber-50 text-amber-600" value={isLoading ? "…" : String(providers.length)} sub="Registered insurers" active={filter === "all"} onClick={() => setFilter("all")} />
          <StatTile label="Published" icon={<Eye size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(published)} sub="Visible to patients" progress={providers.length ? Math.round((published / providers.length) * 100) : null} active={filter === "published"} onClick={() => setFilter("published")} />
          <StatTile label="Drafts" icon={<FileEdit size={16} />} tone="bg-slate-100 text-slate-600" value={String(drafts)} sub={drafts ? "Not yet listed" : "Everything is live"} active={filter === "draft"} onClick={() => setFilter("draft")} />
          <StatTile href="/admin/insurance-mkt/plans" label="Plans · enrolled" icon={<Package size={16} />} tone="bg-violet-50 text-violet-600" value={String(totalPlans)} unit="plans" sub={`${totalEnrollments.toLocaleString()} enrollments`} />
        </>
      }
      title="Provider directory"
      icon={<Building2 size={16} />}
      tone="bg-amber-50 text-amber-600"
      rows={rows}
      total={providers.length}
      loading={isLoading}
      searchPlaceholder="Search name, slug, tagline or licence…"
      segmented={{
        value: filter,
        onChange: setFilter,
        options: [
          { value: "all", label: "All", count: providers.length },
          { value: "published", label: "Published", count: published },
          { value: "draft", label: "Draft", count: drafts },
        ],
      }}
      empty={{
        icon: <Building2 size={19} />,
        title: "No providers yet",
        body: "Add an insurer to start listing plans in the marketplace.",
        actions: (
          <button type="button" onClick={() => setCreateOpen(true)} className={PRIMARY_BTN}>
            <Plus size={13} strokeWidth={2.5} />
            New provider
          </button>
        ),
      }}
    >
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New insurance provider"
        subtitle="Created as a draft — publish it once plans are ready"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={!form.name.trim() || form.slug.length < 2 || createMut.isPending}
              className={PRIMARY_BTN}
            >
              <Plus size={13} strokeWidth={2.5} />
              {createMut.isPending ? "Creating…" : "Create provider"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name">
            <input
              className={MKT_INPUT}
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
              }}
              placeholder="e.g. Sri Lanka Insurance"
              autoFocus
            />
          </FormField>
          <FormField label="Slug" hint="Used in the marketplace URL">
            <input
              className={`${MKT_INPUT} font-mono text-[13px]`}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: slugify(e.target.value) });
              }}
              placeholder="sri-lanka-insurance"
            />
          </FormField>
          <FormField label="Tagline" className="sm:col-span-2">
            <input className={MKT_INPUT} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="A short promise shown on the card" maxLength={200} />
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <textarea
              className={`${MKT_INPUT} h-24 resize-none py-2.5`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What makes this insurer different?"
            />
          </FormField>
          <FormField label="Regulator licence">
            <input className={`${MKT_INPUT} font-mono text-[13px]`} value={form.regulatorLicense} onChange={(e) => setForm({ ...form, regulatorLicense: e.target.value })} placeholder="IRCSL-…" />
          </FormField>
          <FormField label="Support phone">
            <input className={MKT_INPUT} value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} placeholder="+94 11 …" />
          </FormField>
          <FormField label="Website" hint="Must start with https://" className="sm:col-span-2">
            <input className={MKT_INPUT} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://" type="url" />
          </FormField>
        </div>
      </Modal>
    </AdminDirectory>
  );
}
