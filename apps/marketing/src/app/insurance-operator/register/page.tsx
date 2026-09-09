"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";

export default function InsuranceOperatorRegisterPage() {
  const [orgName, setOrgName] = useState("");
  const [license, setLicense] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orgName.trim() || !license.trim()) {
      setError("Organisation name and license are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ orgId: string; status: string }>(
        "/insurance-operator/register",
        {
          method: "POST",
          body: {
            orgName: orgName.trim(),
            license: license.trim(),
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
          },
        },
      );
      setOrgId(res.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  if (orgId) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900">
          Application received
        </h1>
        <p className="mt-2 text-gray-600">
          Your insurer onboarding is pending review. Reference:{" "}
          <span className="font-mono">{orgId}</span>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Our team will verify your license and activate publishing access.
        </p>
        <Link
          href="/login?port=operator"
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to operator login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900">
        Register as insurance provider
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Submit your company for onboarding. Plans stay as drafts until an admin
        publishes them.
      </p>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="orgName" className="text-sm font-medium text-gray-700">
            Organisation name
          </label>
          <input
            id="orgName"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Ceylon Health Insurance"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="license" className="text-sm font-medium text-gray-700">
            Regulator license
          </label>
          <input
            id="license"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="IRCSL/LIC/12345"
            className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contactEmail"
              className="text-sm font-medium text-gray-700"
            >
              Contact email
            </label>
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="ops@insurer.lk"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="contactPhone"
              className="text-sm font-medium text-gray-700"
            >
              Contact phone
            </label>
            <input
              id="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0771234567"
              className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
