"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { api } from "@/hospital/lib/api";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

export default function NewPatientPage() {
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api<{ patient: any }>("/patients", {
        method: "POST",
        json: form,
      });
      toast.success("Patient registered");
      router.push("/hospital/reception/patients");
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "reception.newPatientTitle")}
        subtitle={tr(locale, "reception.newPatientSubtitle")}
      />
      <Card>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{tr(locale, "common.name")}</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{tr(locale, "common.phone")}</span>
            <input
              required
              type="tel"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{tr(locale, "common.email")}</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">DOB</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">{tr(locale, "common.address")}</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? tr(locale, "common.loading") : tr(locale, "common.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {tr(locale, "common.cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}