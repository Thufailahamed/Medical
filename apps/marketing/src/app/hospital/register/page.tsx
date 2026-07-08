"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ChevronRight } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";

export default function RegisterPage() {
  const t = useT();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    tenantType: "hospital" as "hospital" | "clinic",
    facilityName: "",
    licenseNumber: "",
    address: "",
    location: "",
    facilityPhone: "",
    ownerName: "",
    email: "",
    phone: "",
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
          <div className="flex flex-col items-center text-center py-4">
            <div className="h-14 w-14 rounded-full bg-success-soft flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-emerald-700" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {t("register.thankYou")}
            </h1>
            <p className="mt-3 text-sm text-text-muted max-w-sm leading-relaxed">
              {t("auth.pendingApprovalMsg")}
            </p>
            <Link
              href="/hospital/login"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong shadow-sm transition-colors"
            >
              {t("auth.submit")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader
          title={t("register.title")}
          subtitle={t("register.subtitle")}
          icon={<Building2 size={15} className="text-brand" />}
        />

        <div className="my-5 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                  step >= n
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface-2 text-text-muted border border-border"
                )}
              >
                {n}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  step >= n ? "text-text" : "text-text-muted"
                )}
              >
                {t(`register.step${n}` as any)}
              </span>
              {n < 3 && (
                <ChevronRight size={12} className="text-text-muted" />
              )}
            </div>
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
              <FormField label={t("register.facilityType")} required>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.tenantType}
                  onChange={(e) =>
                    setForm({ ...form, tenantType: e.target.value as any })
                  }
                >
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                </select>
              </FormField>
              <FormField label={t("register.facilityName")} required>
                <input
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.facilityName}
                  onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
                />
              </FormField>
              <FormField label={t("register.regNo")} required>
                <input
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                />
              </FormField>
            </>
          )}

          {step === 2 && (
            <>
              <FormField label={t("common.address")}>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </FormField>
              <FormField label={t("register.city")}>
                <input
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </FormField>
              <FormField label={t("register.facilityPhone")}>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.facilityPhone}
                  onChange={(e) => setForm({ ...form, facilityPhone: e.target.value })}
                />
              </FormField>
            </>
          )}

          {step === 3 && (
            <>
              <FormField label={t("register.ownerName")} required>
                <input
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                />
              </FormField>
              <FormField label={t("common.email")} required>
                <input
                  required
                  type="email"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label={t("register.phoneOptional")}>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormField>
              <FormField label={t("auth.passwordLabel")} required>
                <input
                  required
                  type="password"
                  minLength={8}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </FormField>
            </>
          )}

          <div className="mt-4 flex justify-between gap-2">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                {t("common.back")}
              </Button>
            ) : (
              <Link
                href="/hospital/login"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {t("auth.backToSite")}
              </Link>
            )}
            <Button type="submit" disabled={submitting}>
              {step < 3
                ? t("common.next")
                : submitting
                ? t("common.loading")
                : t("common.submit")}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}