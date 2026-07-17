"use client";

import { useState } from "react";
import { usePhlebotomists, useCreatePhlebotomist, useDeletePhlebotomist } from "../../hooks/useApi";

export default function PhlebotomistsPage() {
  const { data, isLoading } = usePhlebotomists();
  const createPhleb = useCreatePhlebotomist();
  const deletePhleb = useDeletePhlebotomist();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPhleb.mutateAsync({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
    });
    setShowForm(false);
    setForm({ name: "", phone: "", email: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phlebotomists</h1>
          <p className="text-gray-500 mt-1">Manage your sample collection team</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition"
        >
          + Add Phlebotomist
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Add Phlebotomist</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" required />
            <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" required />
            <input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 border border-gray-200 rounded-xl" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : data?.phlebotomists.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <p className="text-gray-500">No phlebotomists yet. Add your team members.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.phlebotomists.map((phleb) => (
            <div key={phleb.id} className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-700 font-bold">{phleb.name[0]}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{phleb.name}</h3>
                  <p className="text-sm text-gray-500">{phleb.phone}{phleb.email ? ` • ${phleb.email}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${phleb.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {phleb.isActive ? "Active" : "Inactive"}
                </span>
                <button onClick={() => deletePhleb.mutate(phleb.id)} className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm">
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
