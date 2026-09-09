"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export default function LabRegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    licenseNumber: "",
    accreditation: "",
    address: "",
    city: "",
    operatingHours: "",
    bankAccount: "",
    bankName: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Laboratory onboarding → POST /auth/register with role: laboratory.
      // Extra profile fields (license/accreditation/address/hours/bank) are
      // collected here for admin review; the auth endpoint persists the
      // account as pending approval.
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: "laboratory",
          licenseNumber: form.licenseNumber.trim(),
          accreditation: form.accreditation.trim() || undefined,
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          operatingHours: form.operatingHours.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Registration failed (${res.status})`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl py-12 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Application received</h1>
          <p className="mt-3 text-sm text-gray-500">
            Your laboratory account is pending administrator approval. We will notify you once reviewed.
          </p>
          <Link href="/lab-portal/login" className="mt-6 inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Register your laboratory</h1>
        <p className="text-sm text-gray-500 mt-1">
          License, accreditation, address, hours and bank details help admins verify you faster.
        </p>
        <form onSubmit={submit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700">
            Lab name *
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="City Diagnostics" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            License number *
            <input required value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="LAB-2024-001" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Accreditation
            <input value={form.accreditation} onChange={(e) => set("accreditation", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="ISO 15189 / SLAB" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Operating hours
            <input value={form.operatingHours} onChange={(e) => set("operatingHours", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="Mon–Sat 7am–9pm" />
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            Address *
            <textarea required rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="Street, city, district" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            City
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="Colombo" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Contact phone *
            <input required type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="0771234567" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Email *
            <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="lab@example.com" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Password *
            <input required type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="Min 8 characters" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Bank name
            <input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="Bank of Ceylon" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Bank account (payouts)
            <input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-xl font-normal" placeholder="1234567890" />
          </label>
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="md:col-span-2 flex justify-between gap-2 mt-2">
            <Link href="/lab-portal/login" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
              Back to login
            </Link>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
