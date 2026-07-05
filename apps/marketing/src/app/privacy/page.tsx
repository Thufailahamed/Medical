import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function PrivacyPage() {
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
          <h1 className="h1" style={{ marginTop: "14px" }}>Privacy, in plain English.</h1>
          <p className="lede" style={{ marginTop: "18px" }}>
            We wrote this in a way a human can read. If anything is unclear,
            email <a href="mailto:hello@healthhub.app">hello@healthhub.app</a>{" "}
            and we'll rewrite the part you didn't follow.
          </p>

          <h2>What we collect</h2>
          <p>Three buckets. That's it.</p>
          <ul>
            <li><strong>What you give us.</strong> Your name, phone, the records
            you upload, the medicines you track, and the people you invite to
            your family circle.</li>
            <li><strong>What the app does automatically.</strong> Reminder
            confirmations, doses you log, vitals you enter, anonymised crash
            logs. We never collect your precise location.</li>
            <li><strong>What the website collects.</strong> If you sign up for
            the waitlist, your email and the role you picked. That's all.</li>
          </ul>

          <h2>What we do with it</h2>
          <ul>
            <li>Show your records back to you, in the app, on the device you use.</li>
            <li>Share with the doctors and family members you explicitly invite.</li>
            <li>Run the AI features on your data — the AI only sees your data,
            and only when you ask it a question.</li>
            <li>Send you the reminders you signed up for.</li>
          </ul>
          <p>We do <strong>not</strong> sell your data. We do <strong>not</strong>
          advertise to you. We do <strong>not</strong> use your medical records
          to train AI models without your explicit, separate opt-in.</p>

          <h2>Where it lives</h2>
          <p>Records are stored encrypted in Cloudflare's data centres (D1 +
          R2). Backups are encrypted with keys we do not hold. We are
          <strong>not</strong> a US HIPAA-covered entity, but we voluntarily
          follow HIPAA's technical safeguards.</p>

          <h2>How long</h2>
          <p>Your account data lives as long as your account is open. Delete
          your account, and we delete your records within 30 days (90 days for
          backup retention, per Cloudflare's standard). The marketing
          waitlist is wiped the moment we send your invite.</p>

          <h2>Your rights</h2>
          <ul>
            <li><strong>Export.</strong> Profile → Export. PDF or JSON.</li>
            <li><strong>Correct.</strong> Edit any record, anytime.</li>
            <li><strong>Delete.</strong> Profile → Delete account. We confirm
            via SMS, then it's done in 30 days.</li>
            <li><strong>Withdraw consent.</strong> Toggle off AI features,
            family sharing, doctor sharing — each in isolation.</li>
          </ul>

          <h2>Children</h2>
          <p>MedLocker is for adults (18+). Parents can create child profiles
          under their account; the parent is the data controller for that
          profile.</p>

          <h2>Contact</h2>
          <p>Healthhub (Pvt) Ltd · No. 12, Glen Aber Place, Colombo 3 ·{" "}
          <a href="mailto:hello@healthhub.app">hello@healthhub.app</a></p>

          <p className="updated" style={{ marginTop: "48px" }}>v1.0 · 4 JULY 2025</p>
        </div>
      </main>
    </>
  );
}
