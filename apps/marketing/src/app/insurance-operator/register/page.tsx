"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  BadgeCheck,
  Check,
  FileText,
} from "lucide-react";

import { api } from "../lib/api";

import "@/app/_shared/auth-harbor.css";

export default function InsuranceOperatorRegisterPage() {
  const [orgName, setOrgName] = useState("");
  const [license, setLicense] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const orgInitials =
    orgName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orgName.trim() || !license.trim()) {
      setError("Organisation name and license are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ orgId: string; status: string }>(
        "/insurance-operator/register",
        {
          method: "POST",
          body: {
            orgName: orgName.trim(),
            license: license.trim(),
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
          },
        },
      );
      setOrgId(res.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
              <img src="/assets/insurance/hero.jpg" alt="" loading="lazy" />
            </div>
          </div>
        </div>

        <Link href="/" className="hl-brand" aria-label="HealthHub home">
          <span className="hl-brand__icon-wrap">
            <Heart size={17} color="#fff" fill="#fff" aria-hidden />
          </span>
          <span>
            <span className="hl-brand__name">HealthHub</span>
            <span className="hl-brand__badge">Partners</span>
          </span>
        </Link>

        <div className="hl-hero__body" key={orgId ? "done" : "form"}>
          <div className="hl-kicker">
            <span className="hl-kicker__dot" />
            {orgId ? "Application received" : "Insurance & EMS"}
          </div>
          <h2 className="hl-headline">
            {orgId ? (
              <>
                Onboarding
                <span className="hl-headline-accent">under review.</span>
              </>
            ) : (
              <>
                Claims and dispatch,
                <span className="hl-headline-accent">
                  in the same breath.
                </span>
              </>
            )}
          </h2>
          <p className="hl-lede">
            {orgId
              ? "Our team verifies every insurer license before activating publishing access. You will hear from us shortly."
              : "Policy checks, settlement and fleet tracking across the island — live, auditable, unhurried."}
          </p>
          <div className="hl-langs">
            <b>English</b>
            <i />
            <b>සිංහල</b>
            <i />
            <b>தமிழ்</b>
          </div>
        </div>

        <figure className="hl-card-preview" key={`card-${orgId}`}>
          <div className="hl-card-preview__top">
            <div className="hl-card-preview__brand">
              <ShieldCheck size={13} aria-hidden />
              <span>HealthHub · Insurer profile</span>
            </div>
            <span className="hl-card-preview__chip">
              {orgId ? "In review" : "IRCSL · Regulated"}
            </span>
          </div>
          <div className="hl-card-preview__content">
            <div className="hl-card-row">
              <div className="hl-card-meta">
                <div className="hl-card-avatar">
                  {orgInitials || <Building2 size={16} aria-hidden />}
                </div>
                <div>
                  <div className="hl-card-title">
                    {orgName.trim() || "Your organisation"}
                  </div>
                  <div className="hl-card-subtitle">
                    Insurer
                    {license.trim() ? ` · ${license.trim()}` : ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="hl-card-badges">
              <span className="hl-card-tag">
                <span className="hl-live" aria-hidden />
                {orgId ? "Queued for verification" : "Verified before publishing"}
              </span>
              <span className="hl-card-tag">
                <BadgeCheck size={11} aria-hidden />
                Claims & plans access
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
              IRCSL licensed
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
          {orgId ? (
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
                  Your insurer onboarding is pending review. Reference:{" "}
                  <span className="font-mono">{orgId}</span>. Our team will
                  verify your license and activate publishing access.
                </p>
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
                      {orgName.trim() || "Organisation"}
                      {license.trim() ? ` · ${license.trim()}` : ""} registered
                      in the intake queue
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-active">
                  <span className="hl-protocol__icon">2</span>
                  <div>
                    <div className="hl-protocol__title">License verification</div>
                    <div className="hl-protocol__sub">
                      Regulator license checked against the IRCSL registry
                    </div>
                  </div>
                </div>
                <div className="hl-protocol__step is-todo">
                  <span className="hl-protocol__icon">3</span>
                  <div>
                    <div className="hl-protocol__title">Publishing access</div>
                    <div className="hl-protocol__sub">
                      Plan publishing and claims tools unlock once an
                      administrator approves the organisation
                    </div>
                  </div>
                </div>
              </div>

              <Link href="/login?port=operator" className="hl-btn-primary">
                <span>Back to operator login</span>
                <span className="hl-btn-primary__glyph">
                  <ArrowRight size={16} aria-hidden />
                </span>
              </Link>
            </div>
          ) : (
            <>
              <header className="hl-header">
                <div className="hl-eyebrow">Partner desk</div>
                <h2>
                  Register as <em>insurance provider</em>
                </h2>
                <p>
                  Submit your company for onboarding. Plans stay as drafts until
                  an admin publishes them.
                </p>
              </header>

              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="hl-field">
                  <label htmlFor="orgName" className="hl-label">
                    Organisation name
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <Building2 size={15} aria-hidden />
                    </span>
                    <input
                      id="orgName"
                      type="text"
                      autoComplete="organization"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Ceylon Health Insurance"
                      required
                      className="hl-input"
                    />
                  </div>
                </div>

                <div className="hl-field">
                  <label htmlFor="license" className="hl-label">
                    Regulator license
                  </label>
                  <div className="hl-input-wrap">
                    <span className="hl-input-icon">
                      <FileText size={15} aria-hidden />
                    </span>
                    <input
                      id="license"
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="IRCSL/LIC/12345"
                      required
                      className="hl-input"
                    />
                  </div>
                </div>

                <div className="hl-field-row">
                  <div className="hl-field">
                    <label htmlFor="contactEmail" className="hl-label">
                      Contact email
                    </label>
                    <div className="hl-input-wrap">
                      <span className="hl-input-icon">
                        <Mail size={15} aria-hidden />
                      </span>
                      <input
                        id="contactEmail"
                        type="email"
                        autoComplete="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="ops@insurer.lk"
                        className="hl-input"
                      />
                    </div>
                  </div>
                  <div className="hl-field">
                    <label htmlFor="contactPhone" className="hl-label">
                      Contact phone
                    </label>
                    <div className="hl-input-wrap">
                      <span className="hl-input-icon">
                        <Phone size={15} aria-hidden />
                      </span>
                      <input
                        id="contactPhone"
                        type="tel"
                        autoComplete="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="0771234567"
                        className="hl-input"
                      />
                    </div>
                  </div>
                </div>

                {error ? (
                  <div role="alert" className="hl-error">
                    {error}
                  </div>
                ) : null}

                <button type="submit" disabled={busy} className="hl-btn-primary">
                  <span>{busy ? "Submitting…" : "Submit for review"}</span>
                  <span className="hl-btn-primary__glyph">
                    <ArrowRight size={16} aria-hidden />
                  </span>
                </button>
              </form>
            </>
          )}

          <div className="hl-foot mt-6">
            <span>
              Already onboarded?{" "}
              <Link href="/login?port=operator">Sign in</Link>
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
