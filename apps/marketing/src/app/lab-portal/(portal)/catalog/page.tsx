"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLabCatalog, useCreateTest, useDeleteTest } from "../../hooks/useApi";
import { api } from "../../lib/api";

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
  const [form, setForm] = useState({
    name: "", slug: "", category: "blood", sampleType: "blood",
    price: "", description: "", fastingRequired: false, fastingHours: "0",
    turnaroundHours: "24", homeCollectionAvailable: true, instructions: "",
  });

  // ─── New availability UI (GET/POST/PATCH/DELETE /lab-portal/diagnostic-tests-availability + bulk-toggle) ───
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
      // Enable test via POST /lab-portal/diagnostic-tests-availability
      await api("/lab-portal/diagnostic-tests-availability", {
        method: "POST",
        body: {
          testId: enableForm.testId.trim(),
          price: Number(enableForm.price),
          ...(enableForm.discountPrice ? { discountPrice: Number(enableForm.discountPrice) } : {}),
        },
      });
      setEnableForm({ testId: "", price: "", discountPrice: "" });
      await refreshAvailability();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : "Enable failed");
    }
  }

  async function handleToggleActive(row: AvailabilityRow, next: boolean) {
    if (!row.id) return;
    // Update via PATCH /lab-portal/diagnostic-tests-availability/:id
    await api(`/lab-portal/diagnostic-tests-availability/${row.id}`, {
      method: "PATCH",
      body: { isActive: next },
    });
    await refreshAvailability();
  }

  async function handleDelete(row: AvailabilityRow) {
    if (!row.id) return;
    // Soft-deactivate via DELETE /lab-portal/diagnostic-tests-availability/:id
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
      // Bulk-toggle via POST /lab-portal/diagnostic-tests-availability/bulk-toggle
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTest.mutateAsync({
      name: form.name,
      slug: form.slug,
      category: form.category as any,
      sampleType: form.sampleType as any,
      price: Number(form.price),
      description: form.description || null,
      fastingRequired: form.fastingRequired,
      fastingHours: Number(form.fastingHours),
      turnaroundHours: Number(form.turnaroundHours),
      homeCollectionAvailable: form.homeCollectionAvailable,
      instructions: form.instructions || null,
    });
    setShowForm(false);
    setForm({ name: "", slug: "", category: "blood", sampleType: "blood", price: "", description: "", fastingRequired: false, fastingHours: "0", turnaroundHours: "24", homeCollectionAvailable: true, instructions: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Catalog</h1>
          <p className="text-gray-500 mt-1">Manage your diagnostic tests</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition"
        >
          + Add Test
        </button>
      </div>

      {/* ─── Availability (new canonical UI) ─── */}
      <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-900">Availability</h2>
        <p className="text-xs text-gray-500 mt-1">
          Per-lab availability from GET /lab-portal/diagnostic-tests-availability. Use bulk-toggle to enable/disable many tests at once.
        </p>

        <form onSubmit={handleEnable} className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <input
            placeholder="Canonical testId"
            value={enableForm.testId}
            onChange={(e) => setEnableForm({ ...enableForm, testId: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm"
            required
          />
          <input
            type="number"
            min={1}
            placeholder="Price (LKR)"
            value={enableForm.price}
            onChange={(e) => setEnableForm({ ...enableForm, price: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm"
            required
          />
          <input
            type="number"
            min={1}
            placeholder="Discount (optional)"
            value={enableForm.discountPrice}
            onChange={(e) => setEnableForm({ ...enableForm, discountPrice: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-700">
            Enable Test
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <input
            type="number"
            min={1}
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm"
            title="Bulk enable price"
          />
          <button
            onClick={() => handleBulkToggle(true)}
            className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200"
          >
            Bulk Enable ({selected.size})
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Bulk Disable
          </button>
          <button onClick={() => refreshAvailability()} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            Refresh
          </button>
        </div>
        {availError && <p className="text-sm text-red-600 mt-2">{availError}</p>}

        <div className="mt-4 space-y-2">
          {availability.isLoading ? (
            <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
          ) : (availability.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">No availability rows yet. Enable a canonical test above.</p>
          ) : (
            availability.data?.items.map((row) => (
              <div key={row.testSlug} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(row.testSlug)}
                  onChange={() => toggleSelect(row.testSlug)}
                  className="accent-emerald-600"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{row.testName}</p>
                  <p className="text-xs text-gray-500">
                    {row.testSlug} • Rs. {row.price.toLocaleString("en-LK")}
                    {row.discountPrice ? ` (now Rs. ${row.discountPrice.toLocaleString("en-LK")})` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleActive(row, false)}
                  className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded-lg"
                >
                  Disable
                </button>
                <button
                  onClick={() => handleDelete(row)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Test Form (legacy fallback: POST /lab-portal/catalog) */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add New Test (legacy catalog)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Test name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" required />
            <input placeholder="Slug (URL-friendly)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" required />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <select value={form.sampleType} onChange={(e) => setForm({ ...form, sampleType: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl">
              {["blood", "urine", "stool", "saliva", "swab", "other"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" placeholder="Price (LKR)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" required />
            <input type="number" placeholder="Turnaround hours" value={form.turnaroundHours} onChange={(e) => setForm({ ...form, turnaroundHours: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl md:col-span-2 h-24 resize-none" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Create via /lab-portal/catalog</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Legacy catalog list (fallback) */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Legacy catalog (fallback)</h2>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : data?.tests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <p className="text-gray-500">No tests in your catalog yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.tests.map((test) => (
            <div key={test.id} className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{test.name}</h3>
                <p className="text-sm text-gray-500">
                  {test.category.replace(/_/g, " ")} • {test.sampleType} • Rs. {test.price.toLocaleString("en-LK")}
                  {test.fastingRequired ? " • Fasting required" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${test.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {test.isActive ? "Active" : "Inactive"}
                </span>
                <button onClick={() => deleteTest.mutate(test.id)} className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm">
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
