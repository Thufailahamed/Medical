"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PackageOpen,
  Plus,
  Edit3,
  CheckCircle2,
  Layers,
  Search,
  X,
  AlertTriangle,
  TestTube2,
  Save,
  Sparkles,
} from "lucide-react";
import { useLabPackages, useLabCatalog } from "../../hooks/useApi";
import { api } from "../../lib/api";

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
    <div className="lab-page">
      {/* ── Page head ── */}
      <div className="lab-page-head">
        <div>
          <span className="lab-page-eyebrow">
            <PackageOpen size={10} />
            Bundle Marketplace
          </span>
          <h1 className="lab-page-title">
            Test <strong>packages</strong>
          </h1>
          <p className="lab-page-sub">
            Curate grouped test bundles for screening programs, employer
            checkups, and wellness cohorts.
          </p>
        </div>
        <div className="lab-page-actions">
          <button
            type="button"
            className="lab-btn lab-btn-primary"
            onClick={openCreate}
          >
            <Plus size={14} />
            Create package
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#1D4ED8", "--lab-stat-soft": "#DBEAFE" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><PackageOpen size={19} strokeWidth={2.1} /></div>
          </div>
          <div className="lab-stat-label">Total packages</div>
          <div className="lab-stat-value mt-2">{totals.count}</div>
          <div className="lab-stat-foot">Across all tiers</div>
        </div>
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#059669", "--lab-stat-soft": "#D1FAE5" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><CheckCircle2 size={19} strokeWidth={2.2} /></div>
          </div>
          <div className="lab-stat-label">Active in catalog</div>
          <div className="lab-stat-value mt-2">{totals.active}</div>
          <div className="lab-stat-foot">Listed to patients</div>
        </div>
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#7C3AED", "--lab-stat-soft": "#EDE9FE" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><Sparkles size={18} strokeWidth={2.2} /></div>
          </div>
          <div className="lab-stat-label">Catalogue value</div>
          <div className="lab-stat-value mt-2 text-[26px] lab-mono">
            {(totals.totalRevenue / 1000).toFixed(0)}k
          </div>
          <div className="lab-stat-foot">LKR combined pricing</div>
        </div>
      </section>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="lab-section-title flex items-center gap-2">
          <Layers size={14} className="text-[var(--lab-brand)]" />
          Bundled offerings
        </div>
        <div className="lab-topbar-search !max-w-[280px]">
          <Search size={14} className="lab-topbar-search-icon" />
          <input
            type="search"
            placeholder="Filter packages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="lab-card lab-card-pad">
              <div className="lab-skel h-5 w-2/3 mb-3" />
              <div className="lab-skel h-3 w-full mb-2" />
              <div className="lab-skel h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="lab-empty">
          <div className="lab-empty-icon">
            <PackageOpen size={26} strokeWidth={1.8} />
          </div>
          <div className="lab-empty-title">
            {search ? "No packages match" : "No packages yet"}
          </div>
          <p className="lab-empty-msg">
            {search
              ? `Nothing matches "${search}".`
              : "Group complementary tests into discounted bundles for screening cohorts."}
          </p>
          {!search && (
            <button
              type="button"
              className="lab-btn lab-btn-primary mt-5"
              onClick={openCreate}
            >
              <Plus size={14} />
              Create your first package
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pkg) => {
            const savings =
              pkg.discountPrice != null
                ? Math.round(((pkg.price - pkg.discountPrice) / pkg.price) * 100)
                : 0;
            return (
              <article key={pkg.id} className="lab-card overflow-hidden group">
                <div
                  className="px-5 py-4 flex items-start justify-between gap-4 border-b border-[var(--lab-border)]"
                  style={{
                    background:
                      "linear-gradient(120deg, rgba(5,150,105,0.06) 0%, rgba(29,78,216,0.04) 100%)",
                  }}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] grid place-content-center shrink-0">
                      <PackageOpen size={20} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10.5px] tracking-[0.14em] uppercase text-[var(--lab-ink-faint)] lab-mono">
                        /{pkg.slug}
                      </div>
                      <h3 className="text-[16px] font-bold text-[var(--lab-night)] tracking-tight leading-snug mt-0.5">
                        {pkg.name}
                      </h3>
                    </div>
                  </div>
                  <span className="lab-pill" data-status={pkg.isActive ? "active" : "inactive"}>
                    {pkg.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="lab-card-pad space-y-3">
                  {pkg.description && (
                    <p className="text-[13px] text-[var(--lab-ink-soft)] leading-relaxed line-clamp-2">
                      {pkg.description}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--lab-surface-2)] border border-[var(--lab-border)] py-2">
                      <div className="text-[9.5px] tracking-[0.14em] uppercase text-[var(--lab-ink-faint)] lab-mono">
                        Tests
                      </div>
                      <div className="mt-0.5 text-[14px] font-bold text-[var(--lab-night)]">
                        {pkg.testCount ?? 0}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[var(--lab-surface-2)] border border-[var(--lab-border)] py-2">
                      <div className="text-[9.5px] tracking-[0.14em] uppercase text-[var(--lab-ink-faint)] lab-mono">
                        TAT
                      </div>
                      <div className="mt-0.5 text-[14px] font-bold text-[var(--lab-night)] lab-mono">
                        {pkg.turnaroundHours}h
                      </div>
                    </div>
                    <div className="rounded-lg bg-[var(--lab-surface-2)] border border-[var(--lab-border)] py-2">
                      <div className="text-[9.5px] tracking-[0.14em] uppercase text-[var(--lab-ink-faint)] lab-mono">
                        Save
                      </div>
                      <div className="mt-0.5 text-[14px] font-bold text-emerald-600 lab-mono">
                        {savings > 0 ? `${savings}%` : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-[var(--lab-border)]">
                    <div>
                      {pkg.discountPrice != null && (
                        <div className="text-[11.5px] text-[var(--lab-ink-faint)] line-through lab-mono">
                          Rs. {pkg.price.toLocaleString("en-LK")}
                        </div>
                      )}
                      <div className="font-display text-[26px] font-medium text-[var(--lab-night)] lab-mono">
                        Rs. {(pkg.discountPrice ?? pkg.price).toLocaleString("en-LK")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="lab-btn lab-btn-secondary lab-btn-sm"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="lab-label !mb-0">
                      Tests in package
                    </label>
                    <span className="lab-mono text-[11px] text-[var(--lab-ink-faint)]">
                      {form.testIds.length} selected ·{" "}
                      {catalog?.tests.length ?? 0} available
                    </span>
                  </div>
                  <div className="rounded-xl border border-[var(--lab-border)] max-h-56 overflow-y-auto bg-[var(--lab-surface-2)]">
                    {filteredCatalog.length === 0 ? (
                      <div className="p-4 text-center text-[12.5px] text-[var(--lab-ink-faint)]">
                        <TestTube2 size={18} className="mx-auto mb-1.5 opacity-50" />
                        {search
                          ? `No catalog tests match "${search}"`
                          : "No tests in your catalog yet."}
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--lab-border)]">
                        {filteredCatalog.map((t) => {
                          const checked = form.testIds.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                                checked
                                  ? "bg-[var(--lab-brand-soft)]/40"
                                  : "hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="lab-checkbox"
                                checked={checked}
                                onChange={() => toggleTest(t.id)}
                              />
                              <div className="w-7 h-7 rounded-lg bg-white border border-[var(--lab-border)] grid place-content-center text-[var(--lab-brand)]">
                                <TestTube2 size={13} strokeWidth={2.2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12.5px] font-semibold text-[var(--lab-night)] truncate">
                                  {t.name}
                                </div>
                                <div className="text-[10.5px] text-[var(--lab-ink-faint)] lab-mono">
                                  /{t.slug}
                                </div>
                              </div>
                              <div className="text-[12px] font-bold lab-mono text-[var(--lab-night)]">
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
