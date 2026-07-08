"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Building2, FlaskConical, Truck, Mail, Lock } from "lucide-react";

import { Button } from "@/portal/components/ui/Button";
import { Field, Input } from "@/portal/components/ui/Form";
import { login } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { cn } from "@/portal/lib/utils";

/**
 * Unified sign-in entry. The user picks which kind of account they're
 * using; the server tells us the role after /auth/login, and we route
 * them to the matching surface. Operators (insurance + ambulance) get
 * sent into /admin/* with a role-filtered sidebar.
 */

type Port = "facility" | "doctor" | "operator";

const schema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

interface PortSpec {
  value: Port;
  label: string;
  icon: typeof Building2;
  /** Roles that this tab accepts; others get a "wrong portal" toast. */
  roles: string[];
  /** Where each role lands after login. */
  landingFor: Record<string, string>;
  description: string;
}

const PORTS: PortSpec[] = [
  {
    value: "facility",
    label: "Facility portal",
    icon: Building2,
    roles: ["hospital_admin", "hospital_staff", "pharmacy", "laboratory", "super_admin"],
    landingFor: {
      hospital_admin: "/hospital/dashboard",
      hospital_staff: "/hospital/dashboard",
      pharmacy: "/hospital/dashboard",
      laboratory: "/hospital/dashboard",
      super_admin: "/admin/dashboard",
    },
    description: "Hospitals, labs, and pharmacies",
  },
  {
    value: "doctor",
    label: "Doctor portal",
    icon: FlaskConical,
    roles: ["doctor"],
    landingFor: { doctor: "/portal/dashboard" },
    description: "Doctor sign-in",
  },
  {
    value: "operator",
    label: "Operator portal",
    icon: Truck,
    roles: ["insurance", "ambulance"],
    landingFor: {
      insurance: "/admin/insurance-claims",
      ambulance: "/admin/ambulances",
    },
    description: "Insurance + ambulance operators",
  },
];

export default function UnifiedLoginPage() {
  const [port, setPort] = useState<Port>("facility");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const selected = PORTS.find((p) => p.value === port)!;

  const {
    register,
    handleSubmit,
    reset,
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
      const role = String(user.role);
      const spec = PORTS.find((p) => p.roles.includes(role));
      if (!spec) {
        useAuthStore.getState().logout();
        setError("This account has no portal access yet. Contact platform ops.");
        setSubmitting(false);
        return;
      }
      if (spec.value !== port) {
        useAuthStore.getState().logout();
        const wanted = PORTS.find((p) => p.value === spec.value)!;
        setError(
          `This account is a ${role.replace("_", " ")} account. Use the "${wanted.label}" tab instead.`,
        );
        setSubmitting(false);
        return;
      }
      const landing = spec.landingFor[role] ?? "/";
      router.replace(landing);
    } catch (err: unknown) {
      const code = (err as { details?: { code?: string }; code?: string })?.details?.code
        || (err as { code?: string })?.code;
      if (code === "account_pending") setError("Your account is pending approval.");
      else if (code === "account_suspended") setError("Your account is suspended.");
      else if (code === "account_rejected") setError("Your application was rejected.");
      else setError(friendlyError(err));
      setSubmitting(false);
    }
  }

  function switchPort(next: Port) {
    setPort(next);
    setError(null);
    reset({ identifier: "", password: "" });
  }

  const Icon = selected.icon;

  return (
    <div className="min-h-screen bg-sky-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <Link href="/" className="flex justify-center items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/>
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight font-sans">MedLocker</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight font-serif italic">
          Sign in
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Staff, doctor, or operator — pick the right portal below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-sky-800/80 backdrop-blur-sm py-8 px-4 shadow-2xl border border-sky-700/50 sm:rounded-2xl sm:px-10">
          {/* Role tabs */}
          <div className="flex p-1 bg-sky-900/50 rounded-xl mb-6">
            {PORTS.map((p) => {
              const PIcon = p.icon;
              const active = port === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => switchPort(p.value)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1.5",
                    active
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  <PIcon size={13} />
                  {p.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 text-center mb-4 -mt-1">
            {selected.description}
          </p>

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
              <Icon size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Field
              label="Email or phone"
              htmlFor="identifier"
              required
              error={errors.identifier?.message}
            >
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  id="identifier"
                  autoComplete="username"
                  placeholder={
                    port === "doctor"
                      ? "doctor@hospital.lk"
                      : port === "operator"
                      ? "operator@insurance.lk"
                      : "admin@hospital.lk"
                  }
                  className="pl-9 bg-sky-900/50 border-sky-700/50 text-white placeholder-sky-300/50 focus:ring-sky-400"
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
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 bg-sky-900/50 border-sky-700/50 text-white placeholder-sky-300/50 focus:ring-sky-400"
                  {...register("password")}
                />
              </div>
            </Field>

            <Button
              type="submit"
              loading={submitting}
              block
              size="lg"
              className="h-12 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-lg shadow-sky-500/20"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-2">
                  Sign in
                  <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-sky-700/40 flex items-center justify-between text-xs text-slate-400">
            <a href="mailto:support@healthhub.app" className="hover:text-white transition-colors underline">
              Request access
            </a>
            <Link href="/hospital/login" className="hover:text-white transition-colors underline">
              Hospital / lab login
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Healthhub (Pvt) Ltd. All rights reserved.
      </div>
    </div>
  );
}
