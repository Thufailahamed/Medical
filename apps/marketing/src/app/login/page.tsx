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
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
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
    roles: ["insurance", "ambulance"],
    landingFor: {
      insurance: "/admin/insurance-claims",
      ambulance: "/admin/ambulances",
    },
    description: "Real-time claims adjudication and emergency fleet dispatch.",
    placeholder: "operator@insurance.lk",
  },
];

const PORT_HERO: Record<
  Port,
  {
    eyebrow: string;
    headline: string;
    highlight: string;
    description: string;
  }
> = {
  patient: {
    eyebrow: "Personal Health Gateway",
    headline: "Your health journey,",
    highlight: "protected in one place.",
    description:
      "Encrypted medical records, prescriptions, and direct connection with your doctors — confidential and always in your hands.",
  },
  doctor: {
    eyebrow: "Clinical Practice Cockpit",
    headline: "Patient context ready,",
    highlight: "before your consult begins.",
    description:
      "Longitudinal medical histories, digital prescriptions, lab orders, and diagnostic trends in a unified clinical dashboard.",
  },
  facility: {
    eyebrow: "Healthcare Operations",
    headline: "Wards, labs, and pharmacy,",
    highlight: "seamlessly coordinated.",
    description:
      "Real-time bed management, specimen tracking, automated dispensing, and audit-ready departmental workflows.",
  },
  operator: {
    eyebrow: "Payer & Emergency Network",
    headline: "Instant claims & rapid dispatch,",
    highlight: "connected in real time.",
    description:
      "Direct policy verification, automated claims settlement, and coordinated ambulance fleet tracking across the island.",
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

      {/* ── Left Hero Side ───────────────────────────────────────────────── */}
      <aside className="hl-hero" aria-label="HealthHub Platform">
        <div className="hl-hero__grid" />

        <Link href="/" className="hl-brand">
          <div className="hl-brand__icon-wrap">
            <img src="/assets/logo.svg" alt="" width={22} height={22} />
          </div>
          <div>
            <div className="hl-brand__name">HealthHub</div>
            <div className="hl-brand__badge">Unified Health System</div>
          </div>
        </Link>

        <div key={port} className="hl-hero__body">
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            <span>{hero.eyebrow}</span>
          </div>

          <div>
            <h1 className="hl-headline">
              {hero.headline} <br />
              <span className="hl-headline-accent">{hero.highlight}</span>
            </h1>
            <p className="hl-lede mt-3">{hero.description}</p>
          </div>

          {/* Dynamic Frosted Glass Preview Card */}
          <div className="hl-card-preview">
            <div className="hl-card-preview__top">
              <div className="hl-card-preview__brand">
                <ShieldCheck size={16} className="text-sky-400" />
                <span>Verified System Node</span>
              </div>
              <span className="hl-card-preview__chip">
                {port === "patient" && "LK-NHI · ENCRYPTED"}
                {port === "doctor" && "SLMC · PRACTITIONER"}
                {port === "facility" && "MOH · REGISTERED"}
                {port === "operator" && "EMS · DISPATCH 24/7"}
              </span>
            </div>

            <div className="hl-card-preview__content">
              {port === "patient" && (
                <>
                  <div className="hl-card-row">
                    <div className="hl-card-meta">
                      <div className="hl-card-avatar">NF</div>
                      <div>
                        <div className="hl-card-title">Nimali Fernando</div>
                        <div className="hl-card-subtitle">ID: LK-1994-0821-P · O+</div>
                      </div>
                    </div>
                    <div className="hl-card-tag">
                      <Heart size={12} className="text-rose-400 animate-pulse" />
                      <span><strong>72</strong> bpm</span>
                    </div>
                  </div>
                  <div className="hl-card-badges">
                    <span className="hl-card-tag">Primary: <strong>Dr. K. Perera</strong></span>
                    <span className="hl-card-tag">Prescriptions: <strong>2 Active</strong></span>
                    <span className="hl-card-tag">Vault: <strong>Zero-Knowledge</strong></span>
                  </div>
                </>
              )}

              {port === "doctor" && (
                <>
                  <div className="hl-card-row">
                    <div className="hl-card-meta">
                      <div className="hl-card-avatar">KP</div>
                      <div>
                        <div className="hl-card-title">Dr. Kasun Perera, MD</div>
                        <div className="hl-card-subtitle">SLMC #48291 · Cardiology</div>
                      </div>
                    </div>
                    <div className="hl-card-tag">
                      <Activity size={12} className="text-emerald-400" />
                      <span><strong>14</strong> consults</span>
                    </div>
                  </div>
                  <div className="hl-card-badges">
                    <span className="hl-card-tag">Clinic: <strong>Asiri Central</strong></span>
                    <span className="hl-card-tag">Pending Labs: <strong>3 Priority</strong></span>
                    <span className="hl-card-tag">Sign-off: <strong>Crypto Validated</strong></span>
                  </div>
                </>
              )}

              {port === "facility" && (
                <>
                  <div className="hl-card-row">
                    <div className="hl-card-meta">
                      <div className="hl-card-avatar">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <div className="hl-card-title">Colombo Central Hospital</div>
                        <div className="hl-card-subtitle">FAC-COL-004 · Tertiary Care</div>
                      </div>
                    </div>
                    <div className="hl-card-tag">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Live Sync</span>
                    </div>
                  </div>
                  <div className="hl-card-badges">
                    <span className="hl-card-tag">Bed Occupancy: <strong>84%</strong></span>
                    <span className="hl-card-tag">Pharmacy: <strong>Stocked</strong></span>
                    <span className="hl-card-tag">Labs: <strong>Specimens Active</strong></span>
                  </div>
                </>
              )}

              {port === "operator" && (
                <>
                  <div className="hl-card-row">
                    <div className="hl-card-meta">
                      <div className="hl-card-avatar">
                        <Truck size={16} />
                      </div>
                      <div>
                        <div className="hl-card-title">National Emergency & Claims</div>
                        <div className="hl-card-subtitle">NET-DISPATCH · 24/7 Response</div>
                      </div>
                    </div>
                    <div className="hl-card-tag">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <span>12 En Route</span>
                    </div>
                  </div>
                  <div className="hl-card-badges">
                    <span className="hl-card-tag">Adjudication: <strong>&lt;120ms</strong></span>
                    <span className="hl-card-tag">Fleet Status: <strong>Optimal</strong></span>
                    <span className="hl-card-tag">Audits: <strong>Compliant</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hl-hero__foot">
          <div className="hl-hero__trust">
            <span>
              <ShieldCheck size={13} className="text-sky-400" />
              256-bit Encrypted
            </span>
            <span>
              <CheckCircle2 size={13} className="text-emerald-400" />
              SLMC Verified
            </span>
          </div>
          <span>© {new Date().getFullYear()} HealthHub</span>
        </div>
      </aside>

      {/* ── Right Form Panel ─────────────────────────────────────────────── */}
      <main className="hl-panel">
        <div className="hl-mobile-brand">
          <div className="hl-mobile-brand__left">
            <img src="/assets/logo.svg" alt="" width={30} height={30} />
            <strong>HealthHub</strong>
          </div>
          <span className="hl-secure">
            <ShieldCheck size={12} />
            Secure Portal
          </span>
        </div>

        <div className="hl-form-container" id="login-form">
          <div className="hl-header">
            <span className="hl-eyebrow">Portal Access</span>
            <h2>Sign in to your account</h2>
            <p>Select your workspace role to continue with your credentials.</p>
          </div>

          {/* Minimalist 4-Role Segmented Control */}
          <div className="hl-tabs" role="tablist" aria-label="Select portal workspace">
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
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          <p className="hl-port-note">
            <strong>{selected.label}.</strong> {selected.description}
          </p>

          {/* Patient Mode Toggle */}
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
                <Mail size={13} />
                <span>Password</span>
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
                <Phone size={13} />
                <span>Mobile OTP</span>
              </button>
            </div>
          )}

          {error && (
            <div className="hl-error" role="alert">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {port === "patient" && patientMode === "phone" ? (
            <form onSubmit={onPhoneSubmit} className="flex flex-col gap-3.5">
              <div className="hl-field">
                <label htmlFor="phone" className="hl-label">
                  Mobile Number
                </label>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <Phone size={15} />
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
                    <span>Sending code…</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex flex-col gap-3.5"
            >
              <div className="hl-field">
                <label htmlFor="identifier" className="hl-label">
                  Email or Phone
                </label>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <Mail size={15} />
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
                    Forgot?
                  </a>
                </div>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <Lock size={15} />
                  </span>
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password")}
                    value={passwordVal}
                    className="hl-input"
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="hl-reveal"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="hl-field-error">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="hl-check">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
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
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in as {selected.label}</span>
                    <ArrowRight size={15} />
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
                <Link href="/patient/register">Create an account</Link>
              </span>
            ) : (
              <span>
                Need access?{" "}
                <a href="mailto:support@healthhub.app?subject=Staff%20Access">
                  Contact administrator
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
