"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Phone,
  Lock,
  User,
  ShieldCheck,
  ChevronLeft,
  Calendar,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Stethoscope,
  Building2,
  Heart,
  Check,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useAuthStore, type AuthUser } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";
import "./register.css";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/patient";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"details" | "verify">("details");
  const [otp, setOtp] = useState("");

  // Password strength: 0-4 score driving the segmented meter.
  const pwScore = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return password ? Math.max(1, s) : 0;
  })();
  const pwLabel = ["", "Weak", "Fair", "Good", "Strong"][pwScore];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the terms to continue.");
      return;
    }

    setBusy(true);
    try {
      await api<{ message: string }>(patientPaths.auth.register(), {
        method: "POST",
        json: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          password,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
        },
      });
      setStep("verify");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not create your account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{
        user: AuthUser;
        session: { access_token: string; refresh_token: string };
      }>(patientPaths.auth.verifyOtp(), {
        method: "POST",
        json: {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          otp,
        },
      });
      useAuthStore.getState().setSession({
        token: res.session.access_token,
        user: res.user,
        refreshToken: res.session.refresh_token,
      });
      router.replace(next.startsWith("/patient") ? next : "/patient");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not verify your code. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hl-root">
      <a className="hl-skip" href="#register-form">
        Skip to register form
      </a>

      {/* ── Left Hero Side (Desktop) ──────────────────────────────────────── */}
      <aside className="hl-hero" aria-label="HealthHub Platform">
        <div className="hl-hero__field" aria-hidden="true">
          <div className="hl-hero__spot" />
          <div className="hl-hero__grain" />
          <svg
            className="hl-hero__ecg"
            viewBox="0 0 900 1100"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="hl-ecg-reg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#7eb0ff" stopOpacity="0" />
                <stop offset=".4" stopColor="#5ec8ff" stopOpacity=".7" />
                <stop offset="1" stopColor="#7eb0ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="hl-hero__ecg-path"
              d="M-20 540 H140 l18-48 12 96 18-140 10 70 22-22 H900"
              fill="none"
              stroke="url(#hl-ecg-reg)"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
          <div className="hl-compass">
            <span className="hl-compass__ring" />
            <span className="hl-compass__ring hl-compass__ring--2" />
            <span className="hl-compass__ring hl-compass__ring--3" />
            <span className="hl-compass__ticks" />
            <span className="hl-compass__north">N</span>
            <div className="hl-compass__photo">
              <img
                src="/assets/brand/harbor-hands.png"
                alt="HealthHub"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <Link href="/" className="hl-brand">
          <div className="hl-brand__icon-wrap">
            <img src="/assets/logo.svg" alt="" width={22} height={22} />
          </div>
          <div>
            <div className="hl-brand__name">HealthHub</div>
            <div className="hl-brand__badge">Beta</div>
          </div>
        </Link>

        <div className="hl-hero__body">
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            <span>Private beta · 6°55′N Colombo</span>
          </div>

          <div>
            <h1 className="hl-headline">
              Your health has a history.
              <span className="hl-headline-accent">Start writing it.</span>
            </h1>
            <p className="hl-lede">
              Records, medicines and visits — private, readable, and
              doctor-ready in English, Sinhala and Tamil.
            </p>
            <div className="hl-langs" aria-label="Languages">
              <b>EN</b>
              <i />
              <b>සිංහල</b>
              <i />
              <b>தமிழ்</b>
            </div>
          </div>
        </div>

        <div className="hl-card-preview">
          <div className="hl-card-preview__top">
            <div className="hl-card-preview__brand">
              <ShieldCheck size={16} />
              <span>Personal health vault</span>
            </div>
            <span className="hl-card-preview__chip">LK-NHI · ENCRYPTED</span>
          </div>

          <div className="hl-card-preview__content">
            <div className="hl-card-row">
              <div className="hl-card-meta">
                <div className="hl-card-avatar">
                  {name.trim()
                    ? name
                        .trim()
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "YOU"}
                </div>
                <div>
                  <div className="hl-card-title">
                    {name.trim() || "New Member"}
                  </div>
                  <div className="hl-card-subtitle">
                    ID: LK-NEW-CITIZEN · Universal EHR
                  </div>
                </div>
              </div>
              <div className="hl-card-tag">
                <Heart size={12} className="text-rose-400 animate-pulse" />
                <span>
                  <strong>Live</strong> Sync
                </span>
              </div>
            </div>
            <div className="hl-card-badges">
              <span className="hl-card-tag">
                Language: <strong>Tri-lingual OCR</strong>
              </span>
              <span className="hl-card-tag">
                Family Sharing: <strong>Granular</strong>
              </span>
              <span className="hl-card-tag">
                Privacy: <strong>Zero-Knowledge</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="hl-hero__foot">
          <div className="hl-hero__trust">
            <span>
              <ShieldCheck size={13} />
              256-bit encrypted
            </span>
            <span>
              <Lock size={13} />
              Never sold
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

        <div className="hl-form-container" id="register-form">
          <div className="hl-header">
            <span className="hl-eyebrow">Onboarding Portal</span>
            <h2>
              Create your <em>account.</em>
            </h2>
            <p>
              Already have an account?{" "}
              <Link
                href="/login?port=patient"
                className="font-semibold text-[#0284c7] hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>

          {/* 3-Role Registration Switcher (Patient, Doctor, Hospital) */}
          <div
            className="hl-tabs"
            role="tablist"
            aria-label="Select account registration type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="hl-tab-btn hl-tab-btn--patient is-active"
            >
              <User size={16} strokeWidth={2.2} />
              <span>Patient</span>
            </button>

            <Link
              href="/doctor/register"
              role="tab"
              aria-selected={false}
              className="hl-tab-btn hl-tab-btn--doctor"
            >
              <Stethoscope size={16} strokeWidth={1.8} />
              <span>Doctor</span>
            </Link>

            <Link
              href="/hospital/register"
              role="tab"
              aria-selected={false}
              className="hl-tab-btn hl-tab-btn--hospital"
            >
              <Building2 size={16} strokeWidth={1.8} />
              <span>Hospital</span>
            </Link>
          </div>

          {/* Progress: details → verify */}
          <div className="hl-steps" aria-label="Registration progress">
            <div
              className={cn(
                "hl-step",
                step === "details" && "is-active",
                step === "verify" && "is-done"
              )}
            >
              <span className="hl-step__num">
                {step === "verify" ? <Check size={11} /> : "1"}
              </span>
              <span>Your details</span>
            </div>
            <span className="hl-steps__line" aria-hidden />
            <div className={cn("hl-step", step === "verify" && "is-active")}>
              <span className="hl-step__num">2</span>
              <span>Verify code</span>
            </div>
          </div>

          {error && (
            <div className="hl-error" role="alert">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === "verify" ? (
            <form onSubmit={onVerify} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 self-start"
              >
                <ChevronLeft size={14} /> Back to details
              </button>

              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Verify your account
                </h3>
                <p className="text-sm text-slate-500">
                  We sent a 6-digit verification code to{" "}
                  <strong>{email || phone}</strong>.
                </p>
              </div>

              <div className="hl-field">
                <label htmlFor="otp" className="hl-label">
                  Enter 6-Digit Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  className="hl-input hl-input--otp"
                />
              </div>

              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="hl-btn-primary"
              >
                {busy ? "Verifying code…" : "Verify & access health record"}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <div className="hl-section">Identity</div>

              <div className="hl-field">
                <label htmlFor="name" className="hl-label">
                  Full Name
                </label>
                <div className="hl-input-wrap">
                  <span className="hl-input-icon">
                    <User size={15} />
                  </span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Nimali Fernando"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="hl-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="hl-field">
                  <label htmlFor="dob" className="hl-label">
                    Date of Birth
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Calendar size={15} />
                    </span>
                    <input
                      id="dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="hl-input"
                    />
                  </div>
                </div>

                <div className="hl-field">
                  <label htmlFor="gender" className="hl-label">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="hl-input hl-select"
                    style={{ paddingLeft: 14 }}
                  >
                    <option value="">Select gender…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="hl-section">Contact</div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="hl-field">
                  <label htmlFor="email" className="hl-label">
                    Email Address
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Mail size={15} />
                    </span>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="hl-input"
                    />
                  </div>
                </div>

                <div className="hl-field">
                  <label htmlFor="phone" className="hl-label">
                    Mobile Phone
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Phone size={15} />
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="077 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="hl-input"
                    />
                  </div>
                </div>
              </div>

              <div className="hl-section">Security</div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="hl-field">
                  <label htmlFor="password" className="hl-label">
                    Password
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Lock size={15} />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="hl-input"
                      style={{ paddingRight: 38 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="hl-reveal"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div
                      className="hl-strength"
                      aria-label={`Password strength: ${pwLabel}`}
                    >
                      <div className="hl-strength__bars">
                        {[1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "hl-strength__bar",
                              pwScore >= i && `is-on-${pwScore}`
                            )}
                          />
                        ))}
                      </div>
                      <span className="hl-strength__label">{pwLabel}</span>
                    </div>
                  )}
                </div>

                <div className="hl-field">
                  <label htmlFor="confirmPassword" className="hl-label">
                    Confirm Password
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Lock size={15} />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className={cn(
                        "hl-input",
                        confirmPassword &&
                          (confirmPassword === password
                            ? "!border-emerald-400"
                            : "!border-rose-300")
                      )}
                      style={{ paddingRight: 38 }}
                    />
                    {confirmPassword && confirmPassword === password && (
                      <span className="hl-reveal" aria-hidden>
                        <Check size={15} className="text-emerald-500" />
                      </span>
                    )}
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[11.5px] font-medium text-rose-500 m-0">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </div>

              <label className="hl-check mt-1">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  required
                />
                <span>
                  I accept the{" "}
                  <Link href="/terms" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="hl-btn-primary mt-2"
                aria-busy={busy}
              >
                {busy ? (
                  <span>Creating account…</span>
                ) : (
                  <>
                    <span>Create Patient Account</span>
                    <span className="hl-btn-primary__glyph" aria-hidden>
                      <ArrowRight size={15} />
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="hl-foot">
          <div>
            <span>
              Are you a clinician?{" "}
              <Link href="/doctor/register">Join Doctor Network</Link>
            </span>
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="hl-root" />}>
      <RegisterForm />
    </Suspense>
  );
}
