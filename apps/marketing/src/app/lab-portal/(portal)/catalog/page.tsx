"use client";

import { useState } from "react";
import { useLabCatalog, useCreateTest, useDeleteTest } from "../../hooks/useApi";

const CATEGORIES = [
  "blood", "urine", "stool", "saliva", "swab", "cardiac", "diabetes",
  "thyroid", "liver", "kidney", "lipid", "vitamin", "hormone",
  "cancer_marker", "infection", "allergy", "genetic", "imaging", "other",
];

export default function CatalogPage() {
  const { data, isLoading } = useLabCatalog();
  const createTest = useCreateTest();
  const deleteTest = useDeleteTest();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", category: "blood", sampleType: "blood",
    price: "", description: "", fastingRequired: false, fastingHours: "0",
    turnaroundHours: "24", homeCollectionAvailable: true, instructions: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTest.mutateAsync({
      name: form.name,
      slug: form.slug,
      category: form.category as any,
      sampleType: form.sampleType as any,
      price: Number(form.price),
      description: form.description || undefined,
      fastingRequired: form.fastingRequired,
      fastingHours: Number(form.fastingHours),
      turnaroundHours: Number(form.turnaroundHours),
      homeCollectionAvailable: form.homeCollectionAvailable,
      instructions: form.instructions || undefined,
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

      {/* Add Test Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add New Test</h2>
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
            <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Tests List */}
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
