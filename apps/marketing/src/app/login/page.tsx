"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  FlaskConical,
  Truck,
  Heart,
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

import { Input } from "@/portal/components/ui/Form";
import { login } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { cn } from "@/portal/lib/utils";

/**
 * Unified sign-in. User picks an account type; after /auth/login the
 * server role is checked and they are routed to the matching surface.
 */

type Port = "patient" | "facility" | "doctor" | "operator";

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
  group: "personal" | "staff";
  placeholder: string;
}

const PORTS: PortSpec[] = [
  {
    value: "patient",
    label: "Patient",
    icon: Heart,
    roles: ["patient"],
    landingFor: { patient: "/patient" },
    description: "Your personal health journal",
    hint: "You & your family",
    group: "personal",
    placeholder: "you@email.com",
  },
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
    hint: "Admin & operations",
    group: "staff",
    placeholder: "admin@hospital.lk",
  },
  {
    value: "doctor",
    label: "Doctor",
    icon: FlaskConical,
    roles: ["doctor"],
    landingFor: { doctor: "/portal/dashboard" },
    description: "Clinical workspace for practising clinicians",
    hint: "Clinicians",
    group: "staff",
    placeholder: "doctor@hospital.lk",
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
    description: "Insurance and ambulance partners",
    hint: "Partners",
    group: "staff",
    placeholder: "operator@insurance.lk",
  },
];

const LEFT_COPY: Record<Port, { eyebrow: string; title: ReactNode; lede: string }> = {
  patient: {
    eyebrow: "Personal health",
    title: (
      <>
        Your health,<br />finally <em>together.</em>
      </>
    ),
    lede: "Records, medicines, vitals, and AI insights — privately organised for you and the people you look after.",
  },
  facility: {
    eyebrow: "Facility access",
    title: (
      <>
        Your team&rsquo;s <em>calm, private</em> place to work.
      </>
    ),
    lede: "Operations, records, and care coordination for hospitals, labs, and pharmacies — quietly in one place.",
  },
  doctor: {
    eyebrow: "Clinical workspace",
    title: (
      <>
        Care that starts with the <em>whole picture.</em>
      </>
    ),
    lede: "Prescriptions, notes, and patient history ready before the visit — built for practising clinicians.",
  },
  operator: {
    eyebrow: "Partner access",
    title: (
      <>
        Claims and coverage, <em>without the chase.</em>
      </>
    ),
    lede: "Insurance and ambulance partners sign in here to manage claims, coverage, and dispatch.",
  },
};

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={<div className="vh-login" />}>
      <UnifiedLoginForm />
    </Suspense>
  );
}

function UnifiedLoginForm() {
  const params = useSearchParams();
  const initialPort = (() => {
    const raw = params.get("port");
    if (raw === "facility" || raw === "doctor" || raw === "operator" || raw === "patient") return raw;
    return "patient";
  })();
  const [port, setPort] = useState<Port>(initialPort);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = PORTS.find((p) => p.value === port)!;
  const left = LEFT_COPY[port];
  const personalPorts = PORTS.filter((p) => p.group === "personal");
  const staffPorts = PORTS.filter((p) => p.group === "staff");

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
        setError("This account has no portal access yet. Contact support.");
        setSubmitting(false);
        return;
      }
      if (spec.value !== port) {
        useAuthStore.getState().logout();
        const wanted = PORTS.find((p) => p.value === spec.value)!;
        setError(
          `This account is a ${role.replace(/_/g, " ")} account. Use the "${wanted.label}" tab instead.`,
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
    setShowPw(false);
    reset({ identifier: "", password: "" });
  }

  function renderTab(p: PortSpec, featured = false) {
    const PIcon = p.icon;
    const active = port === p.value;
    return (
      <button
        key={p.value}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => switchPort(p.value)}
        className={cn(
          "vh-login__tab",
          featured && "vh-login__tab--featured",
          active && "is-active",
        )}
      >
        <span className="vh-login__tab-icon" aria-hidden="true">
          <PIcon size={featured ? 18 : 15} strokeWidth={2.25} />
        </span>
        <span className="vh-login__tab-text">
          <span className="vh-login__tab-label">{p.label}</span>
          <span className="vh-login__tab-hint">{p.hint}</span>
        </span>
      </button>
    );
  }

  return (
    <div className={cn("vh-login", mounted && "is-ready")}>
      <div className="vh-login__noise" aria-hidden="true" />

      <div className="vh-login__shell">
        <aside className="vh-login__visual">
          <div className="vh-login__visual-bg" aria-hidden="true" />
          <div className="vh-login__visual-orb vh-login__visual-orb--a" aria-hidden="true" />
          <div className="vh-login__visual-orb vh-login__visual-orb--b" aria-hidden="true" />

          <div className="vh-login__brand">
            <Link href="/" className="vh-login__brand-link" aria-label="HealthHub home">
              <span className="vh-login__brand-mark">H</span>
              <span className="vh-login__brand-name">HealthHub</span>
            </Link>
          </div>

          <div className="vh-login__copy" key={port}>
            <span className="vh-login__eyebrow">
              <span className="vh-login__eyebrow-dot" />
              {left.eyebrow}
            </span>
            <h1 className="vh-login__title">{left.title}</h1>
            <p className="vh-login__lede">{left.lede}</p>

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

        <main className="vh-login__form-wrap">
          <div className="vh-login__form">
            <Link href="/" className="vh-login__brand-link vh-login__brand-link--mobile" aria-label="HealthHub home">
              <span className="vh-login__brand-mark">H</span>
              <span className="vh-login__brand-name">HealthHub</span>
            </Link>

            <div className="vh-login__form-head">
              <span className="vh-login__form-eyebrow">// secure access</span>
              <h2 className="vh-login__form-title">
                Sign <em>in</em>
              </h2>
              <p className="vh-login__form-sub">
                Choose how you use HealthHub, then enter your details.
              </p>
            </div>

            <div className="vh-login__ports">
              <div className="vh-login__ports-label">Personal</div>
              <div className="vh-login__tabs vh-login__tabs--personal" role="tablist" aria-label="Personal access">
                {personalPorts.map((p) => renderTab(p, true))}
              </div>

              <div className="vh-login__ports-label">Staff &amp; partners</div>
              <div className="vh-login__tabs vh-login__tabs--staff" role="tablist" aria-label="Staff and partner access">
                {staffPorts.map((p) => renderTab(p))}
              </div>
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
                    placeholder={selected.placeholder}
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
                  <a href="mailto:support@healthhub.app?subject=Password%20reset" className="vh-login__forgot">
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

            <div className="vh-login__divider">
              <span>or</span>
            </div>

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

            {port === "patient" ? (
              <a href="/account/signup" className="vh-login__request">
                New here? <strong>Join HealthHub &rarr;</strong>
              </a>
            ) : (
              <a href="mailto:support@healthhub.app?subject=Access%20request" className="vh-login__request">
                Need a staff account? <strong>Request access &rarr;</strong>
              </a>
            )}
          </div>

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
