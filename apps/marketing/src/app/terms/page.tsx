import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .legal { padding: calc(var(--header-h) + 64px) 0 96px; }
        .legal h2 { margin-top: 40px; margin-bottom: 12px; }
        .legal h3 { margin-top: 24px; margin-bottom: 8px; font-size: 17px; }
        .legal p, .legal li { color: var(--text-muted); font-size: 15.5px; line-height: 1.65; }
        .legal ul { padding-left: 1.4em; list-style: disc; margin: 10px 0 16px; }
        .legal ul li { margin-bottom: 6px; }
        .legal a { color: var(--c-sky-700); text-decoration: underline; text-underline-offset: 3px; }
        .legal .updated { color: var(--text-soft); font-family: var(--font-mono); font-size: 12.5px; letter-spacing: 0.08em; }
      `}} />

      <nav className="nav">
        <div className="container nav__inner">
          <Link href="/" className="nav__brand">
            <img className="logo" src="/assets/logo.svg" alt="" width="32" height="32" />
            <span>MedLocker</span>
          </Link>
          <div className="nav__cta">
            <Link className="btn btn--ghost" href="/#faq">← Back to home</Link>
          </div>
        </div>
      </nav>

      <main className="legal">
        <div className="container container--narrow">
          <span className="updated">LAST UPDATED · 4 JULY 2025</span>
          <h1 className="h1" style={{ marginTop: "14px" }}>Terms of use.</h1>
          <p className="lede" style={{ marginTop: "18px" }}>
            The short version: use MedLocker for its intended purpose, don't
            abuse the service, and we'll do the same. Full version below.
          </p>

          <h2>1. The service</h2>
          <p>MedLocker is a personal health-record app. It is provided by
          Healthhub (Pvt) Ltd, a company registered in Sri Lanka. The mobile
          apps are distributed via the Apple App Store and Google Play; this
          marketing website is informational only.</p>

          <h2>2. Not a substitute for medical advice</h2>
          <p>MedLocker is a record-keeping and reminder tool. The AI features
          are <strong>not</strong> a substitute for professional medical
          advice, diagnosis, or treatment. In an emergency, call 110
          (Sri Lanka) or your local emergency number.</p>

          <h2>3. Eligibility</h2>
          <p>You must be 18+ to create an account. Parents and guardians can
          create profiles for minors under their supervision.</p>

          <h2>4. Acceptable use</h2>
          <ul>
            <li>No uploading records that aren't yours (or that you don't
            have legal authority to manage).</li>
            <li>No reverse engineering, scraping, or automated access.</li>
            <li>No using MedLocker to harass, impersonate, or harm another person.</li>
            <li>No reselling or rebranding the service.</li>
          </ul>

          <h2>5. Doctors and hospitals</h2>
          <p>If you use the doctor or hospital portals, additional terms
          apply — those are presented at sign-up. Clinical use of MedLocker
          does not create a doctor–patient relationship between you and
          Healthhub (Pvt) Ltd.</p>

          <h2>6. Service availability</h2>
          <p>We aim for 99.5% uptime but cannot guarantee uninterrupted
          access. The service may be unavailable during maintenance, which we
          will announce in advance when possible.</p>

          <h2>7. Changes</h2>
          <p>We may update these terms. If we do, we'll email you and put a
          banner in the app. Continued use after 30 days = acceptance.</p>

          <h2>8. Liability</h2>
          <p>To the maximum extent permitted by law, our liability is limited
          to the amount you've paid us in the last 12 months. The patient
          app is currently free, so this is — for now — LKR 0.</p>

          <h2>9. Governing law</h2>
          <p>These terms are governed by the laws of Sri Lanka. Disputes are
          subject to the exclusive jurisdiction of the courts of Colombo.</p>

          <h2>10. Contact</h2>
          <p>Healthhub (Pvt) Ltd · No. 12, Glen Aber Place, Colombo 3 ·{" "}
          <a href="mailto:hello@healthhub.app">hello@healthhub.app</a></p>

          <p className="updated" style={{ marginTop: "48px" }}>v1.0 · 4 JULY 2025</p>
        </div>
      </main>
    </>
  );
}
