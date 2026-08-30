"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Shield,
  Stethoscope,
  Truck,
  User,
} from "lucide-react";

import { login, loginWithPhone, MfaRequiredError } from "@/portal/lib/auth";
import { useAuthStore } from "@/portal/stores/auth";
import { friendlyError } from "@/portal/lib/errors";
import { cn } from "@/portal/lib/utils";
import "./login.css";

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
    description: "Access your health records, prescriptions, and connected care team.",
    placeholder: "you@example.com or 07X XXX XXXX",
  },
  {
    value: "doctor",
    label: "Doctor",
    badge: "Clinician",
    icon: Stethoscope,
    roles: ["doctor"],
    landingFor: { doctor: "/portal/dashboard" },
    description: "Clinical cockpit with verified charts, diagnostic tests, and consults.",
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
      laboratory: "/hospital/dashboard",
      super_admin: "/admin/dashboard",
    },
    description: "Operations hub for hospital wards, licensed pharmacies, and labs.",
    placeholder: "admin@hospital.lk",
  },
  {
    value: "operator",
    label: "Partner",
    badge: "Insurance & EMS",
    icon: Truck,
    roles: ["insurance", "ambulance"],
    landingFor: {
      insurance: "/admin/insurance-claims",
      ambulance: "/admin/ambulances",
    },
    description: "Policy verification, claims settlement, and rapid dispatch fleet.",
    placeholder: "operator@insurance.lk",
  },
];

const PORT_HERO: Record<
  Port,
  {
    eyebrow: string;
    headline: string;
    description: string;
    points: [string, string, string];
  }
> = {
  patient: {
    eyebrow: "Personal care",
    headline: "Your health story, kept in one quiet place.",
    description:
      "Records, medicines, vitals, and the people who look after you — together, private, and ready when you need them.",
    points: [
      "Encrypted records on your account",
      "Reminders that follow your day",
      "Share only what you choose",
    ],
  },
  doctor: {
    eyebrow: "Clinical practice",
    headline: "The chart, already in context, before you walk in.",
    description:
      "Longitudinal history, lab orders, prescriptions, and care coordination — without hunting across systems.",
    points: [
      "One view of the patient journey",
      "Orders and notes in the same place",
      "Built for Sri Lankan clinics",
    ],
  },
  facility: {
    eyebrow: "Hospital & pharmacy",
    headline: "Wards, labs, and pharmacies, finally speaking the same language.",
    description:
      "Bed flow, dispensation, specimens, and department control — one operations layer for the people who run care.",
    points: [
      "Live occupancy and inventory",
      "Lab workflows without the paper chase",
      "Audit-ready by default",
    ],
  },
  operator: {
    eyebrow: "Insurance & EMS",
    headline: "Eligibility, claims, and dispatch without the waiting room.",
    description:
      "Verify cover, settle claims, and move emergency fleets with the same trusted patient identity.",
    points: [
      "Instant eligibility checks",
      "Claims that carry the clinical record",
      "Fleet status you can act on",
    ],
  },
};

const IS_DEV = process.env.NODE_ENV === "development";

