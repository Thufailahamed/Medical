"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, ArrowRight, Mail, Lock } from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Field, Input } from "@/portal/components/ui/Form";
import { login } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { toast } from "@/portal/components/ui/Toast";

const schema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text-soft">Loading…</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/dashboard";

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
      if (user.role !== "super_admin") {
        toast.error(
          "Access denied",
          "This portal is for platform administrators only.",
        );
        useAuthStore.getState().logout();
        setSubmitting(false);
        return;
      }
      router.replace(next);
    } catch (err: any) {
      // Backend returns { code: 'account_pending' | 'account_suspended' | 'account_rejected' }
      // on 403 — surface those verbatim so the admin knows what happened.
      const code = err?.details?.code || err?.code;
      if (code === "account_pending") {
        setError("Your account is pending approval.");
      } else if (code === "account_suspended") {
        setError("Your account is suspended. Contact another admin.");
      } else if (code === "account_rejected") {
        setError("Your admin application was rejected.");
      } else {
        setError(friendlyError(err));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg admin-bg flex">
      {/* Left side — admin branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-600 to-orange-600 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-white/25 flex items-center justify-center">
              <ShieldCheck size={24} strokeWidth={2.25} />
            </div>
            <span className="text-2xl font-bold tracking-wider">HEALTHHUB ADMIN</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Platform
            <br />
            operations,
            <br />
            <span className="text-amber-200">one screen.</span>
          </h1>
          <p className="text-amber-100 text-lg max-w-md leading-relaxed">
            Approve registrations, manage every clinic, doctor, lab and pharmacy,
            oversee payouts, and audit every action — across the entire HealthHub network.
          </p>

          <div className="flex flex-wrap gap-3 mt-10">
            {["Approvals", "User Management", "System Audit", "Payouts"].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full bg-white/20 border border-white/25 text-sm font-medium"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
              <ShieldCheck size={20} strokeWidth={2.25} />
            </div>
            <span className="text-xl font-bold text-text tracking-wider">HEALTHHUB ADMIN</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-text tracking-tight">
              Administrator sign in.
            </h2>
            <p className="text-text-soft mt-3 text-sm leading-relaxed">
              Restricted to platform operators. All actions are audit-logged.
            </p>
          </div>

          {error ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
              <ShieldCheck size={16} className="shrink-0" />
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <Field
              label="Admin email"
              htmlFor="identifier"
              required
              error={errors.identifier?.message}
            >
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  id="identifier"
                  autoComplete="username"
                  placeholder="admin@healthhub.local"
                  className="pl-10"
                  {...register("identifier")}
                />
              </div>
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register("password")}
                />
              </div>
            </Field>

            <Button
              type="submit"
              loading={submitting}
              block
              size="lg"
              className="mt-2 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg shadow-amber-600/25 transition-all"
            >
              {submitting ? (
                "Verifying…"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-text-soft">
              Lost access?{" "}
              <a href="mailto:ops@healthhub.app" className="text-amber-600 hover:text-amber-700 font-medium transition-colors">
                Contact platform ops
              </a>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-text-muted">
              Admin portal v0.1 · All activity is logged with IP + timestamp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}