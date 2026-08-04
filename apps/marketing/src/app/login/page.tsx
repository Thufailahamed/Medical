"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  FlaskConical,
  Truck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Check,
  MessageCircle,
  Globe,
} from "lucide-react";

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
 *
 * Visual: two-column premium layout — left = brand visual (phone scene
 * + orbs + welcome message + trust signals), right = form.
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
  roles: string[];
  landingFor: Record<string, string>;
  description: string;
  hint: string;
}

const PORTS: PortSpec[] = [
  {
    value: "facility",
    label: "Facility",
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
    hint: "For admin and operations staff",
  },
  {
    value: "doctor",
    label: "Doctor",
    icon: FlaskConical,
    roles: ["doctor"],
    landingFor: { doctor: "/portal/dashboard" },
    description: "Doctor sign-in",
    hint: "For practicing clinicians",
  },
  {
    value: "operator",
    label: "Operator",
    icon: Truck,
    roles: ["insurance", "ambulance"],
    landingFor: {
      insurance: "/admin/insurance-claims",
      ambulance: "/admin/ambulances",
    },
    description: "Insurance + ambulance operators",
    hint: "For insurance & ambulance partners",
  },
];

export default function UnifiedLoginPage() {
  const [port, setPort] = useState<Port>("facility");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="vh-login">
      {/* ─── Subtle noise overlay ─── */}
      <div className="vh-login__noise" aria-hidden="true" />

      <div className="vh-login__shell">
        {/* ─── LEFT — Brand visual ─── */}
        <aside className="vh-login__visual">
          <div className="vh-login__visual-bg" aria-hidden="true" />

          {/* Brand header */}
          <div className="vh-login__brand">
            <Link href="/" className="vh-login__brand-link" aria-label="HealthHub home">
              <span className="vh-login__brand-mark">H</span>
              <span className="vh-login__brand-name">HealthHub</span>
            </Link>
          </div>

          {/* Eyebrow + main message */}
          <div className="vh-login__copy">
            <span className="vh-login__eyebrow">
              <span className="vh-login__eyebrow-dot" />
              Welcome back
            </span>
            <h1 className="vh-login__title">
              Your team&rsquo;s <em>calm, private</em> place to work.
            </h1>
            <p className="vh-login__lede">
              Records, medicines, vitals and AI insights — quietly in one place for your staff and the people you look after.
            </p>

            {/* Trust pills */}
            <div className="vh-login__trust">
              <span className="vh-login__trust-pill">
                <ShieldCheck size={13} />
                End-to-end encrypted
              </span>
              <span className="vh-login__trust-pill">
                <Sparkles size={13} />
                Built in Sri Lanka
              </span>
              <span className="vh-login__trust-pill">
                <Globe size={13} />
                EN · සිං · த
              </span>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT — Form ─── */}
        <main className="vh-login__form-wrap">
          <div className="vh-login__form">
            {/* Mobile-only brand */}
            <Link href="/" className="vh-login__brand-link vh-login__brand-link--mobile" aria-label="HealthHub home">
              <span className="vh-login__brand-mark">H</span>
              <span className="vh-login__brand-name">HealthHub</span>
            </Link>

            <div className="vh-login__form-head">
              <span className="vh-login__form-eyebrow">// staff &amp; partner access</span>
              <h2 className="vh-login__form-title">
                Sign <em>in</em>
              </h2>
              <p className="vh-login__form-sub">
                Staff, doctor, or operator &mdash; pick the right portal below.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="vh-login__tabs" role="tablist">
              {PORTS.map((p) => {
                const PIcon = p.icon;
                const active = port === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchPort(p.value)}
                    className={cn("vh-login__tab", active && "is-active")}
                  >
                    <PIcon size={15} strokeWidth={2.25} />
                    <span className="vh-login__tab-label">{p.label}</span>
                    <span className="vh-login__tab-hint">{p.hint}</span>
                  </button>
                );
              })}
            </div>

            <p className="vh-login__port-desc">
              <selected.icon size={13} />
              {selected.description}
            </p>

            {error ? (
              <div className="vh-login__error" role="alert">
                <ShieldCheck size={15} />
                <span>{error}</span>
              </div>
            ) : null}

            <form className="vh-login__fields" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="vh-login__field">
                <label htmlFor="identifier" className="vh-login__label">
                  Email or phone
                </label>
                <div className="vh-login__input-wrap">
                  <Mail size={15} className="vh-login__input-icon" />
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
                    className="vh-login__input"
                    {...register("identifier")}
                  />
                </div>
                {errors.identifier?.message ? (
                  <span className="vh-login__field-error">{errors.identifier.message}</span>
                ) : null}
              </div>

              <div className="vh-login__field">
                <div className="vh-login__label-row">
                  <label htmlFor="password" className="vh-login__label">
                    Password
                  </label>
                  <a href="#" className="vh-login__forgot">
                    Forgot?
                  </a>
                </div>
                <div className="vh-login__input-wrap">
                  <Lock size={15} className="vh-login__input-icon" />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="vh-login__input vh-login__input--with-suffix"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="vh-login__input-suffix"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password?.message ? (
                  <span className="vh-login__field-error">{errors.password.message}</span>
                ) : null}
              </div>

              <label className="vh-login__remember">
                <input type="checkbox" defaultChecked />
                <span className="vh-login__remember-box">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span>Keep me signed in for 30 days</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="vh-login__submit"
              >
                {submitting ? (
                  <>
                    <span className="vh-login__submit-spinner" />
                    <span>Signing you in&hellip;</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to {selected.label}</span>
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>

            {/* Or divider */}
            <div className="vh-login__divider">
              <span>or</span>
            </div>

            {/* Alternative actions */}
            <div className="vh-login__alts">
              <a
                href={
                  process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE
                    ? `https://wa.me/${process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE}?text=${encodeURIComponent("Hi HealthHub, I need help signing in.")}`
                    : "mailto:support@healthhub.app"
                }
                target="_blank"
                rel="noopener"
                className="vh-login__alt vh-login__alt--whatsapp"
              >
                <MessageCircle size={15} />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            <a href="mailto:support@healthhub.app" className="vh-login__request">
              Don&rsquo;t have an account? <strong>Request access &rarr;</strong>
            </a>
          </div>

          {/* Footer */}
          <div className="vh-login__footer">
            <span>&copy; {new Date().getFullYear()} Healthhub (Pvt) Ltd.</span>
            <span className="vh-login__footer-links">
              <Link href="/privacy">Privacy</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms">Terms</Link>
              <span aria-hidden="true">·</span>
              <a href="mailto:support@healthhub.app">Support</a>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