function isLikelySlPhone(value: string): boolean {
  const digits = value.replace(/[\s\-().+]/g, "");
  return /^07[0-9]\d{7}$/.test(digits) || /^947[0-9]\d{7}$/.test(digits);
}

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={<div className="hl-root" />}>
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
      // Doctor accounts with MFA enrolled come back with an mfaToken
      // instead of a session. Route to the challenge page; the caller
      // is already authenticated at the credentials layer.
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
    setValue("identifier", "doctor@hospital.lk");
    setValue("password", "dev");
    setSubmitting(true);
    try {
      const user = await login({
        email: "doctor@hospital.lk",
        password: "dev",
      });
      land(String(user.role));
    } catch (err: unknown) {
      // The dev doctor can have MFA enrolled too — route to challenge
      // rather than dumping the error inline.
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
          email: "doctor@healthhub.local",
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

  function switchPort(next: Port) {
    setPort(next);
    setError(null);
    setShowPw(false);
    setPatientMode("password");
    setPhone("");
    reset({ identifier: "", password: "" });
  }

  return (
    <div className="hl-root">
      <a className="hl-skip" href="#login-form">
        Skip to sign in
      </a>

      <aside className="hl-hero" aria-label="HealthHub">
        <div className="hl-hero__glow" />
        <div className="hl-hero__glow--alt" />
        <div className="hl-hero__grain" />

        <Link href="/" className="hl-brand">
          <img
            className="hl-brand__mark"
            src="/assets/logo.svg"
            alt=""
            width={40}
            height={40}
          />
          <div>
            <div className="hl-brand__name">HealthHub</div>
            <div className="hl-brand__tag">Private health companion</div>
          </div>
        </Link>

        <div key={port} className="hl-hero__copy">
          <p className="hl-kicker">
            <span className="hl-kicker__dot" />
            {hero.eyebrow}
          </p>
          <h1 className="hl-headline">{hero.headline}</h1>
          <p className="hl-lede">{hero.description}</p>
          <ul className="hl-points">
            {hero.points.map((point) => (
              <li key={point}>
                <span className="hl-points__icon" aria-hidden>
                  <Check size={12} strokeWidth={2.6} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className="hl-pulse" aria-hidden="true">
            <svg viewBox="0 0 640 64">
              <path className="hl-pulse__grid" d="M0 32 H640" />
              <path
                className="hl-pulse__wave"
                d="M0 32 H48 l8-2 10 18 8-38 10 28 12-6 H160 l8-2 10 18 8-38 10 28 12-6 H272 l8-2 10 18 8-38 10 28 12-6 H384 l8-2 10 18 8-38 10 28 12-6 H496 l8-2 10 18 8-38 10 28 12-6 H640"
              />
            </svg>
          </div>
        </div>

        <div className="hl-hero__foot">
          <div className="hl-hero__trust">
            <span>
              <Lock size={12} />
              Encrypted by default
            </span>
            <span>
              <Shield size={12} />
              Never sold or trained on
            </span>
          </div>
          <span>© {new Date().getFullYear()} HealthHub · Colombo</span>
        </div>
      </aside>

      <main className="hl-panel">
        <div className="hl-mobile-brand">
          <div className="hl-mobile-brand__left">
            <img src="/assets/logo.svg" alt="" width={32} height={32} />
            <strong>HealthHub</strong>
          </div>
          <span className="hl-secure">Secure</span>
        </div>

        <div className="hl-form-container" id="login-form">
          <div className="hl-header">
            <span className="hl-eyebrow">Welcome back</span>
            <h2>Sign in to your portal</h2>
            <p>Choose who you are, then continue with the credentials for that workspace.</p>
          </div>

          <div className="hl-tabs" role="tablist" aria-label="Choose a portal">
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
                  className={cn("hl-tab-btn", active && "is-active")}
                >
                  <Icon size={16} strokeWidth={active ? 2.4 : 1.8} />
                  <span className="truncate w-full">{p.label}</span>
                </button>
              );
            })}
          </div>

          <p className="hl-port-note">
            <strong>{selected.label}.</strong> {selected.description}
          </p>

          {port === "patient" && (
            <div className="hl-mode" role="tablist" aria-label="Sign-in method">
              <button
                type="button"
                role="tab"
                aria-selected={patientMode === "password"}
                onClick={() => {
                  setPatientMode("password");
                  setError(null);
                }}
                className={cn(patientMode === "password" && "is-active")}
              >
                <Mail size={14} />
                Email / Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={patientMode === "phone"}
                onClick={() => {
                  setPatientMode("phone");
                  setError(null);
                }}
                className={cn(patientMode === "phone" && "is-active")}
              >
                <Phone size={14} />
                Mobile OTP
              </button>
            </div>
          )}

          {error && (
            <div className="hl-error" role="alert">
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {port === "patient" && patientMode === "phone" ? (
            <form onSubmit={onPhoneSubmit} className="flex flex-col gap-4">
              <div className="hl-field">
                <label htmlFor="phone" className="hl-label">
                  Mobile Number
                </label>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
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
                    className="hl-input"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="hl-btn-primary"
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span className="hl-spinner" aria-hidden />
                    <span>Sending OTP code…</span>
                  </>
                ) : (
                  <>
                    <span>Continue with Phone</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="hl-field">
                <label htmlFor="identifier" className="hl-label">
                  Email or Phone
                </label>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <Mail size={16} />
                  </span>
                  <input
                    id="identifier"
                    autoComplete="username"
                    placeholder={selected.placeholder}
                    {...register("identifier")}
                    value={identifierVal}
                    className="hl-input"
                  />
                </div>
                {errors.identifier?.message && (
                  <p className="hl-field-error">{errors.identifier.message}</p>
                )}
              </div>

              <div className="hl-field">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="hl-label">
                    Password
                  </label>
                  <a
                    href="mailto:support@healthhub.app?subject=Password%20Reset%20Request"
                    className="hl-forgot"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password")}
                    value={passwordVal}
                    className="hl-input"
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="hl-reveal"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="hl-field-error">{errors.password.message}</p>
                )}
              </div>

              <label className="hl-check">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="hl-btn-primary"
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span className="hl-spinner" aria-hidden />
                    <span>Authenticating…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to {selected.label}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {IS_DEV && (
            <div className="hl-dev">
              <span>Quick Dev</span>
              <div className="hl-dev__btns">
                <button
                  type="button"
                  onClick={devLoginAsPatient}
                  disabled={submitting}
                >
                  As Patient
                </button>
                <button
                  type="button"
                  onClick={devLoginAsDoctor}
                  disabled={submitting}
                >
                  As Doctor
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hl-foot">
          <div>
            {port === "patient" ? (
              <span>
                New to HealthHub?{" "}
                <Link href="/patient/register">Create account</Link>
              </span>
            ) : (
              <span>
                Need staff credentials?{" "}
                <a href="mailto:support@healthhub.app?subject=Staff%20Access">
                  Contact admin
                </a>
              </span>
            )}
          </div>
          <div className="hl-foot__legal">
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
