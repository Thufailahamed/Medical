"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Mail,
  Lock,
} from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Field, Input } from "@/portal/components/ui/Form";
import { login } from "@/hospital/lib/auth";
import { useAuthStore, hasHospitalRole } from "@/hospital/stores/auth";
import { friendlyError } from "@/hospital/lib/errors";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/hospital/i18n";

const schema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function HospitalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text-soft">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/hospital/dashboard";
  const t = useT();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const id = values.identifier.trim();
      const isEmail = id.includes("@");
      const user = await login({
        ...(isEmail ? { email: id } : { phone: id }),
        password: values.password,
      });

      if (!hasHospitalRole(user, "hospital_admin", "hospital_staff", "pharmacy", "laboratory", "super_admin")) {
        toast.error(t("auth.wrongPortal"), t("auth.wrongPortalMsg"));
        useAuthStore.getState().logout();
        setSubmitting(false);
        return;
      }

      if (user.status === "pending") {
        toast.info(t("auth.pendingApproval"), t("auth.pendingApprovalMsg"));
        useAuthStore.getState().logout();
        setSubmitting(false);
        return;
      }
      if (user.status === "rejected") {
        toast.error(t("auth.rejected"), t("auth.rejectedMsg"));
        useAuthStore.getState().logout();
        setSubmitting(false);
        return;
      }

      router.replace(next);
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Branding column */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-sky-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[360px] h-[360px] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between p-10 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shadow-lg">
              <Building2 size={22} strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-wide">HEALTHHUB</div>
              <div className="text-[11px] tracking-[0.2em] uppercase opacity-80">
                Hospital Portal
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
              Wards, patients, pharmacy, billing — all in one console.
            </h1>
            <p className="text-sm opacity-80 mt-3 leading-relaxed">
              Manage admissions, dispense prescriptions, upload lab results,
              and run reports. Reuses portal primitives so staff feel at home.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/10">
                <ShieldCheck size={12} /> HIPAA-aligned RBAC
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/10">
                Mobile-synced records
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/10">
                Multi-tenant isolation
              </span>
            </div>
          </div>

          <div className="text-[11px] opacity-70">
            © {new Date().getFullYear()} HealthHub (Pvt) Ltd.
          </div>
        </div>
      </div>

      {/* Form column */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-text-muted uppercase">
              HealthHub · Hospital
            </span>
            <h2 className="text-2xl font-extrabold text-text tracking-tight">
              {t("auth.loginTitle")}
            </h2>
            <p className="text-sm text-text-soft leading-relaxed">
              {t("auth.loginSubtitle")}
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label={t("auth.identifierLabel")} error={errors.identifier?.message}>
              <div className="portal-input-search-wrap">
                <Mail
                  size={15}
                  className="portal-input-search-icon"
                  aria-hidden
                />
                <Input
                  {...register("identifier")}
                  type="text"
                  placeholder={t("auth.identifierPlaceholder")}
                  autoComplete="username"
                  aria-invalid={!!errors.identifier}
                />
              </div>
            </Field>

            <Field label={t("auth.passwordLabel")} error={errors.password?.message}>
              <div className="portal-input-search-wrap">
                <Lock
                  size={15}
                  className="portal-input-search-icon"
                  aria-hidden
                />
                <Input
                  {...register("password")}
                  type="password"
                  placeholder={t("auth.passwordPlaceholder")}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                />
              </div>
            </Field>

            {error && (
              <div
                role="alert"
                className="px-3 py-2 rounded-lg border border-danger/30 bg-danger-soft text-[12px] font-medium text-danger"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="mt-2"
            >
              {submitting ? t("auth.submitting") : t("auth.submit")} <ArrowRight size={14} />
            </Button>
          </form>

          <div className="mt-6 text-[12px] text-text-soft flex flex-col gap-1.5">
            <span>{t("auth.registerPrompt")} <a className="text-brand font-semibold hover:underline" href="/hospital/register">{t("auth.registerLink")}</a></span>
            <a href="/" className="text-text-muted hover:text-text-soft">
              {t("auth.backToSite")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}