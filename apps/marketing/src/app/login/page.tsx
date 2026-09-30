"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  Truck,
  User,
} from "lucide-react";

import { login, loginWithPhone, MfaRequiredError } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { cn } from "@/portal/lib/utils";
import { AuthHero, type AuthHeroProps } from "@/app/_shared/AuthHero";
import "@/app/_shared/auth-studio.css";

type Port = "patient" | "doctor" | "facility" | "operator";

const schema = z.object({
  identifier: z.string().min(1, "Email or phone number is required"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

interface PortSpec {
  value: Port;
  label: string;
  badge: string;
  icon: any;
  roles: string[];
  landingFor: Record<string, string>;
  description: string;
  placeholder: string;
}

const PORTS: PortSpec[] = [
  {
    value: "patient",
    label: "Patient",
    badge: "Personal",
    icon: User,
    roles: ["patient"],
    landingFor: { patient: "/patient" },
    description: "Access your health records, lab reports, and prescriptions.",
    placeholder: "you@example.com or 07X XXX XXXX",
  },
  {
    value: "doctor",
    label: "Doctor",
    badge: "Clinician",
    icon: Stethoscope,
    roles: ["doctor"],
    landingFor: { doctor: "/portal/dashboard" },
    description: "Clinical workstation with longitudinal patient charts and orders.",
    placeholder: "doctor@hospital.lk",
  },
  {
    value: "facility",
    label: "Facility",
    badge: "Admin & Ops",
    icon: Building2,
    roles: [
      "hospital_admin",
      "hospital_staff",
      "pharmacy",
      "laboratory",
      "super_admin",
    ],
    landingFor: {
      hospital_admin: "/hospital/dashboard",
      hospital_staff: "/hospital/dashboard",
      pharmacy: "/hospital/dashboard",
      laboratory: "/lab-portal/dashboard",
      super_admin: "/admin/dashboard",
    },
    description: "Operations hub for hospital wards, labs, and licensed pharmacies.",
    placeholder: "admin@hospital.lk",
  },
  {
    value: "operator",
    label: "Partner",
    badge: "Insurance & EMS",
    icon: Truck,
    roles: ["insurance", "ambulance", "super_admin"],
    landingFor: {
      insurance: "/admin/insurance-claims",
      ambulance: "/admin/ambulances",
      super_admin: "/admin/dashboard",
    },
    description: "Real-time claims adjudication and emergency fleet dispatch.",
    placeholder: "operator@insurance.lk",
  },
];

const PORT_HERO: Record<Port, Omit<AuthHeroProps, "animKey">> = {
  patient: {
    kicker: "Private beta · Colombo",
    headline: "Your health has a history.",
    highlight: "Keep it close.",
    lede: "Records, medicines and visits — private, readable, and doctor-ready in English, Sinhala and Tamil.",
    photo: "/assets/brand/harbor-hands.png",
    float: { icon: <FileText size={15} />, title: "Lab report ready", caption: "Lipid panel · just now" },
    card: {
      initials: "NF",
      title: "Nimali Fernando",
      subtitle: "LK-1994-0821-P · O+",
      chip: "ENCRYPTED",
      stats: [
        { label: "Primary", value: "Dr. K. Perera" },
        { label: "Prescriptions", value: "2 active" },
        { label: "Heart rate", value: "72 bpm" },
      ],
    },
  },
  doctor: {
    kicker: "Clinical workstation",
    headline: "The chart, already written.",
    highlight: "Before they sit down.",
    lede: "Longitudinal history, labs and prescriptions in one place — so the visit can start somewhere better.",
    photo: "/assets/insurance/plan-types/insurance-senior.jpg",
    float: { icon: <Activity size={15} />, title: "3 priority labs", caption: "Awaiting your sign-off" },
    card: {
      initials: "KP",
      title: "Dr. Kasun Perera, MD",
      subtitle: "SLMC #48291 · Cardiology",
      chip: "SLMC",
      stats: [
        { label: "Today", value: "14 consults" },
        { label: "Clinic", value: "Asiri Central" },
        { label: "Sign-off", value: "Verified" },
      ],
    },
  },
  facility: {
    kicker: "Hospital · lab · pharmacy",
    headline: "Wards, specimens, stock.",
    highlight: "One quiet board.",
    lede: "Beds, lab routing and dispensing coordinated without the WhatsApp scramble.",
    photo: "/assets/lab/hero.jpg",
    float: { icon: <Activity size={15} />, title: "Live sync", caption: "All wards reporting" },
    card: {
      initials: <Building2 size={17} />,
      title: "Colombo Central Hospital",
      subtitle: "FAC-COL-004 · Tertiary care",
      chip: "MOH",
      stats: [
        { label: "Bed occupancy", value: "84%" },
        { label: "Pharmacy", value: "Stocked" },
        { label: "Specimens", value: "126 active" },
      ],
    },
  },
  operator: {
    kicker: "Insurance & EMS",
    headline: "Claims and dispatch,",
    highlight: "in the same breath.",
    lede: "Policy checks, settlement and fleet tracking across the island — live, auditable, unhurried.",
    photo: "/assets/insurance/hero.jpg",
    float: { icon: <Truck size={15} />, title: "12 units en route", caption: "Western Province" },
    card: {
      initials: <Truck size={17} />,
      title: "National Emergency & Claims",
      subtitle: "NET-DISPATCH · 24/7",
      chip: "EMS",
      stats: [
        { label: "Adjudication", value: "<120 ms" },
        { label: "Fleet", value: "Optimal" },
        { label: "Audits", value: "Compliant" },
      ],
    },
  },
};

const PORT_ACTION_LABEL: Record<Port, string> = {
  patient: "Sign in as Patient",
  doctor: "Sign in to Doctor Desk",
  facility: "Sign in to Facility Hub",
  operator: "Sign in to Partner Desk",
};

const PORT_SIGNUP: Record<Port, { prompt: string; label: string; href: string }> = {
  patient: { prompt: "New to HealthHub?", label: "Create account", href: "/patient/register" },
  doctor: { prompt: "New clinician?", label: "Request access", href: "/doctor/register" },
  facility: { prompt: "New facility?", label: "Register", href: "/hospital/register" },
  operator: { prompt: "New partner?", label: "Register", href: "/insurance-operator/register" },
};

const IS_DEV = process.env.NODE_ENV === "development";

function isLikelySlPhone(value: string): boolean {
  const digits = value.replace(/[\s\-().+]/g, "");
  return /^07[0-9]\d{7}$/.test(digits) || /^947[0-9]\d{7}$/.test(digits);
}

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={<div className="au-root" />}>
      <UnifiedLoginForm />
    </Suspense>
  );
}

function UnifiedLoginForm() {
  const params = useSearchParams();
  const nextPath = params.get("next") || "";
  const initialPort = (() => {
    const raw = params.get("port");
    if (
      raw === "facility" ||
      raw === "doctor" ||
      raw === "operator" ||
      raw === "patient"
    ) {
      return raw;
    }
    return "patient";
  })();

  const [port, setPort] = useState<Port>(initialPort);
  const [patientMode, setPatientMode] = useState<"password" | "phone">("password");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raw = params.get("port");
    if (
      raw === "facility" ||
      raw === "doctor" ||
      raw === "operator" ||
      raw === "patient"
    ) {
      setPort(raw);
    }
  }, [params]);

  const selected = PORTS.find((p) => p.value === port)!;
  const hero = PORT_HERO[port];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  const identifierVal = watch("identifier") ?? "";
  const passwordVal = watch("password") ?? "";

  function land(role: string) {
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
        `This account is registered for ${spec.label}. Switch to the "${wanted.label}" tab to sign in.`,
      );
      setSubmitting(false);
      return;
    }
    const fallback = spec.landingFor[role] ?? "/";
    const dest =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : fallback;
    router.replace(dest);
  }

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
      land(String(user.role));
    } catch (err: unknown) {
      if (err instanceof MfaRequiredError) {
        const qs = new URLSearchParams({
          mfaToken: err.payload.mfaToken,
          mfaRequired: err.payload.mfaRequired,
        });
        if (nextPath) qs.set("next", nextPath);
        router.push(`/portal/mfa-challenge?${qs.toString()}`);
        return;
      }
      const code =
        (err as { details?: { code?: string }; code?: string })?.details
          ?.code || (err as { code?: string })?.code;
      if (code === "account_pending")
        setError("Your account is currently pending administrative approval.");
      else if (code === "account_suspended")
        setError("Your account has been temporarily suspended. Contact support.");
      else if (code === "account_rejected")
        setError("Your application was not approved.");
      else setError(friendlyError(err));
      setSubmitting(false);
    }
  }

  async function onPhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = phone.trim();
    if (!isLikelySlPhone(trimmed)) {
      setError("Please enter a valid Sri Lankan mobile number (e.g. 0771234567).");
      return;
    }
    setSubmitting(true);
    try {
      const result = await loginWithPhone(trimmed);
      if (result.needsOtp) {
        const qs = new URLSearchParams({
          mode: "login",
          userId: result.start.userId,
          channel: String(result.start.channel || "mobile"),
          target: result.start.target || trimmed,
          next: nextPath || "/patient",
        });
        router.push(`/patient/verify-otp?${qs.toString()}`);
        return;
      }
      land(String(result.user.role));
    } catch (err: unknown) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  }

  async function devLoginAsPatient() {
    setPort("patient");
    setError(null);
    setValue("identifier", "0771234567");
    setValue("password", "dev");
    setSubmitting(true);
    try {
      const user = await login({
        phone: "0771234567",
        password: "dev",
      });
      land(String(user.role));
    } catch {
      try {
        const user = await login({
          email: "dev-patient@healthhub.local",
          password: "dev",
        });
        land(String(user.role));
      } catch (err: unknown) {
        setError(friendlyError(err));
        setSubmitting(false);
      }
    }
  }

  async function devLoginAsDoctor() {
    setPort("doctor");
    setError(null);
    setValue("identifier", "dev-doctor@healthhub.local");
    setValue("password", "dev");
    setSubmitting(true);
    try {
      const user = await login({
        email: "dev-doctor@healthhub.local",
        password: "dev",
      });
      land(String(user.role));
    } catch (err: unknown) {
      if (err instanceof MfaRequiredError) {
        const qs = new URLSearchParams({
          mfaToken: err.payload.mfaToken,
          mfaRequired: err.payload.mfaRequired,
        });
        if (nextPath) qs.set("next", nextPath);
        router.push(`/portal/mfa-challenge?${qs.toString()}`);
        return;
      }
      try {
        const user = await login({
          email: "doctor@hospital.lk",
          password: "dev",
        });
        land(String(user.role));
      } catch (err2: unknown) {
        if (err2 instanceof MfaRequiredError) {
          const qs = new URLSearchParams({
            mfaToken: err2.payload.mfaToken,
            mfaRequired: err2.payload.mfaRequired,
          });
          if (nextPath) qs.set("next", nextPath);
          router.push(`/portal/mfa-challenge?${qs.toString()}`);
          return;
        }
        setError(friendlyError(err2));
        setSubmitting(false);
      }
    }
  }

  async function devLoginAsAdmin() {
    setPort("facility");
    setError(null);
    setValue("identifier", "admin@healthhub.local");
    setValue("password", "Admin#12345");
    setSubmitting(true);
    try {
      const user = await login({
        email: "admin@healthhub.local",
        password: "Admin#12345",
      });
      land(String(user.role));
    } catch {
      try {
        const user = await login({
          email: "admin@hospital.lk",
          password: "dev",
        });
        land(String(user.role));
      } catch (err: unknown) {
        setError(friendlyError(err));
        setSubmitting(false);
      }
    }
  }

  function switchPort(next: Port) {
    setPort(next);
    setError(null);
    setShowPw(false);
    setPatientMode("password");
    setPhone("");
    reset({ identifier: "", password: "" });
  }

  const signup = PORT_SIGNUP[port];

  const submitLabel = (busyLabel: string, idleLabel: string) =>
    submitting ? (
      <>
        <span>{busyLabel}</span>
        <span className="au-spinner" aria-hidden />
      </>
    ) : (
      <>
        <span>{idleLabel}</span>
        <span className="au-btn__glyph" aria-hidden>
          <ArrowRight size={16} />
        </span>
      </>
    );

  return (
    <div className="au-root" data-role={port}>
      <a className="au-skip" href="#login-form">
        Skip to sign in
      </a>

      <AuthHero animKey={port} {...hero} />

      <main className="au-panel">
        <div className="au-topbar">
          <Link href="/" className="au-back">
            <ArrowLeft size={15} />
            Back to site
          </Link>
          <Link href="/" className="au-mobile-brand">
            <img src="/assets/logo.svg" alt="" width={26} height={26} />
            HealthHub
          </Link>
          <div className="au-topbar__cta">
            <span>{signup.prompt}</span>
            <Link href={signup.href}>{signup.label}</Link>
          </div>
        </div>

        <div className="au-form" id="login-form">
          <div className="au-head">
            <h1>
              Welcome back. <em>Sign in quietly.</em>
            </h1>
            <p>Choose your workspace, then pick up where you left off.</p>
          </div>

          <div className="au-roles" role="tablist" aria-label="Select portal workspace">
            {PORTS.map((p) => {
              const active = port === p.value;
              const Icon = p.icon;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchPort(p.value)}
                  className={cn("au-role", `au-role--${p.value}`, active && "is-active")}
                >
                  <span className="au-role__icon">
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          <p className="au-role-note" key={port}>
            {selected.description}
          </p>

          {error && (
            <div className="au-alert" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {port === "patient" && patientMode === "phone" ? (
            <form onSubmit={onPhoneSubmit} className="au-fields">
              <div className="au-field">
                <label htmlFor="phone" className="au-label">
                  Mobile number
                </label>
                <div className="au-input-wrap">
                  <span className="au-input-icon">
                    <Phone size={16} />
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="077 123 4567"
                    className="au-input"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="au-btn" aria-busy={submitting}>
                {submitLabel("Sending code…", "Send verification code")}
              </button>

              <div className="au-or">or</div>

              <button
                type="button"
                className="au-btn au-btn--ghost"
                onClick={() => {
                  setPatientMode("password");
                  setError(null);
                }}
              >
                <Mail size={16} />
                Use email & password
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="au-fields">
              <div className="au-field">
                <label htmlFor="identifier" className="au-label">
                  Email or Phone
                </label>
                <div className="au-input-wrap">
                  <span className="au-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    id="identifier"
                    autoComplete="username"
                    placeholder={selected.placeholder}
                    {...register("identifier")}
                    value={identifierVal}
                    aria-invalid={!!errors.identifier}
                    className="au-input"
                  />
                </div>
                {errors.identifier?.message && (
                  <p className="au-hint">{errors.identifier.message}</p>
                )}
              </div>

              <div className="au-field">
                <div className="au-label-row">
                  <label htmlFor="password" className="au-label">
                    Password
                  </label>
                  <a
                    href="mailto:support@healthhub.app?subject=Password%20Reset%20Request"
                    className="au-link"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="au-input-wrap">
                  <span className="au-input-icon">
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...register("password")}
                    value={passwordVal}
                    aria-invalid={!!errors.password}
                    className="au-input au-input--pr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="au-adorn"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="au-hint">{errors.password.message}</p>
                )}
              </div>

              <label className="au-check">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in on this device</span>
              </label>

              <button type="submit" disabled={submitting} className="au-btn" aria-busy={submitting}>
                {submitLabel("Signing in…", PORT_ACTION_LABEL[port])}
              </button>

              {port === "patient" && (
                <>
                  <div className="au-or">or</div>
                  <button
                    type="button"
                    className="au-btn au-btn--ghost"
                    onClick={() => {
                      setPatientMode("phone");
                      setError(null);
                    }}
                  >
                    <Phone size={16} />
                    Continue with mobile OTP
                  </button>
                </>
              )}
            </form>
          )}

          <p className="au-assure">
            <ShieldCheck size={14} />
            End-to-end encrypted · MFA for clinical accounts
          </p>

          {IS_DEV && (
            <div className="au-dev">
              <span>Quick dev</span>
              <div className="au-dev__btns">
                <button type="button" onClick={devLoginAsPatient} disabled={submitting}>
                  As Patient
                </button>
                <button type="button" onClick={devLoginAsDoctor} disabled={submitting}>
                  As Doctor
                </button>
                <button type="button" onClick={devLoginAsAdmin} disabled={submitting}>
                  As Admin
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="au-foot">
          <span>© {new Date().getFullYear()} HealthHub · Colombo</span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support@healthhub.app">Support</a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
