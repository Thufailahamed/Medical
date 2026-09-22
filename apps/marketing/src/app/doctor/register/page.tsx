"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Mail,
  Phone,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Stethoscope,
  BadgeCheck,
  Check,
  Building2,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";

import "@/app/_shared/auth-harbor.css";

const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Paediatrics",
  "Obstetrics & Gynaecology",
  "Orthopaedics",
  "Dermatology",
  "Psychiatry",
  "ENT",
  "Ophthalmology",
  "Radiology",
  "Anaesthesiology",
  "Emergency Medicine",
  "Other",
];

export default function DoctorRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "Dr";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() && !phone.trim()) {
      setError("Please provide an email or a phone number.");
      return;
    }
    if (!specialization) {
      setError("Please choose your specialization.");
      return;
    }
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
      await api("/auth/register", {
        method: "POST",
        json: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          role: "doctor",
          doctorProfile: {
            specialization,
            registrationNumber: regNumber.trim() || undefined,
          },
        },
      });
      // Gated role: API responds 202 + requiresApproval, no session is
      // issued. The success panel explains the review to the applicant.
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not submit your application. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hl-root">
      <a href="#form-start" className="hl-skip">
        Skip to form
      </a>

      <div className="hl-hero" aria-hidden>
        <div className="hl-hero__field">
          <div className="hl-hero__spot" />
          <div className="hl-hero__grain" />
          <svg
            className="hl-hero__ecg"
            viewBox="0 0 1400 900"
            preserveAspectRatio="none"
          >
            <path
              d="M0,690 L240,690 L268,690 L282,648 L298,720 L316,690 L420,690 L448,690 L462,660 L478,708 L496,690 L640,690 L668,690 L682,648 L698,720 L716,690 L840,690 L868,690 L882,660 L898,708 L916,690 L1400,690"
              fill="none"
              stroke="rgba(122,168,255,0.4)"
              strokeWidth="1.4"
              className="hl-hero__ecg-path"
            />
          </svg>
          <div className="hl-compass">
            <div className="hl-compass__ring" />
            <div className="hl-compass__ring hl-compass__ring--2" />
            <div className="hl-compass__ring hl-compass__ring--3" />
            <div className="hl-compass__ticks" />
            <div className="hl-compass__north">N</div>
            <div className="hl-compass__photo">
              <img
                src="/assets/insurance/plan-types/insurance-senior.jpg"
                alt=""
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <Link href="/" className="hl-brand" aria-label="HealthHub home">
          <span className="hl-brand__icon-wrap">
            <Heart size={17} color="#fff" fill="#fff" aria-hidden />
          </span>
          <span>
            <span className="hl-brand__name">HealthHub</span>
            <span className="hl-brand__badge">Clinician</span>
          </span>
        </Link>

        <div className="hl-hero__body" key={submitted ? "done" : "form"}>
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            {submitted ? "Application received" : "Clinician onboarding"}
          </div>
          <h2 className="hl-headline">
            {submitted ? (
              <>
                Credentials
                <span className="hl-headline-accent">under review.</span>
              </>
            ) : (
              <>
                Practise with the whole chart,
                <span className="hl-headline-accent">not just the visit.</span>
              </>
            )}
          </h2>
          <p className="hl-lede">
            {submitted
              ? "Our clinical team verifies every SLMC registration before activating a workstation. You will hear from us shortly."
              : "Join the clinician network: longitudinal patient history, labs, imaging and e-prescriptions — in one calm workstation."}
          </p>
          <div className="hl-langs">
            <b>English</b>
            <i />
            <b>தமிழ்</b>
            <i />
            <b>हिन्दी</b>
          </div>
        </div>

        <figure className="hl-card-preview" key={`card-${submitted}`}>
          <div className="hl-card-preview__top">
            <div className="hl-card-preview__brand">
              <Stethoscope size={13} aria-hidden />
              <span>HealthHub · Clinician profile</span>
            </div>
            <span className="hl-card-preview__chip">
              {submitted ? "In review" : "Credential check"}
            </span>
          </div>
          <div className="hl-card-preview__content">
            <div className="hl-card-row">
              <div className="hl-card-meta">
                <div className="hl-card-avatar">{initials}</div>
                <div>
                  <div className="hl-card-title">
                    {name.trim() ? `Dr. ${name.trim()}` : "Dr. Your name"}
                  </div>
                  <div className="hl-card-subtitle">
                    {specialization || "Specialization"}
                    {regNumber.trim() ? ` · SLMC ${regNumber.trim()}` : ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="hl-card-badges">
              <span className="hl-card-tag">
                <span className="hl-live" aria-hidden />
                {submitted ? "Queued for verification" : "Verified before activation"}
              </span>
              <span className="hl-card-tag">
                <BadgeCheck size={11} aria-hidden />
                Full chart access
              </span>
            </div>
          </div>
        </figure>

        <div className="hl-hero__foot">
          <div className="hl-hero__trust">
            <span>
              <Lock size={11} aria-hidden />
              256-bit encrypted
            </span>
            <span>
              <ShieldCheck size={11} aria-hidden />
              SLMC verified
            </span>
          </div>
          <span>v2.4 · CareOS</span>
        </div>
      </div>

      <main className="hl-panel">
        <div className="hl-mobile-brand">
          <div className="hl-mobile-brand__left">
            <div className="hl-brand__icon-wrap" style={{ background: "var(--hl-lapis)", border: "none" }}>
              <Heart size={15} color="#fff" fill="#fff" aria-hidden />
            </div>
            <strong>HealthHub</strong>
          </div>
          <div className="hl-secure">
            <Lock size={10} aria-hidden />
            Encrypted
          </div>
        </div>

        <div className="hl-form-container" id="form-start">
          {submitted ? (
            <div className="hl-success">
              <div className="hl-success__icon">
                <Check size={26} aria-hidden />
              </div>
              <header className="hl-header">
                <div className="hl-success__chip">Application received</div>
                <h2>
                  Pending <em>review</em>
                </h2>
                <p>
                  Thank you, Dr. {name.trim().split(/\s+/)[0] || "Doctor"}. Your
                  registration has been forwarded to our clinical verification
                  team. We typically respond within one business day.
                </p>
              </header>

              <div className="hl-protocol">
                <div className="hl-protocol__step is-done">
                  <span className="hl-protocol__icon">
                    <Check size={13} aria-hidden />
                  </span>
                  <div>
                    <div className="hl-protocol__title">Application received</div>
                    <div className="hl-protocol__sub">
                      {specialization}
                      {regNumber.trim() ? ` · SLMC ${regNumber.trim()}` : ""} registered in the intake queue
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-active">
                  <span className="hl-protocol__icon">2</span>
                  <div>
                    <div className="hl-protocol__title">Credential verification</div>
                    <div className="hl-protocol__sub">
                      SLMC registration and specialization checked against the national registry
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-todo">
                  <span className="hl-protocol__icon">3</span>
                  <div>
                    <div className="hl-protocol__title">Workstation activation</div>
                    <div className="hl-protocol__sub">
                      Sign-in unlocks once an administrator approves the account
                    </div>
                  </div>
                </div>
              </div>

              <Link href="/login?port=doctor" className="hl-btn-primary">
                <span>Back to sign in</span>
                <span className="hl-btn-primary__glyph">
                  <ArrowRight size={16} aria-hidden />
                </span>
              </Link>
            </div>
          ) : (
            <>
              {/* 3-Role Registration Switcher (Patient, Doctor, Hospital) */}
              <div
                className="hl-tabs mb-4"
                role="tablist"
                aria-label="Select account registration type"
              >
                <Link
                  href="/patient/register"
                  role="tab"
                  aria-selected={false}
                  className="hl-tab-btn hl-tab-btn--patient"
                >
                  <User size={16} strokeWidth={1.8} />
                  <span>Patient</span>
                </Link>

                <button
                  type="button"
                  role="tab"
                  aria-selected={true}
                  className="hl-tab-btn hl-tab-btn--doctor is-active"
                >
                  <Stethoscope size={16} strokeWidth={2.2} />
                  <span>Doctor</span>
                </button>

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

              <header className="hl-header">
                <div className="hl-eyebrow">Doctor portal</div>
                <h2>
                  Request <em>access</em>
                </h2>
                <p>
                  Self-serve registration for clinicians. Accounts activate after
                  credential verification.
                </p>
              </header>

              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="hl-field">
                  <label htmlFor="name" className="hl-label">
                    Full name
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <User size={15} aria-hidden />
                    </span>
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nadeesha Perera"
                      required
                      className="hl-input"
                    />
                  </div>
                </div>

                <div className="hl-field-row">
                  <div className="hl-field">
                    <label htmlFor="email" className="hl-label">
                      Email
                    </label>
                    <div className="hl-input-wrap">
                      <span className="hl-input-icon">
                        <Mail size={15} aria-hidden />
                      </span>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="doctor@hospital.lk"
                        className="hl-input"
                      />
                    </div>
                  </div>
                  <div className="hl-field">
                    <label htmlFor="phone" className="hl-label">
                      Phone
                    </label>
                    <div className="hl-input-wrap">
                      <span className="hl-input-icon">
                        <Phone size={15} aria-hidden />
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+94 …"
                        className="hl-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="hl-field-row">
                  <div className="hl-field">
                    <label htmlFor="specialization" className="hl-label">
                      Specialization
                    </label>
                    <select
                      id="specialization"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      required
                      className="hl-input hl-input--plain"
                    >
                      <option value="">Select…</option>
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hl-field">
                    <label htmlFor="reg" className="hl-label">
                      SLMC reg. no.
                    </label>
                    <div className="hl-input-wrap">
                      <span className="hl-input-icon">
                        <BadgeCheck size={15} aria-hidden />
                      </span>
                      <input
                        id="reg"
                        type="text"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder="e.g. 12345"
                        className="hl-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="hl-field">
                  <label htmlFor="password" className="hl-label">
                    Password
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Lock size={15} aria-hidden />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="hl-input"
                      style={{ paddingRight: 48 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="hl-reveal"
                    >
                      {showPassword ? (
                        <EyeOff size={15} aria-hidden />
                      ) : (
                        <Eye size={15} aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div className="hl-field">
                  <label htmlFor="confirm" className="hl-label">
                    Confirm password
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Lock size={15} aria-hidden />
                    </span>
                    <input
                      id="confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      className="hl-input"
                    />
                  </div>
                </div>

                <label className="hl-check">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    I accept the <Link href="/terms">terms of service</Link> and{" "}
                    <Link href="/privacy">privacy policy</Link>, and confirm my
                    credentials are accurate.
                  </span>
                </label>

                {error ? (
                  <div role="alert" className="hl-error">
                    {error}
                  </div>
                ) : null}

                <button type="submit" disabled={busy} className="hl-btn-primary">
                  <span>{busy ? "Submitting…" : "Submit for verification"}</span>
                  <span className="hl-btn-primary__glyph">
                    {busy ? (
                      <span className="hl-spinner" aria-hidden />
                    ) : (
                      <ArrowRight size={16} aria-hidden />
                    )}
                  </span>
                </button>

                <p className="hl-note">
                  <ShieldCheck size={12} aria-hidden />
                  Reviewed by the clinical team before activation
                </p>
              </form>
            </>
          )}
        </div>

        <footer className="hl-foot">
          <span>
            Already approved? <Link href="/login?port=doctor">Sign in</Link>
          </span>
          <div className="hl-foot__legal">
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
