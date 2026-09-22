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
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  Stethoscope,
  Building2,
  BadgeCheck,
  Check,
  MapPin,
  FileText,
} from "lucide-react";

import { api, ApiError } from "@/hospital/lib/api";
import { useT } from "@/hospital/i18n";
import { cn } from "@/portal/lib/utils";

import "@/app/_shared/auth-harbor.css";

const STEP_KEYS = ["register.step1", "register.step2", "register.step3"] as const;

export default function RegisterPage() {
  const t = useT();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    tenantType: "hospital" as "hospital" | "clinic",
    facilityName: "",
    licenseNumber: "",
    address: "",
    location: "",
    facilityPhone: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const facilityInitials =
    form.facilityName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "";

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await api("/auth/register-tenant", {
        method: "POST",
        json: { ...form },
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not submit your registration. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step < 3) setStep(step + 1);
    else submit();
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
            <span className="hl-brand__badge">Facility</span>
          </span>
        </Link>

        <div className="hl-hero__body" key={submitted ? "done" : "form"}>
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            {submitted ? "Application received" : "Hospital · lab · pharmacy"}
          </div>
          <h2 className="hl-headline">
            {submitted ? (
              <>
                Registration
                <span className="hl-headline-accent">under review.</span>
              </>
            ) : (
              <>
                Wards, specimens, stock.
                <span className="hl-headline-accent">One quiet board.</span>
              </>
            )}
          </h2>
          <p className="hl-lede">
            {submitted
              ? "Our team verifies every facility before activating its operations hub. You will hear from us shortly."
              : "Beds, lab routing and dispensing coordinated without the WhatsApp scramble."}
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
              <Building2 size={13} aria-hidden />
              <span>HealthHub · Facility profile</span>
            </div>
            <span className="hl-card-preview__chip">
              {submitted ? "In review" : "MOH · Registered"}
            </span>
          </div>
          <div className="hl-card-preview__content">
            <div className="hl-card-row">
              <div className="hl-card-meta">
                <div className="hl-card-avatar">
                  {facilityInitials || <Building2 size={16} aria-hidden />}
                </div>
                <div>
                  <div className="hl-card-title">
                    {form.facilityName.trim() || "Your facility"}
                  </div>
                  <div className="hl-card-subtitle">
                    {form.tenantType === "clinic" ? "Clinic" : "Hospital"}
                    {form.licenseNumber.trim()
                      ? ` · Reg ${form.licenseNumber.trim()}`
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
                  : "Verified before activation"}
              </span>
              <span className="hl-card-tag">
                <BadgeCheck size={11} aria-hidden />
                Full operations access
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
              MOH verified
            </span>
          </div>
          <span>v2.4 · CareOS</span>
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
                <Check size={26} aria-hidden />
              </div>
              <header className="hl-header">
                <div className="hl-success__chip">Application received</div>
                <h2>
                  {t("register.thankYou")} <em>— pending review</em>
                </h2>
                <p>{t("auth.pendingApprovalMsg")}</p>
              </header>

              <div className="hl-protocol">
                <div className="hl-protocol__step is-done">
                  <span className="hl-protocol__icon">
                    <Check size={13} aria-hidden />
                  </span>
                  <div>
                    <div className="hl-protocol__title">
                      Application received
                    </div>
                    <div className="hl-protocol__sub">
                      {form.facilityName.trim() || "Facility"}
                      {form.licenseNumber.trim()
                        ? ` · Reg ${form.licenseNumber.trim()}`
                        : ""}{" "}
                      registered in the intake queue
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-active">
                  <span className="hl-protocol__icon">2</span>
                  <div>
                    <div className="hl-protocol__title">Facility review</div>
                    <div className="hl-protocol__sub">
                      Registration and license checked against the national
                      registry
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-todo">
                  <span className="hl-protocol__icon">3</span>
                  <div>
                    <div className="hl-protocol__title">Hub activation</div>
                    <div className="hl-protocol__sub">
                      Sign-in unlocks once an administrator approves the
                      facility
                    </div>
                  </div>
                </div>
              </div>

              <Link href="/login?port=facility" className="hl-btn-primary">
                <span>{t("auth.submit")}</span>
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

                <Link
                  href="/doctor/register"
                  role="tab"
                  aria-selected={false}
                  className="hl-tab-btn hl-tab-btn--doctor"
                >
                  <Stethoscope size={16} strokeWidth={1.8} />
                  <span>Doctor</span>
                </Link>

                <button
                  type="button"
                  role="tab"
                  aria-selected={true}
                  className="hl-tab-btn hl-tab-btn--hospital is-active"
                >
                  <Building2 size={16} strokeWidth={2.2} />
                  <span>Hospital</span>
                </button>
              </div>

              <header className="hl-header">
                <div className="hl-eyebrow">Facility hub</div>
                <h2>{t("register.title")}</h2>
                <p>{t("register.subtitle")}</p>
              </header>

              <div
                className="hl-steps"
                aria-label="Registration progress"
              >
                {STEP_KEYS.map((key, i) => {
                  const n = i + 1;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "hl-steps__item",
                        step === n && "is-active",
                        step > n && "is-done"
                      )}
                    >
                      <span className="hl-steps__bar" aria-hidden />
                      <span className="hl-steps__label">
                        {n}. {t(key)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                {step === 1 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="tenantType" className="hl-label">
                        {t("register.facilityType")}
                      </label>
                      <select
                        id="tenantType"
                        value={form.tenantType}
                        onChange={(e) =>
                          set({
                            tenantType: e.target.value as
                              | "hospital"
                              | "clinic",
                          })
                        }
                        className="hl-input hl-input--plain"
                      >
                        <option value="hospital">Hospital</option>
                        <option value="clinic">Clinic</option>
                      </select>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="facilityName" className="hl-label">
                        {t("register.facilityName")}
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Building2 size={15} aria-hidden />
                        </span>
                        <input
                          id="facilityName"
                          type="text"
                          autoComplete="organization"
                          value={form.facilityName}
                          onChange={(e) =>
                            set({ facilityName: e.target.value })
                          }
                          placeholder="Colombo Central Hospital"
                          required
                          className="hl-input"
                        />
                      </div>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="licenseNumber" className="hl-label">
                        {t("register.regNo")}
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
                            set({ licenseNumber: e.target.value })
                          }
                          placeholder="e.g. PHSRC/12345"
                          required
                          className="hl-input"
                        />
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="address" className="hl-label">
                        {t("common.address")}
                      </label>
                      <textarea
                        id="address"
                        rows={2}
                        value={form.address}
                        onChange={(e) => set({ address: e.target.value })}
                        placeholder="Street address"
                        className="hl-input hl-input--plain"
                      />
                    </div>

                    <div className="hl-field-row">
                      <div className="hl-field">
                        <label htmlFor="location" className="hl-label">
                          {t("register.city")}
                        </label>
                        <div className="hl-input-wrap">
                          <span className="hl-input-icon">
                            <MapPin size={15} aria-hidden />
                          </span>
                          <input
                            id="location"
                            type="text"
                            value={form.location}
                            onChange={(e) =>
                              set({ location: e.target.value })
                            }
                            placeholder="Colombo"
                            className="hl-input"
                          />
                        </div>
                      </div>
                      <div className="hl-field">
                        <label htmlFor="facilityPhone" className="hl-label">
                          {t("register.facilityPhone")}
                        </label>
                        <div className="hl-input-wrap">
                          <span className="hl-input-icon">
                            <Phone size={15} aria-hidden />
                          </span>
                          <input
                            id="facilityPhone"
                            type="tel"
                            autoComplete="tel"
                            value={form.facilityPhone}
                            onChange={(e) =>
                              set({ facilityPhone: e.target.value })
                            }
                            placeholder="+94 …"
                            className="hl-input"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="hl-field">
                      <label htmlFor="ownerName" className="hl-label">
                        {t("register.ownerName")}
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <User size={15} aria-hidden />
                        </span>
                        <input
                          id="ownerName"
                          type="text"
                          autoComplete="name"
                          value={form.ownerName}
                          onChange={(e) =>
                            set({ ownerName: e.target.value })
                          }
                          placeholder="Full name"
                          required
                          className="hl-input"
                        />
                      </div>
                    </div>

                    <div className="hl-field-row">
                      <div className="hl-field">
                        <label htmlFor="email" className="hl-label">
                          {t("common.email")}
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
                            onChange={(e) => set({ email: e.target.value })}
                            placeholder="admin@hospital.lk"
                            required
                            className="hl-input"
                          />
                        </div>
                      </div>
                      <div className="hl-field">
                        <label htmlFor="phone" className="hl-label">
                          {t("register.phoneOptional")}
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
                            onChange={(e) => set({ phone: e.target.value })}
                            placeholder="+94 …"
                            className="hl-input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="hl-field">
                      <label htmlFor="password" className="hl-label">
                        {t("auth.passwordLabel")}
                      </label>
                      <div className="hl-input-wrap">
                        <span className="hl-input-icon">
                          <Lock size={15} aria-hidden />
                        </span>
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) =>
                            set({ password: e.target.value })
                          }
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
                  </>
                )}

                {error ? (
                  <div role="alert" className="hl-error">
                    {error}
                  </div>
                ) : null}

                <div className="hl-form-nav">
                  {step > 1 ? (
                    <button
                      type="button"
                      className="hl-btn-ghost"
                      onClick={() => {
                        setError(null);
                        setStep(step - 1);
                      }}
                    >
                      <ArrowLeft size={14} aria-hidden />
                      {t("common.back")}
                    </button>
                  ) : (
                    <Link href="/login?port=facility" className="hl-btn-ghost">
                      {t("auth.backToSite")}
                    </Link>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="hl-btn-primary hl-btn-primary--inline"
                  >
                    <span>
                      {step < 3
                        ? t("common.next")
                        : submitting
                        ? t("common.loading")
                        : t("common.submit")}
                    </span>
                    <span className="hl-btn-primary__glyph">
                      <ArrowRight size={16} aria-hidden />
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="hl-foot mt-6">
            <span>
              Already registered?{" "}
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
