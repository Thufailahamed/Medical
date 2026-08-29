"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  FlaskConical,
  Heart,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Input } from "@/portal/components/ui/Form";
import { login } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { cn } from "@/portal/lib/utils";

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
    hint: "Admin & ops",
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

const LEFT_COPY: Record<Port, { index: string; eyebrow: string; title: ReactNode; lede: string }> = {
  patient: {
    index: "01 — personal",
    eyebrow: "Private beta · Colombo",
    title: (
      <>
        Your health,<br />finally <em>together.</em>
      </>
    ),
    lede: "Records, medicines, vitals, and quiet AI insights — organised for you and the people you look after.",
  },
  facility: {
    index: "02 — facility",
    eyebrow: "Operations access",
    title: (
      <>
        One place for the <em>whole floor.</em>
      </>
    ),
    lede: "Records, coordination, and day-to-day operations for hospitals, labs, and pharmacies.",
  },
  doctor: {
    index: "03 — clinician",
    eyebrow: "Clinical workspace",
    title: (
      <>
        Start with the <em>whole picture.</em>
      </>
    ),
    lede: "History, notes, and prescriptions ready before the consult — built for practising clinicians.",
  },
  operator: {
    index: "04 — partner",
    eyebrow: "Partner access",
    title: (
      <>
        Claims without the <em>chase.</em>
      </>
    ),
    lede: "Insurance and ambulance partners manage coverage, claims, and dispatch from here.",
  },
};

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={<div className="hh-login" aria-busy="true" />}>
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
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
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
      router.replace(spec.landingFor[role] ?? "/");
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
    const Icon = p.icon;
    const active = port === p.value;
    return (
      <button
        key={p.value}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => switchPort(p.value)}
        className={cn("hh-login__tab", featured && "hh-login__tab--featured", active && "is-active")}
      >
        <Icon size={featured ? 18 : 15} strokeWidth={1.85} aria-hidden="true" />
        <span>
          <strong>{p.label}</strong>
          <em>{p.hint}</em>
        </span>
      </button>
    );
  }

  return (
    <div className={cn("hh-login", ready && "is-ready")}>
      <div className="hh-login__grid" aria-hidden="true" />
      <div className="hh-login__grain" aria-hidden="true" />

      <div className="hh-login__shell">
        <aside className="hh-login__visual">
          <Link href="/" className="hh-login__brand" aria-label="HealthHub home">
            <img className="hh-login__mark" src="/assets/logo.svg" alt="" />
            <span>HealthHub</span>
          </Link>

          <div className="hh-login__copy" key={port}>
            <p className="hh-login__masthead">
              <span>{left.index}</span>
              <span>Vol. 01</span>
              <span>2026</span>
            </p>
            <p className="hh-login__eyebrow">
              <span className="hh-login__dot" />
              {left.eyebrow}
            </p>
            <h1 className="hh-login__title">{left.title}</h1>
            <p className="hh-login__lede">{left.lede}</p>
            <ul className="hh-login__meta">
              <li><ShieldCheck size={14} /> Private by default</li>
              <li>EN · සිං · த</li>
              <li>Encrypted at rest</li>
            </ul>
          </div>

          <p className="hh-login__rail" aria-hidden="true">
            <span>Fig. 00</span>
            <i />
            <span>Sign in</span>
          </p>
        </aside>

        <main className="hh-login__panel">
          <div className="hh-login__panel-inner">
            <Link href="/" className="hh-login__brand hh-login__brand--mobile" aria-label="HealthHub home">
              <img className="hh-login__mark" src="/assets/logo.svg" alt="" />
              <span>HealthHub</span>
            </Link>

            <header className="hh-login__head">
              <span className="hh-login__kicker">Secure access</span>
              <h2 className="hh-login__heading">
                Sign <em>in</em>
              </h2>
              <p className="hh-login__sub">Choose your portal, then enter your details.</p>
            </header>

            <div className="hh-login__ports">
              <div className="hh-login__ports-label">Personal</div>
              <div className="hh-login__tabs hh-login__tabs--personal" role="tablist" aria-label="Personal access">
                {personalPorts.map((p) => renderTab(p, true))}
              </div>
              <div className="hh-login__ports-label">Staff &amp; partners</div>
              <div className="hh-login__tabs hh-login__tabs--staff" role="tablist" aria-label="Staff and partner access">
                {staffPorts.map((p) => renderTab(p))}
              </div>
            </div>

            <p className="hh-login__desc">
              <selected.icon size={13} strokeWidth={1.85} />
              {selected.description}
            </p>

            {error ? (
              <div className="hh-login__error" role="alert">
                {error}
              </div>
            ) : null}

            <form className="hh-login__form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="hh-login__field">
                <label htmlFor="identifier">Email or phone</label>
                <div className="hh-login__control">
                  <Mail size={15} aria-hidden="true" />
                  <Input
                    id="identifier"
                    autoComplete="username"
                    placeholder={selected.placeholder}
                    className="hh-login__input"
                    {...register("identifier")}
                  />
                </div>
                {errors.identifier?.message ? (
                  <span className="hh-login__field-error">{errors.identifier.message}</span>
                ) : null}
              </div>

              <div className="hh-login__field">
                <div className="hh-login__label-row">
                  <label htmlFor="password">Password</label>
                  <a href="mailto:support@healthhub.app?subject=Password%20reset">Forgot?</a>
                </div>
                <div className="hh-login__control">
                  <Lock size={15} aria-hidden="true" />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="hh-login__input hh-login__input--suffix"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="hh-login__reveal"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password?.message ? (
                  <span className="hh-login__field-error">{errors.password.message}</span>
                ) : null}
              </div>

              <label className="hh-login__remember">
                <input type="checkbox" defaultChecked />
                <span className="hh-login__check" aria-hidden="true"><Check size={11} strokeWidth={3} /></span>
                <span>Keep me signed in for 30 days</span>
              </label>

              <button type="submit" className="hh-login__submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="hh-login__spinner" />
                    Signing you in…
                  </>
                ) : (
                  <>
                    Sign in to {selected.label}
                    <ArrowRight size={16} strokeWidth={2.25} />
                  </>
                )}
              </button>
            </form>

            <div className="hh-login__rule"><span>or</span></div>

            <a
              className="hh-login__whatsapp"
              href={
                process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE
                  ? `https://wa.me/${process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE}?text=${encodeURIComponent("Hi HealthHub, I need help signing in.")}`
                  : "mailto:support@healthhub.app"
              }
              target="_blank"
              rel="noopener"
            >
              <MessageCircle size={15} />
              Chat on WhatsApp
            </a>

            {port === "patient" ? (
              <a className="hh-login__cta" href="/account/signup">
                New here? <strong>Join HealthHub →</strong>
              </a>
            ) : (
              <a className="hh-login__cta" href="mailto:support@healthhub.app?subject=Access%20request">
                Need a staff account? <strong>Request access →</strong>
              </a>
            )}
          </div>

          <footer className="hh-login__footer">
            <span>© {new Date().getFullYear()} Healthhub (Pvt) Ltd.</span>
            <span>
              <Link href="/privacy">Privacy</Link>
              <i aria-hidden="true">·</i>
              <Link href="/terms">Terms</Link>
              <i aria-hidden="true">·</i>
              <a href="mailto:support@healthhub.app">Support</a>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
