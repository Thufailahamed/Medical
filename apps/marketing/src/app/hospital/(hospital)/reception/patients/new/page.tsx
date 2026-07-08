"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { api } from "@/hospital/lib/api";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function NewPatientPage() {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    address: "",
    nic: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api<{ patient: { id: string; mrn: string } }>(
        "/hospital-portal/patients",
        {
          method: "POST",
          json: {
            name: form.name,
            phone: form.phone || null,
            email: form.email || null,
            dob: form.dob || null,
            gender: form.gender || null,
            bloodGroup: form.bloodGroup || null,
            address: form.address || null,
            nic: form.nic || null,
          },
        }
      );
      toast.success(`Registered · MRN ${res.patient.mrn}`);
      router.push(`/hospital/reception/patients/${res.patient.id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/hospital/reception/patients"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
      >
        <ChevronLeft size={12} />
        {t("common.back")}
      </Link>

      <PageHeader
        title={t("reception.newPatientTitle")}
        subtitle={t("reception.newPatientSubtitle")}
      />

      <Card>
        <CardHeader
          title={t("reception.newPatientTitle")}
          icon={<UserPlus size={15} className="text-brand" />}
        />
        <Form
          onSubmit={submit}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <FormField label={t("common.name")} required>
            <input
              required
              autoFocus
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label={t("common.phone")} required>
            <input
              required
              type="tel"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label={t("common.email")}>
            <input
              type="email"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="NIC">
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.nic}
              onChange={(e) => setForm({ ...form, nic: e.target.value })}
              placeholder="200012345678"
            />
          </FormField>
          <FormField label="DOB">
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </FormField>
          <FormField label={t("patients.overview.gender")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label={t("patients.overview.bloodGroup")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.bloodGroup}
              onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
            >
              <option value="">—</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t("common.address")} className="md:col-span-2">
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand-soft outline-none"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </FormField>
          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.loading") : t("common.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {t("common.cancel")}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
