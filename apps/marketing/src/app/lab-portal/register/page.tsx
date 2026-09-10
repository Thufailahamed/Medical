"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  FileCheck2,
  FlaskConical,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Zap,
  CircleDashed,
  CircleDot,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const STEPS = [
  {
    id: 1,
    title: "Facility & Legal",
    desc: "License & Accreditation",
    icon: FileCheck2,
  },
  {
    id: 2,
    title: "Location & Hours",
    desc: "Address & Operations",
    icon: MapPin,
  },
  {
    id: 3,
    title: "Portal Admin",
    desc: "Credentials & Contact",
    icon: Lock,
  },
  {
    id: 4,
    title: "Disbursement",
    desc: "Settlement Account",
    icon: CreditCard,
  },
];

const STEP_ICONS: Record<number, typeof FileCheck2> = {
  1: FileCheck2,
  2: MapPin,
  3: Lock,
  4: CreditCard,
};

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

  /* ── Success state ─────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="lab-split-root flex-col lg:flex-row">
        <aside className="lab-hero-bg relative flex lg:w-5/12 flex-col justify-between overflow-hidden p-8 lg:p-12 text-white border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="lab-grid-pattern absolute inset-0 pointer-events-none" />
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 backdrop-blur-md">
                <FlaskConical size={20} />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-white">
                  HealthHub
                </div>
                <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-400">
                  Diagnostic Network
                </div>
              </div>
            </Link>
          </div>
          <div className="relative z-10 my-10 max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Application Registered
            </div>
            <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl italic">
              Compliance verification underway.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Your facility credentials and accreditation documents have been
              submitted to the HealthHub National Diagnostic Operations team.
            </p>
          </div>
          <div className="relative z-10 border-t border-white/10 pt-6 text-xs text-slate-500 font-mono">
            Node ID: LK-DIAG-
            {(form.licenseNumber || "2026").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}{" "}
            · 256-bit TLS Encrypted
          </div>
        </aside>

        <main className="flex flex-1 items-center justify-center p-6 lg:p-14 bg-[var(--lab-bg)] lab-bg-grain">
          <div className="w-full max-w-lg">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lab-brand-soft)] border border-[var(--lab-brand)]/20 text-[var(--lab-brand)] shadow-sm">
              <CheckCircle2 size={28} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lab-brand)]/20 bg-[var(--lab-brand-soft)] px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--lab-brand)]">
              Application ID: #HH-LAB-{appId}
            </span>
            <h2 className="mt-3 font-display text-3xl font-medium text-[var(--lab-night)] tracking-tight italic">
              Verification in progress
            </h2>
            <p className="mt-2 text-sm text-[var(--lab-ink-soft)] leading-relaxed">
              We have acknowledged the application for{" "}
              <strong className="text-[var(--lab-night)] font-semibold">
                {form.name}
              </strong>
              . Our clinical liaison will verify your accreditation with the
              relevant licensing council within 24 business hours.
            </p>

            <div className="lab-card mt-8 !shadow-none">
              <div className="lab-card-head">
                <div className="lab-card-title">
                  <ShieldCheck size={14} />
                  Onboarding protocol
                </div>
              </div>
              <div className="lab-card-pad space-y-3.5">
                <ProtocolStep
                  done
                  title="Facility credentials received"
                  sub={`License ${form.licenseNumber} registered in intake queue`}
                />
                <ProtocolStep
                  active
                  title="Regulatory & SLAB/ISO verification"
                  sub="Compliance validation with national medical council database"
                />
                <ProtocolStep
                  todo
                  step={3}
                  title="LIS Bridge & order dispatch activation"
                  sub="Portal credentials will be activated for electronic requisition orders"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/login?port=facility"
                className="lab-btn lab-btn-primary w-full sm:w-auto"
              >
                Proceed to Sign In
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/"
                className="lab-btn lab-btn-secondary w-full sm:w-auto"
              >
                Return to HealthHub Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ── Wizard state ──────────────────────────────────────────────── */
  const CurrentIcon = STEP_ICONS[currentStep];

  return (
    <div className="lab-split-root flex-col lg:flex-row min-h-screen">
      {/* Left Hero Side */}
      <aside className="lab-hero-bg relative flex lg:w-5/12 flex-col justify-between overflow-hidden p-8 lg:p-12 text-white border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="lab-grid-pattern absolute inset-0 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 backdrop-blur-md group-hover:bg-emerald-500/20 transition-all">
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                HealthHub
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-medium tracking-wider text-emerald-400 uppercase">
                  DIAGNOSTIC
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                National Laboratory Gateway
              </div>
            </div>
          </Link>

          <Link
            href="/login?port=facility"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Existing facility?</span>
            <span className="underline underline-offset-4">Sign in</span>
          </Link>
        </div>

        <div className="relative z-10 my-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Provider Onboarding Portal
          </div>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15] font-medium tracking-tight text-white italic">
            Connect your lab to Sri Lanka&rsquo;s clinical network.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Receive authenticated diagnostic orders from general practitioners,
            clinics, and hospital wards directly into your laboratory
            workstation with automated patient results delivery.
          </p>

          <div className="mt-8 space-y-3">
            <HeroBadge
              icon={Zap}
              tint="emerald"
              title="Direct Electronic Requisition (CPOE)"
              sub="Receive orders with barcoded patient identifiers & clinical indications"
            />
            <HeroBadge
              icon={FileCheck2}
              tint="sky"
              title="Instant Results Synchronization"
              sub="Validated reports sync directly to the patient's unified health record"
            />
            <HeroBadge
              icon={CreditCard}
              tint="purple"
              title="Automated Insurance & Direct Settlements"
              sub="Fast weekly batch disbursements straight into your nominated bank account"
            />
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 pt-6 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Ministry of Health (MOH) Compliant</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            ISO 15189 READY
          </span>
        </div>
      </aside>

      {/* Right Form Side */}
      <main className="flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-14 bg-[var(--lab-bg)] lab-bg-grain overflow-y-auto">
        <div className="mx-auto w-full max-w-xl">
          {/* Mobile brand bar */}
          <div className="flex items-center justify-between pb-6 border-b border-[var(--lab-border)] lg:hidden mb-6">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--lab-brand-soft)] text-[var(--lab-brand)]">
                <FlaskConical size={16} />
              </div>
              <span className="text-xs font-bold text-[var(--lab-night)]">
                HealthHub Laboratory
              </span>
            </div>
            <Link
              href="/login?port=facility"
              className="text-xs font-bold text-[var(--lab-brand)]"
            >
              Sign in →
            </Link>
          </div>

          {/* Header */}
          <div className="mb-7">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lab-brand)]/20 bg-[var(--lab-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lab-brand)]">
                <Sparkles size={9} />
                Enterprise Registration
              </span>
              <span className="text-[10.5px] font-mono font-medium tracking-widest uppercase text-[var(--lab-ink-faint)]">
                Step {currentStep} · 04
              </span>
            </div>
            <h2 className="mt-3 font-display text-3xl font-medium text-[var(--lab-night)] tracking-tight italic">
              {currentStep === 1 && "Facility & Licensing Details"}
              {currentStep === 2 && "Location & Operating Hours"}
              {currentStep === 3 && "Portal Administrator Account"}
              {currentStep === 4 && "Settlement & Banking"}
            </h2>
            <p className="mt-2 text-[13px] text-[var(--lab-ink-soft)] leading-relaxed">
              {currentStep === 1 &&
                "Enter the registered legal name and official licenses for your laboratory."}
              {currentStep === 2 &&
                "Configure your diagnostic center's physical address for specimen drop-offs and patient booking."}
              {currentStep === 3 &&
                "Create the master clinical administrator account for this laboratory instance."}
              {currentStep === 4 &&
                "Provide the corporate bank account details for direct diagnostic service payouts."}
            </p>
          </div>

          {/* Vertical stepper */}
          <div className="mb-7 space-y-2">
            {STEPS.map((s) => {
              const state =
                s.id < currentStep ? "done" : s.id === currentStep ? "current" : "todo";
              return (
                <button
                  key={s.id}
                  type="button"
                  data-state={state}
                  className="lab-stepper-item"
                  onClick={() => {
                    if (s.id < currentStep) setCurrentStep(s.id);
                    else if (s.id === currentStep + 1 && validateStep(currentStep))
                      setCurrentStep(s.id);
                  }}
                >
                  <span className="lab-stepper-bullet">
                    {state === "done" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : state === "current" ? (
                      <CircleDot size={14} />
                    ) : (
                      <CircleDashed size={14} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="lab-stepper-title">{s.title}</div>
                    <div className="lab-stepper-sub">{s.desc}</div>
                  </div>
                  {state === "current" && (
                    <span className="ml-auto text-[10px] tracking-widest uppercase text-[var(--lab-brand)] font-mono font-bold">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-5 h-1 rounded-full bg-[var(--lab-surface-2)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>

          {/* Form */}
          <form
            onSubmit={currentStep === 4 ? submit : handleNext}
            className="lab-card"
          >
            <div className="lab-card-head">
              <div className="lab-card-title">
                <CurrentIcon size={14} />
                Step {currentStep} of 4
              </div>
            </div>
            <div className="lab-card-pad space-y-4">
              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="lab-field">
                    <label className="lab-label">
                      Official Laboratory / Center Name{" "}
                      <span className="lab-label-req">*</span>
                    </label>
                    <div className="lab-input-icon-wrap">
                      <Building2 size={15} className="lab-input-icon" />
                      <input
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. Asiri Central Laboratories"
                        className="lab-input !pl-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="lab-field">
                      <label className="lab-label">
                        Registration / License No.{" "}
                        <span className="lab-label-req">*</span>
                      </label>
                      <div className="lab-input-icon-wrap">
                        <FileCheck2 size={15} className="lab-input-icon" />
                        <input
                          required
                          value={form.licenseNumber}
                          onChange={(e) => set("licenseNumber", e.target.value)}
                          placeholder="LAB-2026-XXXX"
                          className="lab-input !pl-10 lab-mono"
                        />
                      </div>
                    </div>
                    <div className="lab-field">
                      <label className="lab-label">Accreditation</label>
                      <select
                        value={form.accreditation}
                        onChange={(e) => set("accreditation", e.target.value)}
                        className="lab-input"
                      >
                        <option value="ISO 15189">ISO 15189</option>
                        <option value="SLAB Accredited">SLAB Accredited</option>
                        <option value="CAP Accredited">CAP Accredited</option>
                        <option value="MOH Registered">MOH Registered Only</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="lab-banner lab-banner-info">
                    <div className="lab-banner-icon">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="text-[12.5px] leading-relaxed">
                      Licenses are matched against the National Private Health
                      Services Regulatory Council (PHSRC) registry. Please use
                      the exact registered entity name.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="lab-field">
                    <label className="lab-label">
                      Physical Facility Address{" "}
                      <span className="lab-label-req">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                      placeholder="Street number, building, road name, district"
                      className="lab-input"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="lab-field">
                      <label className="lab-label">
                        City / Region <span className="lab-label-req">*</span>
                      </label>
                      <select
                        value={form.city}
                        onChange={(e) => set("city", e.target.value)}
                        className="lab-input"
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
                    <div className="lab-field">
                      <label className="lab-label">
                        Desk Phone <span className="lab-label-req">*</span>
                      </label>
                      <div className="lab-input-icon-wrap">
                        <Phone size={15} className="lab-input-icon" />
                        <input
                          required
                          type="tel"
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          placeholder="011 234 5678"
                          className="lab-input !pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">
                      Operating Schedule & Specimen Drop-off
                    </label>
                    <div className="lab-input-icon-wrap">
                      <Clock size={15} className="lab-input-icon" />
                      <input
                        value={form.operatingHours}
                        onChange={(e) => set("operatingHours", e.target.value)}
                        placeholder="Mon–Sat: 07:00 – 20:00"
                        className="lab-input !pl-10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="lab-field">
                    <label className="lab-label">
                      Official Administrative Email{" "}
                      <span className="lab-label-req">*</span>
                    </label>
                    <div className="lab-input-icon-wrap">
                      <Mail size={15} className="lab-input-icon" />
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="director@diagnostics.lk"
                        className="lab-input !pl-10"
                      />
                    </div>
                    <p className="lab-help">
                      Root master login for your lab operations dashboard.
                    </p>
                  </div>

                  <div className="lab-field">
                    <label className="lab-label">
                      Account Master Password{" "}
                      <span className="lab-label-req">*</span>
                    </label>
                    <div className="lab-input-icon-wrap">
                      <Lock size={15} className="lab-input-icon" />
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        minLength={8}
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        placeholder="At least 8 characters"
                        className="lab-input !pl-10 !pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--lab-ink-faint)] hover:text-[var(--lab-night)] p-1"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="lab-banner lab-banner-info">
                    <div className="lab-banner-icon">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="text-[12.5px] leading-relaxed">
                      Passwords are encrypted with Argon2id. Hardware-backed MFA
                      is enforced once verified by the MOH compliance module.
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="lab-field">
                    <label className="lab-label">Settlement Bank</label>
                    <select
                      value={form.bankName}
                      onChange={(e) => set("bankName", e.target.value)}
                      className="lab-input"
                    >
                      <option value="Commercial Bank of Ceylon">
                        Commercial Bank of Ceylon
                      </option>
                      <option value="Bank of Ceylon (BOC)">Bank of Ceylon</option>
                      <option value="Hatton National Bank (HNB)">HNB</option>
                      <option value="Sampath Bank">Sampath Bank</option>
                      <option value="Nations Trust Bank (NTB)">NTB</option>
                      <option value="Seylan Bank">Seylan Bank</option>
                      <option value="Standard Chartered">Standard Chartered</option>
                      <option value="Other">Other Bank</option>
                    </select>
                  </div>
                  <div className="lab-field">
                    <label className="lab-label">
                      Account Number (Corporate Payouts)
                    </label>
                    <div className="lab-input-icon-wrap">
                      <CreditCard size={15} className="lab-input-icon" />
                      <input
                        value={form.bankAccount}
                        onChange={(e) => set("bankAccount", e.target.value)}
                        placeholder="e.g. 100029384812"
                        className="lab-input !pl-10 lab-mono"
                      />
                    </div>
                  </div>

                  <div className="lab-card !shadow-none !border-dashed">
                    <div className="lab-card-pad space-y-2">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--lab-ink-faint)]">
                          Facility
                        </span>
                        <span className="font-bold text-[var(--lab-night)]">
                          {form.name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--lab-ink-faint)]">
                          License
                        </span>
                        <span className="font-mono font-medium text-[var(--lab-night)]">
                          {form.licenseNumber || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--lab-ink-faint)]">
                          Admin Email
                        </span>
                        <span className="font-medium text-[var(--lab-night)]">
                          {form.email || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--lab-ink-faint)]">
                          Accreditation
                        </span>
                        <span className="lab-pill" data-status="active">
                          {form.accreditation}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="lab-banner lab-banner-danger">
                  <div className="lab-banner-icon">
                    <AlertCircle size={14} />
                  </div>
                  <div className="text-[12.5px]">{error}</div>
                </div>
              )}
            </div>

            <div className="lab-card-foot flex items-center justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="lab-btn lab-btn-secondary"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              ) : (
                <Link
                  href="/login?port=facility"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lab-ink-soft)] hover:text-[var(--lab-night)] transition-colors"
                >
                  <ArrowLeft size={13} />
                  Cancel to Sign In
                </Link>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => handleNext()}
                  className="lab-btn lab-btn-primary"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="lab-btn lab-btn-primary"
                >
                  {submitting ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Complete Facility Registration
                      <CheckCircle2 size={15} />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Trust footer */}
          <div className="mt-8 pt-5 border-t border-[var(--lab-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[var(--lab-ink-faint)]">
            <span>Already an enrolled diagnostic partner?</span>
            <Link
              href="/login?port=facility"
              className="font-bold text-[var(--lab-brand)] hover:text-emerald-700"
            >
              Sign into Facility Console →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProtocolStep({
  done,
  active,
  todo,
  step,
  title,
  sub,
}: {
  done?: boolean;
  active?: boolean;
  todo?: boolean;
  step?: number;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
          done
            ? "bg-emerald-600 text-white"
            : active
            ? "bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] border border-[var(--lab-brand)]/30"
            : "bg-white border border-[var(--lab-border)] text-[var(--lab-ink-faint)]"
        }`}
      >
        {done ? (
          <Check size={12} strokeWidth={3} />
        ) : active ? (
          <span className="h-2 w-2 rounded-full bg-[var(--lab-brand)] animate-pulse" />
        ) : (
          <span className="text-[10px] font-bold">{step}</span>
        )}
      </div>
      <div className={todo ? "opacity-60" : ""}>
        <p className="text-[13px] font-bold text-[var(--lab-night)]">{title}</p>
        <p className="text-[11.5px] text-[var(--lab-ink-soft)] leading-snug mt-0.5">
          {sub}
        </p>
      </div>
    </div>
  );
}

function HeroBadge({
  icon: Icon,
  tint,
  title,
  sub,
}: {
  icon: typeof Zap;
  tint: "emerald" | "sky" | "purple";
  title: string;
  sub: string;
}) {
  const tintMap = {
    emerald: "bg-emerald-500/20 text-emerald-300",
    sky: "bg-sky-500/20 text-sky-300",
    purple: "bg-purple-500/20 text-purple-300",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-md">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${tintMap[tint]}`}
      >
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        <p className="text-[11px] text-slate-400 leading-snug">{sub}</p>
      </div>
    </div>
  );
}
