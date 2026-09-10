"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Power,
  RefreshCw,
  AlertTriangle,
  FlaskConical,
  Tag,
  Layers,
  TestTube2,
  Search,
  Check,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
  Upload,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import {
  useLabCatalog,
  useCreateTest,
  useDeleteTest,
} from "../../hooks/useApi";
import { api, getLabToken } from "../../lib/api";
import { cn } from "@/portal/lib/utils";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORIES = [
  "blood", "urine", "stool", "saliva", "swab", "cardiac", "diabetes",
  "thyroid", "liver", "kidney", "lipid", "vitamin", "hormone",
  "cancer_marker", "infection", "allergy", "genetic", "imaging", "other",
];

type AvailabilityRow = {
  id?: string;
  labId?: string;
  labPartnerId?: string;
  testSlug: string;
  testName: string;
  testCode?: string | null;
  price: number;
  discountPrice?: number | null;
  currency?: string;
  homeCollectionAvailable?: boolean;
  labCollectionAvailable?: boolean;
  turnaroundHours?: number | null;
  lastToggledAt?: string;
};

export default function CatalogPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useLabCatalog();
  const createTest = useCreateTest();
  const deleteTest = useDeleteTest();

  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "", slug: "", category: "blood", sampleType: "blood",
    price: "", description: "", fastingRequired: false, fastingHours: "0",
    turnaroundHours: "24", homeCollectionAvailable: true, instructions: "",
  });

  // Image upload state for the Add custom test modal
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Derive preview URL via useMemo and revoke upon change/unmount
  const imagePreview = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function resetImageState() {
    setImageFile(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  const availability = useQuery({
    queryKey: ["lab-availability"],
    queryFn: () =>
      api<{ items: AvailabilityRow[] }>("/lab-portal/diagnostic-tests-availability?includeInactive=true"),
  });
  const [enableForm, setEnableForm] = useState({ testId: "", price: "", discountPrice: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [availError, setAvailError] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("1500");

  async function refreshAvailability() {
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["lab-availability"] });
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setAvailError(null);
    try {
      await api("/lab-portal/diagnostic-tests-availability", {
        method: "POST",
        body: {
          testId: enableForm.testId.trim(),
          price: Number(enableForm.price),
          ...(enableForm.discountPrice ? { discountPrice: Number(enableForm.discountPrice) } : {}),
        },
      });
      setEnableForm({ testId: "", price: "", discountPrice: "" });
      setShowAvailabilityForm(false);
      await refreshAvailability();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : "Enable failed");
    }
  }

  async function handleToggleActive(row: AvailabilityRow, next: boolean) {
    if (!row.id) return;
    await api(`/lab-portal/diagnostic-tests-availability/${row.id}`, {
      method: "PATCH",
      body: { isActive: next },
    });
    await refreshAvailability();
  }

  async function handleDelete(row: AvailabilityRow) {
    if (!row.id) return;
    await api(`/lab-portal/diagnostic-tests-availability/${row.id}`, { method: "DELETE" });
    await refreshAvailability();
  }

  async function handleBulkToggle(enabled: boolean) {
    setAvailError(null);
    try {
      const testIds = Array.from(selected);
      if (testIds.length === 0) {
        setAvailError("Select at least one row for bulk-toggle.");
        return;
      }
      await api(`/lab-portal/diagnostic-tests-availability/bulk-toggle`, {
        method: "POST",
        body: {
          testIds,
          enabled,
          ...(enabled ? { price: Number(bulkPrice) || 1500 } : {}),
        },
      });
      await refreshAvailability();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : "Bulk toggle failed");
    }
  }

  function toggleSelect(testSlug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(testSlug)) next.delete(testSlug);
      else next.add(testSlug);
      return next;
    });
  }

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImageError(null);
    setSubmitError(null);
    let imageR2Key: string | null = null;
    if (imageFile) {
      setImageUploading(true);
      try {
        const res = await uploadTestImage(imageFile);
        imageR2Key = res.r2Key;
      } catch (err) {
        setImageError(err instanceof Error ? err.message : "Image upload failed");
        setImageUploading(false);
        return;
      } finally {
        setImageUploading(false);
      }
    }
    try {
      await createTest.mutateAsync({
        name: form.name,
        slug: form.slug,
        category: form.category as Parameters<typeof createTest.mutateAsync>[0]["category"],
        sampleType: form.sampleType as Parameters<typeof createTest.mutateAsync>[0]["sampleType"],
        price: Number(form.price),
        description: form.description || null,
        fastingRequired: form.fastingRequired,
        fastingHours: Number(form.fastingHours),
        turnaroundHours: Number(form.turnaroundHours),
        homeCollectionAvailable: form.homeCollectionAvailable,
        instructions: form.instructions || null,
        imageR2Key,
      });
      setShowForm(false);
      setForm({ name: "", slug: "", category: "blood", sampleType: "blood", price: "", description: "", fastingRequired: false, fastingHours: "0", turnaroundHours: "24", homeCollectionAvailable: true, instructions: "" });
      resetImageState();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create test");
    }
  };

  const filteredTests = (data?.tests ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
  });

  return (
    <div className="lab-page">
      {/* ── Page head ── */}
      <div className="lab-page-head">
        <div>
          <span className="lab-page-eyebrow">
            <FlaskConical size={10} />
            Service Catalog
          </span>
          <h1 className="lab-page-title">
            Test <strong>catalog</strong>
          </h1>
          <p className="lab-page-sub">
            Activate canonical diagnostic tests, set your pricing, and curate
            the patient-facing catalog.
          </p>
        </div>
        <div className="lab-page-actions">
          <button
            type="button"
            className="lab-btn lab-btn-secondary"
            onClick={() => setShowAvailabilityForm(true)}
          >
            <Plus size={14} />
            Enable canonical test
          </button>
          <button
            type="button"
            className="lab-btn lab-btn-primary"
            onClick={() => setShowForm(true)}
          >
            <Plus size={14} />
            Create custom test
          </button>
        </div>
      </div>

      {/* ── Availability (canonical) ── */}
      <div className="lab-card mb-6">
        <div className="lab-card-head">
          <div>
            <div className="lab-card-title">
              <Layers size={15} />
              Facility availability
            </div>
            <div className="lab-card-sub">
              Pulled from GET /lab-portal/diagnostic-tests-availability.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-[var(--lab-ink-soft)] lab-mono">
              {availability.data?.items.length ?? 0} active
            </span>
            <button
              type="button"
              className="lab-btn lab-btn-ghost lab-btn-sm"
              onClick={() => refreshAvailability()}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>

        <div className="lab-card-pad space-y-4">
          {/* Bulk controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--lab-surface-2)] border border-[var(--lab-border)] p-3">
            <span className="text-[10.5px] tracking-[0.14em] uppercase text-[var(--lab-ink-faint)] lab-mono">
              Bulk toggle
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-[11.5px] text-[var(--lab-ink-soft)]">
                Price (LKR)
              </label>
              <input
                type="number"
                min={1}
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="lab-input lab-mono !w-24 !h-9 !text-[12px]"
              />
              <button
                type="button"
                className="lab-btn lab-btn-soft lab-btn-sm"
                onClick={() => handleBulkToggle(true)}
                disabled={selected.size === 0}
              >
                <ToggleRight size={13} />
                Enable ({selected.size})
              </button>
              <button
                type="button"
                className="lab-btn lab-btn-secondary lab-btn-sm"
                onClick={() => handleBulkToggle(false)}
                disabled={selected.size === 0}
              >
                <ToggleLeft size={13} />
                Disable
              </button>
            </div>
          </div>

          {availError && (
            <div className="lab-banner lab-banner-danger">
              <div className="lab-banner-icon">
                <AlertTriangle size={14} />
              </div>
              <div>{availError}</div>
            </div>
          )}

          <div className="lab-card !border !border-[var(--lab-border)] !shadow-none overflow-hidden">
            <table className="lab-table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Test</th>
                  <th>Slug</th>
                  <th>Pricing (LKR)</th>
                  <th>Turnaround</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {availability.isLoading ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <div className="lab-skel h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (availability.data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-10 text-center text-[13px] text-[var(--lab-ink-soft)]">
                        No availability rows yet. Click <strong>Enable canonical test</strong> above to add one.
                      </div>
                    </td>
                  </tr>
                ) : (
                  availability.data?.items.map((row) => (
                    <tr key={row.testSlug}>
                      <td>
                        <input
                          type="checkbox"
                          className="lab-checkbox"
                          checked={selected.has(row.testSlug)}
                          onChange={() => toggleSelect(row.testSlug)}
                          aria-label={`Select ${row.testName}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] grid place-content-center">
                            <TestTube2 size={14} strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--lab-night)]">{row.testName}</div>
                            {row.testCode && (
                              <div className="text-[11px] text-[var(--lab-ink-faint)] lab-mono">
                                {row.testCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="lab-mono text-[11.5px] text-[var(--lab-ink-soft)]">
                          {row.testSlug}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">
                            {row.price.toLocaleString("en-LK")}
                          </span>
                          {row.discountPrice ? (
                            <span className="text-[11.5px] text-emerald-600 font-semibold">
                              → {row.discountPrice.toLocaleString("en-LK")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="lab-mono text-[11.5px] text-[var(--lab-ink-soft)]">
                          {row.turnaroundHours ? `${row.turnaroundHours}h` : "—"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="lab-btn lab-btn-ghost lab-btn-sm"
                            onClick={() => handleToggleActive(row, false)}
                          >
                            <Power size={12} />
                            Disable
                          </button>
                          <button
                            type="button"
                            className="lab-btn lab-btn-ghost lab-btn-sm !text-[var(--lab-danger)] hover:!bg-[var(--lab-danger-soft)]"
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Custom catalog ── */}
      <div className="lab-card">
        <div className="lab-card-head">
          <div>
            <div className="lab-card-title">
              <Tag size={15} />
              Custom tests
            </div>
            <div className="lab-card-sub">
              Lab-authored tests pushed via POST /lab-portal/catalog.
            </div>
          </div>
          <div className="lab-topbar-search !max-w-[260px]">
            <Search size={14} className="lab-topbar-search-icon" />
            <input
              type="search"
              placeholder="Filter custom tests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="lab-skel h-12 w-full" />
              ))}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="lab-empty !border-0 !bg-transparent">
              <div className="lab-empty-icon">
                <FlaskConical size={26} strokeWidth={1.8} />
              </div>
              <div className="lab-empty-title">
                {search ? "No tests match" : "No custom tests yet"}
              </div>
              <p className="lab-empty-msg">
                {search
                  ? `Nothing matches "${search}".`
                  : "Add lab-authored tests for specialized panels."}
              </p>
            </div>
          ) : (
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Category · Sample</th>
                  <th>Pricing</th>
                  <th>TAT</th>
                  <th>Status</th>
                  <th className="text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => (
                  <tr key={test.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <TestImage r2Key={test.imageR2Key} alt={test.name} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--lab-night)] truncate">{test.name}</div>
                          <div className="text-[11px] text-[var(--lab-ink-faint)] lab-mono mt-0.5 truncate">
                            {test.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-[12.5px] text-[var(--lab-ink-soft)]">
                        <span className="capitalize">{test.category.replace(/_/g, " ")}</span>
                        {" · "}
                        <span className="capitalize">{test.sampleType}</span>
                      </div>
                      {test.fastingRequired && (
                        <div className="text-[11px] text-[var(--lab-warn)] mt-0.5">
                          Fasting required ({test.fastingHours}h)
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold lab-mono">
                        {test.price.toLocaleString("en-LK")}
                      </span>
                    </td>
                    <td>
                      <span className="lab-mono text-[11.5px] text-[var(--lab-ink-soft)]">
                        {test.turnaroundHours}h
                      </span>
                    </td>
                    <td>
                      <span className="lab-pill" data-status={test.isActive ? "active" : "inactive"}>
                        {test.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="lab-btn lab-btn-ghost lab-btn-sm !text-[var(--lab-danger)]"
                        onClick={() => deleteTest.mutate(test.id)}
                      >
                        <Trash2 size={12} />
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add custom test modal ── */}
      {showForm && (
        <ModalShell
          onClose={() => setShowForm(false)}
          title="Add Custom Diagnostic Test"
          subtitle="Author a lab-owned test entry that bypasses the canonical registry."
          icon={<FlaskConical size={20} strokeWidth={2.2} />}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="lab-btn lab-btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-custom-test-form"
                className="lab-btn lab-btn-primary"
                disabled={imageUploading}
              >
                {imageUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading image…
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Create Diagnostic Test
                  </>
                )}
              </button>
            </>
          }
        >
          <form id="add-custom-test-form" onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="lab-banner lab-banner-danger" role="alert">
                <div className="lab-banner-icon">
                  <AlertTriangle size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Could not create test</div>
                  <div className="text-[11.5px] mt-0.5 break-words">
                    {submitError}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError(null)}
                  className="text-rose-600 hover:text-rose-800"
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            {/* Section 1: Identification */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--lab-ink-faint)] mb-2.5">
                1. Test Identification
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="lab-field md:col-span-2">
                  <label className="lab-label">
                    Test name <span className="lab-label-req">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const nextSlug = slugify(val);
                      setForm((prev) => ({
                        ...prev,
                        name: val,
                        slug: prev.slug === "" || prev.slug === slugify(prev.name) ? nextSlug : prev.slug,
                      }));
                    }}
                    placeholder="e.g. Executive Wellness Panel"
                    className="lab-input"
                  />
                </div>

                <div className="lab-field">
                  <label className="lab-label">
                    URL Slug <span className="lab-label-req">*</span>
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="executive-wellness-panel"
                    className="lab-input lab-mono"
                  />
                </div>

                <div className="lab-field">
                  <label className="lab-label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="lab-input capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Clinical & Pricing Parameters */}
            <div className="pt-2 border-t border-[var(--lab-border)]/60">
              <div className="text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--lab-ink-faint)] mb-2.5">
                2. Clinical & Pricing Parameters
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="lab-field">
                  <label className="lab-label">Sample type</label>
                  <select
                    value={form.sampleType}
                    onChange={(e) => setForm({ ...form, sampleType: e.target.value })}
                    className="lab-input capitalize"
                  >
                    {["blood", "urine", "stool", "saliva", "swab", "other"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lab-field">
                  <label className="lab-label">
                    Price (LKR) <span className="lab-label-req">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold font-mono text-[var(--lab-ink-faint)]">
                      LKR
                    </span>
                    <input
                      required
                      type="number"
                      min={1}
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="lab-input lab-mono !pl-12"
                      placeholder="4500"
                    />
                  </div>
                </div>

                <div className="lab-field">
                  <label className="lab-label">Turnaround (hours)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={form.turnaroundHours}
                      onChange={(e) => setForm({ ...form, turnaroundHours: e.target.value })}
                      className="lab-input lab-mono !pr-14"
                      placeholder="24"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-[var(--lab-ink-faint)]">
                      hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles: Fasting & Home Collection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
                {/* Fasting Requirement */}
                <div className="p-3.5 rounded-xl border border-[var(--lab-border)] bg-[var(--lab-surface-2)] flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-bold text-[var(--lab-night)] flex items-center gap-1.5">
                        <Clock size={14} className="text-amber-600" />
                        Fasting Required
                      </div>
                      <div className="text-[11.5px] text-[var(--lab-ink-soft)]">
                        Patient must fast prior to collection
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.fastingRequired}
                      onClick={() => setForm((prev) => ({ ...prev, fastingRequired: !prev.fastingRequired }))}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        form.fastingRequired ? "bg-emerald-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          form.fastingRequired ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                  {form.fastingRequired && (
                    <div className="pt-2 border-t border-[var(--lab-border)]/60 flex items-center justify-between gap-3">
                      <span className="text-[12px] font-medium text-[var(--lab-night)]">
                        Duration (hours):
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={48}
                        value={form.fastingHours}
                        onChange={(e) => setForm({ ...form, fastingHours: e.target.value })}
                        className="lab-input lab-mono !w-20 !h-8 text-xs text-center"
                        placeholder="10"
                      />
                    </div>
                  )}
                </div>

                {/* Home Collection */}
                <div className="p-3.5 rounded-xl border border-[var(--lab-border)] bg-[var(--lab-surface-2)] flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--lab-night)] flex items-center gap-1.5">
                      <TestTube2 size={14} className="text-emerald-600" />
                      Home Collection
                    </div>
                    <div className="text-[11.5px] text-[var(--lab-ink-soft)]">
                      Available for doorstep specimen pickup
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.homeCollectionAvailable}
                    onClick={() => setForm((prev) => ({ ...prev, homeCollectionAvailable: !prev.homeCollectionAvailable }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      form.homeCollectionAvailable ? "bg-emerald-600" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        form.homeCollectionAvailable ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Clinical Notes */}
            <div className="pt-2 border-t border-[var(--lab-border)]/60">
              <div className="text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--lab-ink-faint)] mb-2.5">
                3. Clinical Scope & Instructions
              </div>
              <div className="space-y-3">
                <div className="lab-field">
                  <label className="lab-label">Description / Clinical Scope</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief clinical purpose, target analytes, and diagnostic relevance…"
                    className="lab-input"
                  />
                </div>
                <div className="lab-field">
                  <label className="lab-label">Patient Pre-Test Instructions (optional)</label>
                  <input
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    placeholder="e.g. Drink 500ml water prior to arrival; pause biotin supplements 48 hours before test."
                    className="lab-input"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Image Dropzone */}
            <div className="pt-2 border-t border-[var(--lab-border)]/60">
              <label className="lab-label flex items-center gap-1.5 mb-2">
                <ImageIcon size={12} />
                Test Cover Image <span className="text-[var(--lab-ink-faint)] font-normal normal-case">(optional)</span>
              </label>

              {imageFile && imagePreview ? (
                <div className="flex items-center gap-4 p-3 rounded-xl border border-[var(--lab-border)] bg-white shadow-xs">
                  <img
                    src={imagePreview}
                    alt="Test preview"
                    className="w-14 h-14 rounded-lg object-cover border border-[var(--lab-border)] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[var(--lab-night)] truncate">
                      {imageFile.name}
                    </div>
                    <div className="text-[11px] text-[var(--lab-ink-faint)] font-mono">
                      {(imageFile.size / 1024).toFixed(0)} KB · Ready to persist
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="lab-btn lab-btn-secondary lab-btn-sm"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={resetImageState}
                      className="lab-btn lab-btn-secondary lab-btn-sm text-red-600 hover:text-red-700 hover:border-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="lab-dropzone p-5 flex flex-col items-center justify-center text-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-[var(--lab-border)] flex items-center justify-center text-[var(--lab-brand-strong)] shadow-xs">
                    <Upload size={18} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--lab-night)]">
                      <span className="text-[var(--lab-brand-strong)] underline underline-offset-2">Click to upload</span> or drag and drop
                    </div>
                    <div className="text-[11px] text-[var(--lab-ink-faint)] mt-0.5 font-mono">
                      PNG, JPEG, WebP · Max 50 MB · Displayed in patient directory
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={imageInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setImageFile(f);
                    setImageError(null);
                  }
                }}
              />

              {imageError && (
                <p className="mt-1.5 text-[11px] font-semibold text-[var(--lab-danger)]">
                  {imageError}
                </p>
              )}
            </div>
          </form>
        </ModalShell>
      )}

      {/* ── Enable canonical test modal ── */}
      {showAvailabilityForm && (
        <ModalShell
          onClose={() => setShowAvailabilityForm(false)}
          title="Enable Canonical Test"
          subtitle="Bind an existing canonical test to your facility with local pricing."
          icon={<Layers size={20} strokeWidth={2.2} />}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="lab-btn lab-btn-secondary"
                onClick={() => setShowAvailabilityForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="enable-canonical-test-form"
                className="lab-btn lab-btn-primary"
              >
                <Check size={14} />
                Enable Test
              </button>
            </>
          }
        >
          <form id="enable-canonical-test-form" onSubmit={handleEnable} className="space-y-4">
            <div className="lab-field">
              <label className="lab-label">Canonical test ID <span className="lab-label-req">*</span></label>
              <input
                required
                value={enableForm.testId}
                onChange={(e) => setEnableForm({ ...enableForm, testId: e.target.value })}
                placeholder="e.g. cbc-001"
                className="lab-input lab-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="lab-field">
                <label className="lab-label">Price (LKR) <span className="lab-label-req">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold font-mono text-[var(--lab-ink-faint)]">
                    LKR
                  </span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={enableForm.price}
                    onChange={(e) => setEnableForm({ ...enableForm, price: e.target.value })}
                    className="lab-input lab-mono !pl-12"
                    placeholder="1500"
                  />
                </div>
              </div>
              <div className="lab-field">
                <label className="lab-label">Discount Price (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold font-mono text-[var(--lab-ink-faint)]">
                    LKR
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={enableForm.discountPrice}
                    onChange={(e) => setEnableForm({ ...enableForm, discountPrice: e.target.value })}
                    className="lab-input lab-mono !pl-12"
                    placeholder="1200"
                  />
                </div>
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="lab-overlay-host">
      <div className="lab-overlay-backdrop" onClick={onClose} />
      <div
        className={`lab-modal-panel lab-modal-${size}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lab-modal-head">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 grid place-content-center shrink-0">
                {icon}
              </div>
            ) : null}
            <div>
              <div className="lab-modal-title">{title}</div>
              {subtitle ? <div className="lab-modal-sub">{subtitle}</div> : null}
            </div>
          </div>
          <button type="button" className="lab-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="lab-modal-body">{children}</div>
        {footer ? <div className="lab-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ── Image upload helper ─────────────────────────────────────────────
 * POSTs a file to /files/upload, returns the R2 key so the parent
 * form can persist it on the test row. The same endpoint is used by
 * the patient portal for medical records, so it already enforces the
 * magic-byte sniff, MIME allowlist, and 50 MB cap.
 */
async function uploadTestImage(
  file: File
): Promise<{ r2Key: string }> {
  const token = getLabToken();
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "https://api.healthhub.app";
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const body = await res.json();
  const r2Key: string = body.file?.r2Key ?? body.file?.url ?? "";
  if (!r2Key) throw new Error("Upload succeeded but no key was returned.");
  return { r2Key };
}

/* ── TestImage ───────────────────────────────────────────────────────
 * Renders a test's R2-backed image with the user's bearer token.
 * <img src> can't set Authorization headers, so we fetch the bytes
 * with auth and turn them into a blob URL the browser can render.
 * The hook cleans up object URLs to avoid leaks.
 */
function TestImage({
  r2Key,
  alt,
  className,
}: {
  r2Key: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!r2Key) return;
    let cancelled = false;
    const token = getLabToken();
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL || "https://api.healthhub.app";
    const url = r2Key.startsWith("/files")
      ? `${API_BASE}${r2Key}`
      : `${API_BASE}/files/download/${encodeURIComponent(r2Key)}?stream=1`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        setSrc(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      // Revoke on cleanup
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [r2Key]);

  if (!r2Key || failed) {
    return (
      <span
        className={
          className ||
          "w-9 h-9 rounded-lg bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] grid place-content-center shrink-0"
        }
        aria-hidden
      >
        <TestTube2 size={15} strokeWidth={2.2} />
      </span>
    );
  }

  if (!src) {
    return (
      <span
        className={
          (className ||
            "w-9 h-9 rounded-lg bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] grid place-content-center shrink-0") +
          " animate-pulse"
        }
        aria-label={`${alt} (loading)`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={
        className ||
        "w-9 h-9 rounded-lg object-cover border border-[var(--lab-border)] bg-white shrink-0"
      }
    />
  );
}
