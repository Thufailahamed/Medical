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
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  Badge,
  PanelSkeleton,
} from "@/patient/components/workspace";

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

  const canonicalCount = availability.data?.items.length ?? 0;
  const customCount = data?.tests.length ?? 0;
  const activeCustom = (data?.tests ?? []).filter((t) => t.isActive).length;

  return (
    <div className="lab-page flex flex-col gap-6">
      <DoctorHero
        kicker="Service catalog"
        kickerIcon={<FlaskConical size={12} />}
        kickerMeta={`${canonicalCount + customCount} total`}
        title="Diagnostic test catalog"
        description="Activate canonical diagnostic tests, set your pricing, and curate the patient-facing catalog."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Layers size={12} /> {canonicalCount} canonical bindings
            </span>
            <span className={HERO_CHIP}>
              <Tag size={12} /> {customCount} custom tests
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<FlaskConical size={18} />}
            label="Live for patients"
            value={canonicalCount + activeCustom}
            sub="Bookable right now"
          />
        }
        actions={
          <>
            <button
              type="button"
              className={HERO_GHOST}
              onClick={() => setShowAvailabilityForm(true)}
            >
              <Layers size={14} /> Enable canonical test
            </button>
            <button
              type="button"
              className={HERO_PRIMARY}
              onClick={() => setShowForm(true)}
            >
              <Plus size={14} /> Create custom test
            </button>
          </>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Canonical bindings"
            icon={<Layers size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(canonicalCount)}
            sub="Facility availability rows"
          />
          <StatTile
            label="Custom tests"
            icon={<Tag size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(customCount)}
            sub="Lab-authored entries"
          />
          <StatTile
            label="Active customs"
            icon={<Check size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(activeCustom)}
            sub="Visible to patients"
          />
          <StatTile
            label="Selected rows"
            icon={<ToggleRight size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(selected.size)}
            sub="For bulk toggle"
            pulse={selected.size > 0}
          />
        </div>
      </HeroOverlap>

      {/* ── Availability (canonical) ── */}
      <section className={PANEL}>
        <PanelHeader
          icon={<Layers size={16} />}
          tone="bg-sky-50 text-sky-600"
          title="Facility availability"
          caption="Canonical tests bound to this facility with local pricing"
          action={
            <span className="flex items-center gap-2">
              <Badge tone="sky">{canonicalCount} rows</Badge>
              <button
                type="button"
                onClick={() => refreshAvailability()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </span>
          }
        />

        <div className="mt-4 space-y-4">
          {/* Bulk controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400">
              Bulk toggle
            </span>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-[11.5px] text-slate-500">
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
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => handleBulkToggle(true)}
                disabled={selected.size === 0}
              >
                <ToggleRight size={13} />
                Enable ({selected.size})
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
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

          <div className="overflow-hidden rounded-xl border border-slate-200">
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
                      <div className="py-10 text-center text-[13px] text-slate-500">
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
                          <div className="grid h-8 w-8 place-content-center rounded-lg bg-emerald-50 text-emerald-600">
                            <TestTube2 size={14} strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{row.testName}</div>
                            {row.testCode && (
                              <div className="font-mono text-[11px] text-slate-400">
                                {row.testCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-[11.5px] text-slate-500">
                          {row.testSlug}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">
                            {row.price.toLocaleString("en-LK")}
                          </span>
                          {row.discountPrice ? (
                            <span className="text-[11.5px] font-semibold text-emerald-600">
                              → {row.discountPrice.toLocaleString("en-LK")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-[11.5px] text-slate-500">
                          {row.turnaroundHours ? `${row.turnaroundHours}h` : "—"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => handleToggleActive(row, false)}
                          >
                            <Power size={12} />
                            Disable
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
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
      </section>

      {/* ── Custom catalog ── */}
      <section className={PANEL}>
        <PanelHeader
          icon={<Tag size={16} />}
          tone="bg-violet-50 text-violet-600"
          title="Custom tests"
          caption="Lab-authored tests pushed via POST /lab-portal/catalog"
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter custom tests…"
              ariaLabel="Filter custom tests"
            />
          }
        />

        {isLoading ? (
          <PanelSkeleton rows={3} />
        ) : filteredTests.length === 0 ? (
          <EmptyBlock
            icon={<FlaskConical size={19} />}
            title={search ? "No tests match" : "No custom tests yet"}
            body={
              search
                ? `Nothing matches "${search}".`
                : "Add lab-authored tests for specialized panels."
            }
          />
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
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
                          <div className="truncate font-semibold text-slate-900">{test.name}</div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                            {test.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-[12.5px] text-slate-500">
                        <span className="capitalize">{test.category.replace(/_/g, " ")}</span>
                        {" · "}
                        <span className="capitalize">{test.sampleType}</span>
                      </div>
                      {test.fastingRequired && (
                        <div className="mt-0.5 text-[11px] text-amber-600">
                          Fasting required ({test.fastingHours}h)
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono font-semibold">
                        {test.price.toLocaleString("en-LK")}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[11.5px] text-slate-500">
                        {test.turnaroundHours}h
                      </span>
                    </td>
                    <td>
                      <Badge tone={test.isActive ? "emerald" : "slate"}>
                        {test.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
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
          </div>
        )}
      </section>

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
                  <div className="mt-0.5 break-words text-[11.5px]">
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
              <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1. Test Identification
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
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
            <div className="border-t border-slate-200/60 pt-2">
              <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                2. Clinical & Pricing Parameters
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-slate-400">
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-medium text-slate-400">
                      hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles: Fasting & Home Collection */}
              <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Fasting Requirement */}
                <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                        <Clock size={14} className="text-amber-600" />
                        Fasting Required
                      </div>
                      <div className="text-[11.5px] text-slate-500">
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
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200/60 pt-2">
                      <span className="text-[12px] font-medium text-slate-900">
                        Duration (hours):
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={48}
                        value={form.fastingHours}
                        onChange={(e) => setForm({ ...form, fastingHours: e.target.value })}
                        className="lab-input lab-mono !h-8 !w-20 text-center text-xs"
                        placeholder="10"
                      />
                    </div>
                  )}
                </div>

                {/* Home Collection */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <div>
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                      <TestTube2 size={14} className="text-emerald-600" />
                      Home Collection
                    </div>
                    <div className="text-[11.5px] text-slate-500">
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
            <div className="border-t border-slate-200/60 pt-2">
              <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
            <div className="border-t border-slate-200/60 pt-2">
              <label className="lab-label mb-2 flex items-center gap-1.5">
                <ImageIcon size={12} />
                Test Cover Image <span className="font-normal normal-case text-slate-400">(optional)</span>
              </label>

              {imageFile && imagePreview ? (
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <img
                    src={imagePreview}
                    alt="Test preview"
                    className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-slate-900">
                      {imageFile.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
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
                      className="lab-btn lab-btn-secondary lab-btn-sm text-red-600 hover:border-red-200 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="lab-dropzone flex flex-col items-center justify-center gap-2 p-5 text-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-700 shadow-xs">
                    <Upload size={18} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      <span className="text-emerald-700 underline underline-offset-2">Click to upload</span> or drag and drop
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
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
                <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-slate-400">
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-slate-400">
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
              <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
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
          "grid h-9 w-9 shrink-0 place-content-center rounded-lg bg-emerald-50 text-emerald-600"
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
            "grid h-9 w-9 shrink-0 place-content-center rounded-lg bg-emerald-50 text-emerald-600") +
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
        "h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
      }
    />
  );
}
