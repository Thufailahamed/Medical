"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Form, FormField } from "@/portal/components/ui/Form";
import { tr } from "@/hospital/i18n";
import { useAuthStore } from "@/hospital/stores/auth";
import { toast } from "@/portal/components/ui/Toast";

export default function RegisterPage() {
  const locale = useAuthStore((s) => s.locale);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    facilityType: "hospital" as "hospital" | "clinic",
    name: "",
    registrationNo: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    contactName: "",
    contactRole: "hospital_admin",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/auth/register-tenant", {
        method: "POST",
        json: { ...form },
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <h1 className="text-2xl font-semibold">
            {tr(locale, "register.thankYou")}
          </h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {tr(locale, "register.pendingApprovalMsg")}
          </p>
          <Link
            href="/hospital/login"
            className="mt-6 inline-block rounded-lg bg-[var(--accent-600)] px-4 py-2 text-sm font-medium text-white"
          >
            {tr(locale, "auth.submit")}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <h1 className="text-2xl font-semibold">
          {tr(locale, "register.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {tr(locale, "register.subtitle")}
        </p>

        <div className="my-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`rounded-full px-2 py-1 ${
                step >= n
                  ? "bg-[var(--accent-600)] text-white"
                  : "bg-[var(--bg-surface)] border border-[var(--border)]"
              }`}
            >
              {tr(locale, `register.step${n}` as any)}
            </span>
          ))}
        </div>

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) setStep(step + 1);
            else submit(e);
          }}
        >
          {step === 1 && (
            <>
              <FormField label={tr(locale, "register.facilityType")} required>
                <select
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.facilityType}
                  onChange={(e) =>
                    setForm({ ...form, facilityType: e.target.value as any })
                  }
                >
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                </select>
              </FormField>
              <FormField label={tr(locale, "common.name")} required>
                <input
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>
              <FormField label={tr(locale, "register.regNo")}>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.registrationNo}
                  onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
                />
              </FormField>
            </>
          )}

          {step === 2 && (
            <>
              <FormField label={tr(locale, "common.address")}>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </FormField>
              <FormField label={tr(locale, "register.city")}>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </FormField>
              <FormField label={tr(locale, "common.phone")} required>
                <input
                  required
                  type="tel"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormField>
            </>
          )}

          {step === 3 && (
            <>
              <FormField label={tr(locale, "common.email")} required>
                <input
                  required
                  type="email"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label={tr(locale, "register.contactName")} required>
                <input
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </FormField>
              <FormField label={tr(locale, "auth.passwordLabel")} required>
                <input
                  required
                  type="password"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </FormField>
            </>
          )}

          <div className="mt-4 flex justify-between gap-2">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                {tr(locale, "common.back")}
              </Button>
            ) : (
              <Link
                href="/hospital/login"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                {tr(locale, "auth.backToSite")}
              </Link>
            )}
            <Button type="submit" disabled={submitting}>
              {step < 3
                ? tr(locale, "common.next")
                : submitting
                ? tr(locale, "common.loading")
                : tr(locale, "common.submit")}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}