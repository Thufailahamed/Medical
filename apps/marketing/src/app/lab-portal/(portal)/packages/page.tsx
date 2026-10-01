"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PackageOpen,
  Plus,
  Edit3,
  CheckCircle2,
  Layers,
  X,
  AlertTriangle,
  TestTube2,
  Save,
  Sparkles,
} from "lucide-react";
import { useLabPackages, useLabCatalog } from "../../hooks/useApi";
import { api } from "../../lib/api";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  Badge,
  PanelSkeleton,
} from "@/patient/components/workspace";

type Pkg = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  turnaroundHours: number;
  instructions: string | null;
};

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  price: "",
  discountPrice: "",
  turnaroundHours: "48",
  instructions: "",
  testIds: [] as string[],
};

export default function PackagesPage() {
  const { data, isLoading } = useLabPackages();
  const { data: catalog } = useLabCatalog();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setShowModal(true);
  }

  function openEdit(pkg: Pkg) {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description ?? "",
      price: String(pkg.price),
      discountPrice: pkg.discountPrice != null ? String(pkg.discountPrice) : "",
      turnaroundHours: String(pkg.turnaroundHours),
      instructions: pkg.instructions ?? "",
      testIds: [],
    });
    setError(null);
    setShowModal(true);
  }

  function toggleTest(id: string) {
    setForm((f) => ({
      ...f,
      testIds: f.testIds.includes(id)
        ? f.testIds.filter((t) => t !== id)
        : [...f.testIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        turnaroundHours: Number(form.turnaroundHours) || 48,
        instructions: form.instructions.trim() || null,
        testIds: form.testIds,
      };
      if (form.discountPrice) payload.discountPrice = Number(form.discountPrice);
      if (editing) {
        await api<{ package: Pkg }>(`/lab-portal/packages/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        await api<{ package: Pkg }>(`/lab-portal/packages`, {
          method: "POST",
          body: payload,
        });
      }
      qc.invalidateQueries({ queryKey: ["lab-packages"] });
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const list = data?.packages ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const list = data?.packages ?? [];
    const active = list.filter((p) => p.isActive).length;
    const totalRevenue = list.reduce(
      (acc, p) => acc + (p.discountPrice ?? p.price),
      0
    );
    return { count: list.length, active, totalRevenue };
  }, [data]);

  const filteredCatalog = useMemo(() => {
    const list = catalog?.tests ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  return (
    <div className="lab-page flex flex-col gap-6">
      <DoctorHero
        kicker="Bundle marketplace"
        kickerIcon={<PackageOpen size={12} />}
        kickerMeta={`${totals.count} packages`}
        title="Test packages"
        description="Curate grouped test bundles for screening programs, employer checkups, and wellness cohorts."
        chips={
          <>
            <span className={HERO_CHIP}>
              <CheckCircle2 size={12} /> {totals.active} live
            </span>
            <span className={HERO_CHIP}>
              <Sparkles size={12} /> LKR {(totals.totalRevenue / 1000).toFixed(0)}k combined value
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<PackageOpen size={18} />}
            label="Live packages"
            value={totals.active}
            sub={totals.active ? "Listed to patients" : "Create your first bundle"}
          />
        }
        actions={
          <button type="button" className={HERO_PRIMARY} onClick={openCreate}>
            <Plus size={14} /> Create package
          </button>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label="Total packages"
            icon={<PackageOpen size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(totals.count)}
            sub="Across all tiers"
          />
          <StatTile
            label="Active in catalog"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(totals.active)}
            sub="Listed to patients"
          />
          <StatTile
            label="Catalogue value"
            icon={<Sparkles size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={`${(totals.totalRevenue / 1000).toFixed(0)}k`}
            sub="LKR combined pricing"
          />
        </div>
      </HeroOverlap>

      <section className={PANEL}>
        <PanelHeader
          icon={<Layers size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Bundled offerings"
          caption={`${filtered.length} shown`}
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter packages…"
              ariaLabel="Filter packages"
            />
          }
        />

        {isLoading ? (
          <PanelSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<PackageOpen size={19} />}
            title={search ? "No packages match" : "No packages yet"}
            body={
              search
                ? `Nothing matches "${search}".`
                : "Group complementary tests into discounted bundles for screening cohorts."
            }
            actions={
              !search ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800"
                  onClick={openCreate}
                >
                  <Plus size={14} /> Create your first package
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((pkg) => {
              const savings =
                pkg.discountPrice != null
                  ? Math.round(((pkg.price - pkg.discountPrice) / pkg.price) * 100)
                  : 0;
              return (
                <article
                  key={pkg.id}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/50 px-5 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-content-center rounded-xl bg-emerald-600 text-white shadow-sm">
                        <PackageOpen size={20} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400">
                          /{pkg.slug}
                        </div>
                        <h3 className="mt-0.5 text-[15px] font-bold leading-snug tracking-tight text-slate-900">
                          {pkg.name}
                        </h3>
                      </div>
                    </div>
                    <Badge tone={pkg.isActive ? "emerald" : "slate"}>
                      {pkg.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-3 p-5">
                    {pkg.description && (
                      <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-500">
                        {pkg.description}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 py-2">
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">
                          Tests
                        </div>
                        <div className="mt-0.5 text-[14px] font-bold text-slate-900">
                          {pkg.testCount ?? 0}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 py-2">
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">
                          TAT
                        </div>
                        <div className="mt-0.5 font-mono text-[14px] font-bold text-slate-900">
                          {pkg.turnaroundHours}h
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/60 py-2">
                        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">
                          Save
                        </div>
                        <div className="mt-0.5 font-mono text-[14px] font-bold text-emerald-600">
                          {savings > 0 ? `${savings}%` : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                      <div>
                        {pkg.discountPrice != null && (
                          <div className="font-mono text-[11.5px] text-slate-400 line-through">
                            Rs. {pkg.price.toLocaleString("en-LK")}
                          </div>
                        )}
                        <div className="font-mono text-[24px] font-bold tracking-tight text-slate-900">
                          Rs. {(pkg.discountPrice ?? pkg.price).toLocaleString("en-LK")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => openEdit(pkg as Pkg)}
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Create / edit modal ── */}
      {showModal && (
        <div className="lab-overlay-host">
          <div
            className="lab-overlay-backdrop"
            onClick={() => !saving && setShowModal(false)}
          />
          <div
            className="lab-modal-panel lab-modal-lg"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lab-modal-head">
              <div>
                <div className="lab-modal-title">
                  {editing ? "Edit package" : "Create package"}
                </div>
                <div className="lab-modal-sub">
                  {editing
                    ? `Editing ${editing.name}. Pricing changes apply to new orders only.`
                    : "Bundle tests under a single SKU with bundled pricing."}
                </div>
              </div>
              <button
                type="button"
                className="lab-modal-close"
                aria-label="Close"
                onClick={() => !saving && setShowModal(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="lab-modal-body space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="lab-field md:col-span-2">
                    <label className="lab-label">
                      Package name <span className="lab-label-req">*</span>
                    </label>
                    <input
                      required
                      placeholder="Executive Wellness Panel"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="lab-input"
                    />
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">
                      Slug <span className="lab-label-req">*</span>
                    </label>
                    <input
                      required
                      placeholder="executive-wellness"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className="lab-input lab-mono"
                    />
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">Turnaround (hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={form.turnaroundHours}
                      onChange={(e) =>
                        setForm({ ...form, turnaroundHours: e.target.value })
                      }
                      className="lab-input lab-mono"
                    />
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">
                      Price (LKR) <span className="lab-label-req">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      placeholder="12500"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="lab-input lab-mono"
                    />
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">Discount (optional)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="9500"
                      value={form.discountPrice}
                      onChange={(e) =>
                        setForm({ ...form, discountPrice: e.target.value })
                      }
                      className="lab-input lab-mono"
                    />
                  </div>
                  <div className="lab-field md:col-span-2">
                    <label className="lab-label">Description</label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className="lab-input"
                    />
                  </div>
                  <div className="lab-field md:col-span-2">
                    <label className="lab-label">Patient instructions</label>
                    <textarea
                      rows={2}
                      value={form.instructions}
                      onChange={(e) =>
                        setForm({ ...form, instructions: e.target.value })
                      }
                      className="lab-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="lab-label !mb-0">
                      Tests in package
                    </label>
                    <span className="font-mono text-[11px] text-slate-400">
                      {form.testIds.length} selected ·{" "}
                      {catalog?.tests.length ?? 0} available
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60">
                    {filteredCatalog.length === 0 ? (
                      <div className="p-4 text-center text-[12.5px] text-slate-400">
                        <TestTube2 size={18} className="mx-auto mb-1.5 opacity-50" />
                        {search
                          ? `No catalog tests match "${search}"`
                          : "No tests in your catalog yet."}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredCatalog.map((t) => {
                          const checked = form.testIds.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors ${
                                checked
                                  ? "bg-emerald-50/60"
                                  : "hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="lab-checkbox"
                                checked={checked}
                                onChange={() => toggleTest(t.id)}
                              />
                              <div className="grid h-7 w-7 place-content-center rounded-lg border border-slate-200 bg-white text-emerald-600">
                                <TestTube2 size={13} strokeWidth={2.2} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12.5px] font-semibold text-slate-900">
                                  {t.name}
                                </div>
                                <div className="font-mono text-[10.5px] text-slate-400">
                                  /{t.slug}
                                </div>
                              </div>
                              <div className="font-mono text-[12px] font-bold text-slate-900">
                                Rs. {t.price.toLocaleString("en-LK")}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="lab-banner lab-banner-danger">
                    <div className="lab-banner-icon">
                      <AlertTriangle size={14} />
                    </div>
                    <div>{error}</div>
                  </div>
                )}
              </div>

              <div className="lab-modal-foot">
                <button
                  type="button"
                  className="lab-btn lab-btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="lab-btn lab-btn-primary"
                  disabled={saving || form.testIds.length === 0}
                >
                  <Save size={14} />
                  {saving
                    ? "Saving…"
                    : editing
                    ? "Save changes"
                    : "Create package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
