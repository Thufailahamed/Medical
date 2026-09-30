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
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Stethoscope,
  Building2,
  Check,
  MessageSquareText,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";
import { useAuthStore, type AuthUser } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";
import { AuthHero } from "@/app/_shared/AuthHero";
import "@/app/_shared/auth-studio.css";

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

  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "YOU";

  const btnInner = (busyLabel: string, idleLabel: string) =>
    busy ? (
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
    <div className="au-root" data-role="patient">
      <a className="au-skip" href="#register-form">
        Skip to register form
      </a>

      <AuthHero
        kicker="Free for patients · Private beta"
        headline="Your health has a history."
        highlight="Start writing it."
        lede="Records, medicines and visits — private, readable, and doctor-ready in English, Sinhala and Tamil."
        photo="/assets/brand/harbor-hands.png"
        float={{
          icon: <ShieldCheck size={15} />,
          title: "Your vault, your keys",
          caption: "Share only what you choose",
        }}
        card={{
          initials,
          title: name.trim() || "Your name here",
          subtitle: "Personal health vault",
          chip: "ENCRYPTED",
          stats: [
            { label: "Languages", value: "EN · SI · TA" },
            { label: "Family", value: "Shareable" },
            { label: "Cost", value: "Free" },
          ],
        }}
      />

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
            <span>Have an account?</span>
            <Link href="/login?port=patient">Sign in</Link>
          </div>
        </div>

        <div className="au-form au-form--wide" id="register-form">
          <div className="au-head">
            <h1>
              Create your <em>health vault.</em>
            </h1>
            <p>Takes about a minute. We&apos;ll verify your email or phone next.</p>
          </div>

          <div className="au-roles au-roles--3" role="tablist" aria-label="Select account registration type">
            <button type="button" role="tab" aria-selected className="au-role au-role--patient is-active">
              <span className="au-role__icon">
                <User size={17} strokeWidth={2.2} />
              </span>
              <span>Patient</span>
            </button>
            <Link href="/doctor/register" role="tab" aria-selected={false} className="au-role au-role--doctor">
              <span className="au-role__icon">
                <Stethoscope size={17} strokeWidth={1.8} />
              </span>
              <span>Doctor</span>
            </Link>
            <Link href="/hospital/register" role="tab" aria-selected={false} className="au-role au-role--facility">
              <span className="au-role__icon">
                <Building2 size={17} strokeWidth={1.8} />
              </span>
              <span>Hospital</span>
            </Link>
          </div>

          <div className="au-steps" aria-label="Registration progress">
            <div className={cn("au-step", step === "details" && "is-active", step === "verify" && "is-done")}>
              <span>
                <b>{step === "verify" ? <Check size={11} style={{ display: "inline" }} /> : "01"}</b>
                Your details
              </span>
            </div>
            <div className={cn("au-step", step === "verify" && "is-active")}>
              <span>
                <b>02</b>
                Verify code
              </span>
            </div>
          </div>

          {error && (
            <div className="au-alert" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {step === "verify" ? (
            <form onSubmit={onVerify} className="au-fields">
              <button type="button" onClick={() => setStep("details")} className="au-textbtn">
                <ChevronLeft size={15} /> Back to details
              </button>

              <div className="au-verify">
                <span className="au-verify__icon">
                  <MessageSquareText size={22} />
                </span>
                <h2>Check your {email ? "inbox" : "messages"}</h2>
                <p>
                  We sent a 6-digit code to <strong>{email || phone}</strong>.
                </p>
              </div>

              <div className="au-field">
                <label htmlFor="otp" className="au-label">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="au-input au-input--otp"
                />
              </div>

              <button type="submit" disabled={busy || otp.length !== 6} className="au-btn" aria-busy={busy}>
                {btnInner("Verifying…", "Verify & open my vault")}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="au-fields">
              <div className="au-section">About you</div>

              <div className="au-field">
                <label htmlFor="name" className="au-label">
                  Full name
                </label>
                <div className="au-input-wrap">
                  <span className="au-input-icon">
                    <User size={16} />
                  </span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Nimali Fernando"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="au-input"
                  />
                </div>
              </div>

              <div className="au-grid-2">
                <div className="au-field">
                  <label htmlFor="dob" className="au-label">
                    Date of birth <small>optional</small>
                  </label>
                  <div className="au-input-wrap">
                    <span className="au-input-icon">
                      <Calendar size={16} />
                    </span>
                    <input
                      id="dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="au-input"
                    />
                  </div>
                </div>

                <div className="au-field">
                  <label htmlFor="gender" className="au-label">
                    Gender <small>optional</small>
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="au-input au-input--plain au-select"
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="au-section">Contact</div>

              <div className="au-grid-2">
                <div className="au-field">
                  <label htmlFor="email" className="au-label">
                    Email
                  </label>
                  <div className="au-input-wrap">
                    <span className="au-input-icon">
                      <Mail size={16} />
                    </span>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="au-input"
                    />
                  </div>
                </div>

                <div className="au-field">
                  <label htmlFor="phone" className="au-label">
                    Mobile
                  </label>
                  <div className="au-input-wrap">
                    <span className="au-input-icon">
                      <Phone size={16} />
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="077 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="au-input"
                    />
                  </div>
                </div>
              </div>

              <div className="au-section">Security</div>

              <div className="au-grid-2">
                <div className="au-field">
                  <label htmlFor="password" className="au-label">
                    Password
                  </label>
                  <div className="au-input-wrap">
                    <span className="au-input-icon">
                      <Lock size={16} />
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
                      className="au-input au-input--pr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="au-adorn"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="au-strength" aria-label={`Password strength: ${pwLabel}`}>
                      <div className="au-strength__bars">
                        {[1, 2, 3, 4].map((i) => (
                          <span key={i} className={cn(pwScore >= i && `is-${pwScore}`)} />
                        ))}
                      </div>
                      <span className="au-strength__label">{pwLabel}</span>
                    </div>
                  )}
                </div>

                <div className="au-field">
                  <label htmlFor="confirmPassword" className="au-label">
                    Confirm password
                  </label>
                  <div className="au-input-wrap">
                    <span className="au-input-icon">
                      <Lock size={16} />
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
                      aria-invalid={!!confirmPassword && confirmPassword !== password}
                      className={cn(
                        "au-input au-input--pr",
                        confirmPassword && confirmPassword === password && "is-valid",
                      )}
                    />
                    {confirmPassword && confirmPassword === password && (
                      <span className="au-adorn" aria-hidden style={{ color: "var(--au-ok)" }}>
                        <Check size={16} />
                      </span>
                    )}
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="au-hint">Passwords do not match</p>
                  )}
                </div>
              </div>

              <label className="au-check">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to the{" "}
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

              <button type="submit" disabled={busy} className="au-btn" aria-busy={busy}>
                {btnInner("Creating account…", "Create Patient Account")}
              </button>

              <p className="au-assure">
                <ShieldCheck size={14} />
                Your records are encrypted and never sold
              </p>
            </form>
          )}
        </div>

        <footer className="au-foot">
          <span>
            Are you a clinician?{" "}
            <Link href="/doctor/register" style={{ color: "var(--au-sky)", fontWeight: 600 }}>
              Join the doctor network
            </Link>
          </span>
          <nav>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="au-root" />}>
      <RegisterForm />
    </Suspense>
  );
}
