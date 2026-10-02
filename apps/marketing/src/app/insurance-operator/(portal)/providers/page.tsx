"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  FileEdit,
  Globe,
  Layers,
  Percent,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  useInsuranceOperatorProviders,
  useInsuranceOperatorPlans,
  useCreateProvider,
  useUpdateProvider,
  type InsuranceOperatorProvider,
  type ProviderDraftInput,
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
import { Badge, RailRow } from "@/patient/components/workspace";
import { Modal } from "@/portal/components/ui/Modal";
import { formatDate } from "@/portal/lib/format";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";

const FIELD =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/10";

const LABEL =
  "mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type ProviderFormState = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  regulatorLicense: string;
  websiteUrl: string;
  supportPhone: string;
  logoUrl: string;
  claimSettlementRatioPct: string;
  cashlessHospitalCount: string;
};

const emptyForm: ProviderFormState = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  regulatorLicense: "",
  websiteUrl: "",
  supportPhone: "",
  logoUrl: "",
  claimSettlementRatioPct: "",
  cashlessHospitalCount: "",
};

export default function ProvidersPage() {
  const { data, isLoading, refetch, isRefetching } = useInsuranceOperatorProviders();
  const providers = useMemo(() => data?.providers ?? [], [data]);
  const plansQuery = useInsuranceOperatorPlans();
  const planCountByProvider = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plansQuery.data?.plans ?? []) {
      m.set(p.providerId, (m.get(p.providerId) ?? 0) + 1);
    }
    return m;
  }, [plansQuery.data]);

  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; provider: InsuranceOperatorProvider } | null>(null);
  const [form, setForm] = useState<ProviderFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setModal({ mode: "create" });
  };
  const openEdit = (p: InsuranceOperatorProvider) => {
    setForm({
      name: p.name ?? "",
      slug: p.slug ?? "",
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      regulatorLicense: p.regulatorLicense ?? "",
      websiteUrl: p.websiteUrl ?? "",
      supportPhone: p.supportPhone ?? "",
      logoUrl: p.logoUrl ?? "",
      claimSettlementRatioPct: p.claimSettlementRatioPct != null ? String(p.claimSettlementRatioPct) : "",
      cashlessHospitalCount: p.cashlessHospitalCount != null ? String(p.cashlessHospitalCount) : "",
    });
    setSlugTouched(true);
    setModal({ mode: "edit", provider: p });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((p) =>
      [p.name, p.slug, p.regulatorLicense ?? "", p.tagline ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [providers, search]);

  const publishedCount = providers.filter((p) => !!p.isPublished).length;

  const onSubmit = async () => {
    const body: ProviderDraftInput = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      tagline: form.tagline.trim() || undefined,
      description: form.description.trim() || undefined,
      regulatorLicense: form.regulatorLicense.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
      supportPhone: form.supportPhone.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      claimSettlementRatioPct: form.claimSettlementRatioPct ? Number(form.claimSettlementRatioPct) : undefined,
      cashlessHospitalCount: form.cashlessHospitalCount ? Number(form.cashlessHospitalCount) : undefined,
    };
    if (!body.name || !body.slug) return;
    try {
      if (modal?.mode === "edit") {
        await updateProvider.mutateAsync({ id: modal.provider.id, ...body });
        toast.success("Provider updated", "Changes saved as a draft — a super admin publishes updates.");
      } else {
        await createProvider.mutateAsync(body);
        toast.success("Provider drafted", "Submitted for review — a super admin publishes it to the marketplace.");
      }
      setModal(null);
    } catch {
      toast.error("Action failed", "Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <DoctorHero
        kicker="Insurer portfolio"
        kickerIcon={<Building2 size={12} />}
        kickerMeta={`${providers.length} provider${providers.length === 1 ? "" : "s"} on file`}
        title="Insurance providers"
        description="Your underwriting entities. Draft changes are reviewed by a super admin before publishing to the marketplace."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Building2 size={12} /> {providers.length} total
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} /> {publishedCount} live on marketplace
            </span>
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => refetch()} className={HERO_GHOST}>
              <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={HERO_PRIMARY}>
              <Plus size={14} /> New provider
            </button>
          </>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label="Providers"
            icon={<Building2 size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(providers.length)}
            sub="Entities under your org"
          />
          <StatTile
            label="Live on marketplace"
            icon={<Globe size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(publishedCount)}
            sub="Published by super admin"
          />
          <StatTile
            href="/insurance-operator/plans"
            label="Plans"
            icon={<Layers size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(plansQuery.data?.plans?.length ?? 0)}
            sub="Products across providers"
          />
        </div>
      </HeroOverlap>

      <section className={PANEL}>
        <PanelHeader
          icon={<Building2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Provider registry"
          caption={
            isLoading
              ? "Loading registry…"
              : `${filtered.length} of ${providers.length} providers`
          }
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Search name, license, slug…"
              ariaLabel="Search providers"
            />
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
            icon={<Building2 size={19} />}
            title={providers.length === 0 ? "No providers yet" : "No providers match"}
            body={
              providers.length === 0
                ? "Draft your first insurance provider entity. A super admin reviews and publishes it to the marketplace."
                : `No results for “${search}”.`
            }
            actions={
              providers.length === 0 ? (
                <button type="button" onClick={openCreate} className="text-xs font-semibold text-sky-700 hover:underline">
                  Create provider
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filtered.map((p) => {
              const planCount = planCountByProvider.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <RailRow
                    tone={p.isPublished ? "emerald" : "slate"}
                    icon={<Building2 size={15} />}
                    title={
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.isPublished ? (
                          <Badge tone="emerald">Live</Badge>
                        ) : (
                          <Badge tone="slate">Draft</Badge>
                        )}
                      </span>
                    }
                    meta={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="font-mono">{p.slug}</span>
                        {p.regulatorLicense ? <span>License {p.regulatorLicense}</span> : null}
                        <span>{planCount} plan{planCount === 1 ? "" : "s"}</span>
                        {p.createdAt ? <span>{formatDate(p.createdAt)}</span> : null}
                      </span>
                    }
                    trailing={
                      <>
                        {p.claimSettlementRatioPct != null ? (
                          <span className="hidden items-center gap-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
                            <Percent size={12} /> {p.claimSettlementRatioPct}% settled
                          </span>
                        ) : null}
                        {p.websiteUrl ? (
                          <a
                            href={p.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${p.name} website`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-700"
                        >
                          <FileEdit size={14} />
                        </button>
                        <Link
                          href={`/insurance-operator/plans?provider=${p.id}`}
                          aria-label={`View plans for ${p.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Create / edit provider modal ── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === "edit" ? `Edit ${modal.provider.name}` : "New provider"}
        subtitle={
          modal?.mode === "edit"
            ? "Changes stay as a draft until a super admin republishes."
            : "Creates an unpublished draft — a super admin reviews and publishes it."
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setModal(null)}
              className={SECONDARY_BTN}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!form.name.trim() || createProvider.isPending || updateProvider.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
            >
              {createProvider.isPending || updateProvider.isPending
                ? "Saving…"
                : modal?.mode === "edit"
                  ? "Save changes"
                  : "Create draft"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={LABEL}>Provider name *</span>
            <input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
              }}
              placeholder="e.g. Ceylinco Life"
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
              placeholder="ceylinco-life"
              className={cn(FIELD, "font-mono text-xs")}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Regulator license</span>
            <input
              value={form.regulatorLicense}
              onChange={(e) => setForm((f) => ({ ...f, regulatorLicense: e.target.value }))}
              placeholder="IRCSL/INS/…"
              className={FIELD}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Tagline</span>
            <input
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="Short marketing line"
              className={FIELD}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="What this provider underwrites…"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Website URL</span>
            <input
              value={form.websiteUrl}
              onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
              placeholder="https://…"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Support phone</span>
            <input
              value={form.supportPhone}
              onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
              placeholder="+94 …"
              className={FIELD}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Logo URL</span>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://…/logo.png"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Claim settlement ratio %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.claimSettlementRatioPct}
              onChange={(e) => setForm((f) => ({ ...f, claimSettlementRatioPct: e.target.value }))}
              placeholder="e.g. 97.5"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Cashless hospitals</span>
            <input
              type="number"
              min={0}
              value={form.cashlessHospitalCount}
              onChange={(e) => setForm((f) => ({ ...f, cashlessHospitalCount: e.target.value }))}
              placeholder="e.g. 120"
              className={FIELD}
            />
          </label>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-500">
          <Phone size={13} className="mt-0.5 shrink-0 text-sky-600" />
          Provider records stay as drafts until a super admin publishes them — they only appear on the public marketplace once approved.
        </p>
      </Modal>
    </div>
  );
}
