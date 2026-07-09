"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-text-soft">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/portal/dashboard";

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
      // Route to the correct sub-portal based on role.
      // Patients use the new (patient) route group.
      const isClinician =
        user.role === "doctor" || user.role === "pharmacy";
      if (!isClinician && user.role !== "patient") {
        toast.error(
          "Wrong portal",
          "This portal doesn't support your account type yet. Please use the appropriate sign-in."
        );
        useAuthStore.getState().logout();
        setSubmitting(false);
        return;
      }
      const destination = isClinician
        ? next
        : next.startsWith("/portal")
          ? "/portal/me"
          : next;
      router.replace(destination);
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-500 to-sky-600 relative overflow-hidden">


        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-white/25 flex items-center justify-center">
              <Heart size={24} strokeWidth={2.25} />
            </div>
            <span className="text-2xl font-bold tracking-wider">HEALTHHUB</span>
          </div>

          {/* Hero text */}
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Your clinical
            <br />
            workspace,
            <br />
            <span className="text-sky-200">simplified.</span>
          </h1>
          <p className="text-sky-100 text-lg max-w-md leading-relaxed">
            Manage prescriptions, patient records, and appointments — all in one secure platform built for Sri Lankan healthcare professionals.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-3 mt-10">
            {["E-Prescriptions", "Patient Records", "Clinical Notes", "Lab Orders"].map((feature) => (
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

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo (shown on small screens) */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-sky-500 text-white flex items-center justify-center">
              <Heart size={20} strokeWidth={2.25} />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-wider">HEALTHHUB</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Welcome back.
            </h2>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">
              Sign in to your clinical workspace to manage patients and prescriptions.
            </p>
          </div>

          {/* Error */}
          {error ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
              <ShieldCheck size={16} className="shrink-0" />
              {error}
            </div>
          ) : null}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="relative">
              <Field
                label="Email or phone"
                htmlFor="identifier"
                required
                error={errors.identifier?.message}
              >
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="identifier"
                    autoComplete="username"
                    placeholder="doctor@clinic.lk"
                    className="pl-10"
                    {...register("identifier")}
                  />
                </div>
              </Field>
            </div>

            <div className="relative">
              <Field
                label="Password"
                htmlFor="password"
                required
                error={errors.password?.message}
              >
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            </div>

            <Button
              type="submit"
              loading={submitting}
              block
              size="lg"
              className="mt-2 h-12 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-lg shadow-sky-500/25 transition-all"
            >
              {submitting ? (
                "Signing in…"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign in
                  <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          {process.env.NODE_ENV === "development" && (
            <Button
              type="button"
              variant="secondary"
              block
              size="lg"
              className="mt-3 h-12 rounded-xl border border-dashed border-sky-300 hover:bg-sky-50 text-sky-600 font-semibold transition-all"
              onClick={async () => {
                setError(null);
                setSubmitting(true);
                try {
                  const user = await login({
                    email: "dev-doctor@healthhub.local",
                    password: "dev",
                  });
                  if (user.role !== "doctor" && user.role !== "pharmacy") {
                    toast.error(
                      "Wrong portal",
                      "This portal is for clinician accounts. Use the patient app instead."
                    );
                    useAuthStore.getState().logout();
                    setSubmitting(false);
                    return;
                  }
                  router.replace(next);
                } catch (err) {
                  setError(friendlyError(err));
                  setSubmitting(false);
                }
              }}
            >
              🛠️ Dev Test Login (Auto-seed)
            </Button>
          )}

          {/* Footer links */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Need help signing in?{" "}
              <a href="mailto:support@healthhub.app" className="text-sky-500 hover:text-sky-600 font-medium transition-colors">
                Contact support
              </a>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Portal v0.1 · For authorized clinicians only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
