"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Stethoscope } from "lucide-react";

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
      if (user.role !== "doctor") {
        // The portal is doctor-only today. Don't bounce a patient
        // into an empty dashboard — surface the role mismatch.
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
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6 text-brand">
          <div className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center shadow-md">
            <Stethoscope size={20} />
          </div>
          <div className="text-lg font-semibold text-text">MedLocker Portal</div>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card p-6 md:p-8 flex flex-col gap-4"
        >
          <div>
            <h1 className="text-xl font-semibold text-text">Welcome back</h1>
            <p className="text-sm text-text-soft mt-1">
              Sign in to your clinical workspace
            </p>
          </div>

          {error ? (
            <div className="rounded-md border border-danger/40 bg-danger-soft/40 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Field
            label="Email or phone"
            htmlFor="identifier"
            required
            error={errors.identifier?.message}
          >
            <Input
              id="identifier"
              autoComplete="username"
              placeholder="doctor@clinic.lk"
              {...register("identifier")}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            required
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
          </Field>

          <Button type="submit" loading={submitting} block size="lg">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <div className="text-xs text-text-soft text-center pt-1">
            Need help signing in? Contact your clinic admin.
          </div>
        </form>

        <div className="text-[11px] text-text-muted text-center mt-4">
          Portal v0.1 · For authorized clinicians only
        </div>
      </div>
    </main>
  );
}