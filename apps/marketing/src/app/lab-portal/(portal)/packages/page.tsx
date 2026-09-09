"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  // modal form state for create/edit package
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      testIds: f.testIds.includes(id) ? f.testIds.filter((t) => t !== id) : [...f.testIds, id],
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
        // Update package via PUT /lab-portal/packages/:id
        await api<{ package: Pkg }>(`/lab-portal/packages/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        // Create package via POST /lab-portal/packages
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Packages</h1>
          <p className="text-gray-500 mt-1">Manage bundled test packages</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition"
        >
          + Create Package
        </button>
      </div>

      {/* create/edit modal form (POST for create, PUT for edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="font-semibold text-gray-900 mb-4">
              {editing ? "Edit Package" : "Create Package"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Package name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl"
                required
              />
              <input
                placeholder="Slug (URL-friendly)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl"
                required
              />
              <input
                type="number"
                min={1}
                placeholder="Price (LKR)"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl"
                required
              />
              <input
                type="number"
                min={1}
                placeholder="Discount price (optional)"
                value={form.discountPrice}
                onChange={(e) => setForm({ ...form, discountPrice: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl"
              />
              <input
                type="number"
                min={1}
                max={720}
                placeholder="Turnaround hours"
                value={form.turnaroundHours}
                onChange={(e) => setForm({ ...form, turnaroundHours: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl md:col-span-2 h-20 resize-none"
              />
              <textarea
                placeholder="Instructions (optional)"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                className="px-4 py-3 border border-gray-200 rounded-xl md:col-span-2 h-20 resize-none"
              />
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Tests in package ({form.testIds.length} selected)
              </p>
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1">
                {catalog?.tests.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.testIds.includes(t.id)}
                      onChange={() => toggleTest(t.id)}
                      className="accent-emerald-600"
                    />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-gray-400 ml-auto">Rs. {t.price.toLocaleString("en-LK")}</span>
                  </label>
                )) ?? <p className="text-xs text-gray-400 p-2">Loading tests…</p>}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-3 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || form.testIds.length === 0}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : data?.packages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <p className="text-gray-500">No packages yet. Create one to offer bundled test discounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                  {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
                  <p className="text-sm text-gray-500 mt-2">
                    {pkg.testCount} tests • Results in {pkg.turnaroundHours}h
                  </p>
                </div>
                <div className="text-right">
                  {pkg.discountPrice && (
                    <p className="text-sm text-gray-400 line-through">Rs. {pkg.price.toLocaleString("en-LK")}</p>
                  )}
                  <p className="text-xl font-bold text-gray-900">
                    Rs. {(pkg.discountPrice ?? pkg.price).toLocaleString("en-LK")}
                  </p>
                  <button
                    onClick={() => openEdit(pkg as Pkg)}
                    className="mt-2 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
