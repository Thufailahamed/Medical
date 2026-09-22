"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Heart,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/portal/lib/utils";

import "@/app/_shared/auth-harbor.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const STEP_LABELS = ["Facility", "Location", "Admin", "Settlement"];

const STEP_SUBS = [
  "Enter the registered legal name and official licenses for your laboratory.",
  "Configure your diagnostic center's physical address for specimen drop-offs and patient booking.",
  "Create the master clinical administrator account for this laboratory instance.",
  "Provide the corporate bank account details for direct diagnostic service payouts.",
];

export default function LabRegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    licenseNumber: "",
    accreditation: "ISO 15189",
    address: "",
    city: "Colombo",
    operatingHours: "Mon–Sat: 07:00 – 20:00 · Sun: 08:00 – 14:00",
    bankAccount: "",
    bankName: "Commercial Bank of Ceylon",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [appId] = useState(() =>
    Math.floor(Math.random() * 89999 + 10000).toString()
  );

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const facilityInitials =
    form.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "";

  function validateStep(step: number): boolean {
    setError(null);
    if (step === 1) {
      if (!form.name.trim()) {
        setError("Please provide the legal diagnostic facility name.");
        return false;
      }
      if (!form.licenseNumber.trim()) {
        setError("Regulatory facility license / registration number is required.");
        return false;
      }
    } else if (step === 2) {
      if (!form.address.trim()) {
        setError("Physical facility address is required for dispatch & patient routing.");
        return false;
      }
      if (!form.phone.trim()) {
        setError("Facility primary phone number is required.");
        return false;
      }
    } else if (step === 3) {
      if (!form.email.trim() || !form.email.includes("@")) {
        setError("A valid official laboratory administrative email is required.");
        return false;
      }
      if (!form.password || form.password.length < 8) {
        setError("Password must be at least 8 characters in length.");
        return false;
      }
    }
    return true;
  }

  function handleNext(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 4));
    }
  }

  function handleBack() {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password,
          role: "laboratory",
          licenseNumber: form.licenseNumber.trim(),
          accreditation: form.accreditation.trim() || undefined,
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          operatingHours: form.operatingHours.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body?.error ?? `Registration failed (${res.status})`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
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
              <img src="/assets/lab/hero.jpg" alt="" loading="lazy" />
            </div>
          </div>
        </div>

        <Link href="/" className="hl-brand" aria-label="HealthHub home">
          <span className="hl-brand__icon-wrap">
            <Heart size={17} color="#fff" fill="#fff" aria-hidden />
          </span>
          <span>
            <span className="hl-brand__name">HealthHub</span>
            <span className="hl-brand__badge">Diagnostic</span>
          </span>
        </Link>

        <div className="hl-hero__body" key={submitted ? "done" : "form"}>
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            {submitted ? "Application registered" : "Provider onboarding portal"}
          </div>
          <h2 className="hl-headline">
            {submitted ? (
              <>
                Compliance verification
                <span className="hl-headline-accent">underway.</span>
              </>
            ) : (
              <>
                Connect your lab to Sri Lanka&rsquo;s
                <span className="hl-headline-accent">clinical network.</span>
              </>
            )}
          </h2>
          <p className="hl-lede">
            {submitted
              ? "Your facility credentials and accreditation documents have been submitted to the HealthHub National Diagnostic Operations team."
              : "Receive authenticated diagnostic orders from general practitioners, clinics, and hospital wards directly into your laboratory workstation."}
          </p>
          <div className="hl-langs">
            <b>English</b>
            <i />
            <b>සිංහල</b>
            <i />
            <b>தமிழ்</b>
          </div>
        </div>

        <figure className="hl-card-preview" key={`card-${submitted}`}>
          <div className="hl-card-preview__top">
            <div className="hl-card-preview__brand">
              <FlaskConical size={13} aria-hidden />
              <span>HealthHub · Laboratory profile</span>
            </div>
            <span className="hl-card-preview__chip">
              {submitted ? "In review" : "PHSRC · Licensed"}
            </span>
          </div>
          <div className="hl-card-preview__content">
            <div className="hl-card-row">
              <div className="hl-card-meta">
                <div className="hl-card-avatar">
                  {facilityInitials || <FlaskConical size={16} aria-hidden />}
                </div>
                <div>
                  <div className="hl-card-title">
                    {form.name.trim() || "Your laboratory"}
                  </div>
                  <div className="hl-card-subtitle">
                    {form.accreditation}
                    {form.licenseNumber.trim()
                      ? ` · ${form.licenseNumber.trim()}`
                      : ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="hl-card-badges">
              <span className="hl-card-tag">
                <span className="hl-live" aria-hidden />
                {submitted
                  ? "Queued for verification"
                  : "Electronic requisition ready"}
              </span>
              <span className="hl-card-tag">
                <ShieldCheck size={11} aria-hidden />
                MOH compliant
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
              MOH compliant
            </span>
          </div>
          <span>ISO 15189 READY</span>
        </div>
      </div>

      <main className="hl-panel">
        <div className="hl-mobile-brand">
          <div className="hl-mobile-brand__left">
            <div
              className="hl-brand__icon-wrap"
              style={{ background: "var(--hl-lapis)", border: "none" }}
            >
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
                <CheckCircle2 size={26} aria-hidden />
              </div>
              <header className="hl-header">
                <div className="hl-success__chip">
                  Application ID · #HH-LAB-{appId}
                </div>
                <h2>
                  Verification in <em>progress</em>
                </h2>
                <p>
                  We have acknowledged the application for{" "}
                  <strong>{form.name}</strong>. Our clinical liaison will verify
                  your accreditation with the relevant licensing council within
                  24 business hours.
                </p>
              </header>

              <div className="hl-protocol">
                <div className="hl-protocol__step is-done">
                  <span className="hl-protocol__icon">
                    <Check size={13} aria-hidden />
                  </span>
                  <div>
                    <div className="hl-protocol__title">
                      Facility credentials received
                    </div>
                    <div className="hl-protocol__sub">
                      License {form.licenseNumber} registered in intake queue
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-active">
                  <span className="hl-protocol__icon">2</span>
                  <div>
                    <div className="hl-protocol__title">
                      Regulatory &amp; SLAB/ISO verification
                    </div>
                    <div className="hl-protocol__sub">
                      Compliance validation with national medical council
                      database
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-todo">
                  <span className="hl-protocol__icon">3</span>
                  <div>
                    <div className="hl-protocol__title">
                      LIS Bridge &amp; order dispatch activation
                    </div>
                    <div className="hl-protocol__sub">
                      Portal credentials will be activated for electronic
                      requisition orders
                    </div>
                  </div>
                </div>
              </div>

              <Link href="/login?port=facility" className="hl-btn-primary">
                <span>Proceed to Sign In</span>
                <span className="hl-btn-primary__glyph">
                  <ArrowRight size={16} aria-hidden />
                </span>
              </Link>
            </div>
          ) : (
            <>
              <header className="hl-header">
                <div className="hl-eyebrow">
                  Enterprise registration · Step {currentStep}/4
                </div>
                <h2>
                  {currentStep === 1 && (
                    <>
                      Facility &amp; <em>licensing</em>
                    </>
                  )}
                  {currentStep === 2 && (
                    <>
                      Location &amp; <em>hours</em>
                    </>
                  )}
                  {currentStep === 3 && (
                    <>
                      Portal <em>admin</em>
                    </>
                  )}
                  {currentStep === 4 && (
                    <>
                      Settlement &amp; <em>banking</em>
                    </>
                  )}
                </h2>
                <p>{STEP_SUBS[currentStep - 1]}</p>
              </header>

              <div className="hl-steps" aria-label="Registration progress">
                {STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  return (
                    <div
                      key={label}
                      className={cn(
                        "hl-steps__item",
                        currentStep === n && "is-active",
                        currentStep > n && "is-done"
                      )}
                    >
                      <span className="hl-steps__bar" aria-hidden />
                      <span className="hl-steps__label">
                        {n}. {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={currentStep === 4 ? submit : handleNext}
                className="flex flex-col gap-4"
              >
                {/* STEP 1 — Facility & Legal */}
                {currentStep === 1 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="labName" className="hl-label">
                        Official Laboratory / Center Name
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Building2 size={15} aria-hidden />
                        </span>
                        <input
                          id="labName"
                          type="text"
                          autoComplete="organization"
                          value={form.name}
                          onChange={(e) => set("name", e.target.value)}
                          placeholder="e.g. Asiri Central Laboratories"
                          required
                          className="hl-input"
                        />
                      </div>
                    </div>

                    <div className="hl-field-row">
                      <div className="hl-field">
                        <label htmlFor="licenseNumber" className="hl-label">
                          Registration / License No.
                        </label>
                        <div className="hl-input-wrap">
                          <span className="hl-input-icon">
                            <FileText size={15} aria-hidden />
                          </span>
                          <input
                            id="licenseNumber"
                            type="text"
                            value={form.licenseNumber}
                            onChange={(e) =>
                              set("licenseNumber", e.target.value)
                            }
                            placeholder="LAB-2026-XXXX"
                            required
                            className="hl-input"
                          />
                        </div>
                      </div>
                      <div className="hl-field">
                        <label htmlFor="accreditation" className="hl-label">
                          Accreditation
                        </label>
                        <select
                          id="accreditation"
                          value={form.accreditation}
                          onChange={(e) =>
                            set("accreditation", e.target.value)
                          }
                          className="hl-input hl-input--plain"
                        >
                          <option value="ISO 15189">ISO 15189</option>
                          <option value="SLAB Accredited">SLAB Accredited</option>
                          <option value="CAP Accredited">CAP Accredited</option>
                          <option value="MOH Registered">
                            MOH Registered Only
                          </option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <p className="hl-note">
                      <ShieldCheck size={13} aria-hidden />
                      Licenses are matched against the PHSRC registry — use the
                      exact registered entity name.
                    </p>
                  </>
                )}

                {/* STEP 2 — Location & Hours */}
                {currentStep === 2 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="address" className="hl-label">
                        Physical Facility Address
                      </label>
                      <textarea
                        id="address"
                        rows={2}
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        placeholder="Street number, building, road name, district"
                        required
                        className="hl-input hl-input--plain"
                      />
                    </div>

                    <div className="hl-field-row">
                      <div className="hl-field">
                        <label htmlFor="city" className="hl-label">
                          City / Region
                        </label>
                        <select
                          id="city"
                          value={form.city}
                          onChange={(e) => set("city", e.target.value)}
                          className="hl-input hl-input--plain"
                        >
                          <option value="Colombo">Colombo</option>
                          <option value="Kandy">Kandy</option>
                          <option value="Galle">Galle</option>
                          <option value="Gampaha">Gampaha</option>
                          <option value="Jaffna">Jaffna</option>
                          <option value="Kurunegala">Kurunegala</option>
                          <option value="Matara">Matara</option>
                          <option value="Kalutara">Kalutara</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="hl-field">
                        <label htmlFor="phone" className="hl-label">
                          Desk Phone
                        </label>
                        <div className="hl-input-wrap">
                          <span className="hl-input-icon">
                            <Phone size={15} aria-hidden />
                          </span>
                          <input
                            id="phone"
                            type="tel"
                            autoComplete="tel"
                            value={form.phone}
                            onChange={(e) => set("phone", e.target.value)}
                            placeholder="011 234 5678"
                            required
                            className="hl-input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="operatingHours" className="hl-label">
                        Operating Schedule &amp; Specimen Drop-off
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Clock size={15} aria-hidden />
                        </span>
                        <input
                          id="operatingHours"
                          type="text"
                          value={form.operatingHours}
                          onChange={(e) =>
                            set("operatingHours", e.target.value)
                          }
                          placeholder="Mon–Sat: 07:00 – 20:00"
                          className="hl-input"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 3 — Portal Admin */}
                {currentStep === 3 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="email" className="hl-label">
                        Official Administrative Email
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Mail size={15} aria-hidden />
                        </span>
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          placeholder="director@diagnostics.lk"
                          required
                          className="hl-input"
                        />
                      </div>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="password" className="hl-label">
                        Account Master Password
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Lock size={15} aria-hidden />
                        </span>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          minLength={8}
                          value={form.password}
                          onChange={(e) => set("password", e.target.value)}
                          placeholder="At least 8 characters"
                          required
                          autoComplete="new-password"
                          className="hl-input"
                          style={{ paddingRight: 48 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
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

                    <p className="hl-note">
                      <ShieldCheck size={13} aria-hidden />
                      Root master login for your lab operations dashboard —
                      encrypted at rest.
                    </p>
                  </>
                )}

                {/* STEP 4 — Disbursement */}
                {currentStep === 4 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="bankName" className="hl-label">
                        Settlement Bank
                      </label>
                      <select
                        id="bankName"
                        value={form.bankName}
                        onChange={(e) => set("bankName", e.target.value)}
                        className="hl-input hl-input--plain"
                      >
                        <option value="Commercial Bank of Ceylon">
                          Commercial Bank of Ceylon
                        </option>
                        <option value="Bank of Ceylon (BOC)">
                          Bank of Ceylon
                        </option>
                        <option value="Hatton National Bank (HNB)">HNB</option>
                        <option value="Sampath Bank">Sampath Bank</option>
                        <option value="Nations Trust Bank (NTB)">NTB</option>
                        <option value="Seylan Bank">Seylan Bank</option>
                        <option value="Standard Chartered">
                          Standard Chartered
                        </option>
                        <option value="Other">Other Bank</option>
                      </select>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="bankAccount" className="hl-label">
                        Account Number (Corporate Payouts)
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <CreditCard size={15} aria-hidden />
                        </span>
                        <input
                          id="bankAccount"
                          type="text"
                          inputMode="numeric"
                          value={form.bankAccount}
                          onChange={(e) =>
                            set("bankAccount", e.target.value)
                          }
                          placeholder="e.g. 100029384812"
                          className="hl-input"
                        />
                      </div>
                    </div>

                    <div className="hl-protocol">
                      {(
                        [
                          ["Facility", form.name],
                          ["License", form.licenseNumber],
                          ["Admin Email", form.email],
                          ["Accreditation", form.accreditation],
                        ] as const
                      ).map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between py-1.5 text-[12.5px]"
                        >
                          <span style={{ color: "var(--hl-ink-faint)" }}>
                            {label}
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: "var(--hl-ink)" }}
                          >
                            {value || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {error ? (
                  <div role="alert" className="hl-error">
                    {error}
                  </div>
                ) : null}

                <div className="hl-form-nav">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      className="hl-btn-ghost"
                      onClick={handleBack}
                    >
                      <ArrowLeft size={14} aria-hidden />
                      Back
                    </button>
                  ) : (
                    <Link href="/login?port=facility" className="hl-btn-ghost">
                      <ArrowLeft size={14} aria-hidden />
                      Cancel
                    </Link>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="hl-btn-primary hl-btn-primary--inline"
                  >
                    <span>
                      {currentStep < 4
                        ? "Continue"
                        : submitting
                        ? "Submitting…"
                        : "Complete Registration"}
                    </span>
                    <span className="hl-btn-primary__glyph">
                      {currentStep < 4 ? (
                        <ArrowRight size={16} aria-hidden />
                      ) : (
                        <CheckCircle2 size={16} aria-hidden />
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="hl-foot mt-6">
            <span>
              Already an enrolled diagnostic partner?{" "}
              <Link href="/login?port=facility">Sign in</Link>
            </span>
            <div className="hl-foot__legal">
              <Link href="/privacy">Privacy</Link>
              <span aria-hidden>·</span>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
