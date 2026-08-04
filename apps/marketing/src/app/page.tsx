"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

// ─── Inline SVG icons ───────────────────────────────────────────────────────
const I = {
  arrow: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  plus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  shield: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />
    </svg>
  ),
  globe: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  phone: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  ),
  pill: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  ),
  clipboard: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  ),
  spark: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.9 4.7L18.6 10l-4.7 2.3L12 17l-1.9-4.7L5.4 10l4.7-2.3z" />
    </svg>
  ),
  heart: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  bell: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  chev: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  doc: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  flask: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3" />
    </svg>
  ),
  message: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  trend: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  scan: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  ),
  star: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  book: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  play: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
};

// ─── Data ──────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Product", href: "#pillars" },
  { label: "Tour", href: "#tour" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

const PILLARS = [
  {
    tag: "01 / Records",
    num: "01",
    icon: <I.clipboard />,
    title: "Every record, in one timeline.",
    copy: "Lab reports, prescriptions, discharge summaries, vaccination cards — uploaded, OCR'd, and tagged. Search by date, doctor, or condition.",
    bullets: ["AI lab value explainer", "Timeline & instant search", "1-tap share with doctor"],
    stat: { value: 47, suffix: "k", label: "lab reports tagged last month" },
    accent: "sky" as const,
    href: "#records",
    preview: {
      type: "record",
      title: "HbA1c & Fasting Glucose Report",
      meta: "Asiri Health · 2 Aug 2026",
      chip: "✓ OCR Verified · 6.1% Normal",
      tag: "Lab Test",
    },
  },
  {
    tag: "02 / Medicines",
    num: "02",
    icon: <I.pill />,
    title: "Reminders that feel human.",
    copy: "Friendly nudges that adapt to your daily routine. Drug-interaction checks, refill alerts, and a quiet log of every dose you've taken.",
    bullets: ["Adaptive routine nudges", "Refill & stock tracking", "Drug interaction safety"],
    stat: { value: 99.4, decimals: 1, suffix: "%", label: "on-time dose rate" },
    accent: "coral" as const,
    href: "#medicines",
    preview: {
      type: "medicine",
      title: "Paracetamol 500mg",
      meta: "1 Tablet · After Food (8:00 PM)",
      chip: "✓ Scheduled for Tonight",
      tag: "Daily Dose",
    },
  },
  {
    tag: "03 / Health AI",
    num: "03",
    icon: <I.spark />,
    title: "A second pair of eyes.",
    copy: "Ask anything in plain language. Get a summary, a trend, or a clear explanation of your lab values — grounded in your real data.",
    bullets: ["Plain-language Q&A", "Multi-year trend analysis", "100% Grounded in your records"],
    stat: { value: 8, suffix: "s", label: "average response time" },
    accent: "violet" as const,
    href: "#ai",
    preview: {
      type: "ai",
      title: '💬 "How are my blood sugar levels?"',
      meta: '✨ "Your HbA1c improved from 6.4% to 6.1% over 3 months."',
      chip: "AI Insight · 100% Grounded",
      tag: "Health AI",
    },
  },
];

const HOW_STEPS = [
  {
    n: "I",
    title: "Tell us about you",
    body: "Add a profile in 30 seconds — your age, conditions, allergies, and the people you care for. We never ask for what we don't need.",
  },
  {
    n: "II",
    title: "Bring your records in",
    body: "Snap a photo, forward an email, or link a lab. The OCR does the tagging, the AI explains the values, the timeline just makes sense.",
  },
  {
    n: "III",
    title: "Live with it for a day",
    body: "Reminders match your routine. The AI starts to know what's worth flagging. By day three, you stop managing it and start relying on it.",
  },
];

const TIMELINE = [
  {
    day: "Day 1",
    role: "Stranger",
    marker: "00",
    theme: "neutral" as const,
    changeIcon: <I.clipboard />,
    changeTitle: "You onboard",
    changeBody: <>Profile, family, last prescription — <em>in 3 minutes.</em></>,
    quote: "Hi — I just met you.",
    body: "Set up your profile, snap a photo of your last prescription, and add your family. We'll quietly learn the rest.",
  },
  {
    day: "Day 2",
    role: "Acquaintance",
    marker: "01",
    theme: "sky" as const,
    changeIcon: <I.spark />,
    changeTitle: "Patterns emerge",
    changeBody: <>Routines form, records sort, AI starts <em>noticing.</em></>,
    quote: "I'm noticing patterns.",
    body: "Medicines are sorted into your routine, your records are tagged, and the AI starts to learn what matters to you.",
  },
  {
    day: "Day 3",
    role: "Colleague",
    marker: "02",
    theme: "emerald" as const,
    changeIcon: <I.heart />,
    changeTitle: "You rely on it",
    changeBody: <>Reminders match your day, summary ready, <em>trend clear.</em></>,
    quote: "Here's what I did for you.",
    body: "Reminders that match your day, a generated health summary, and a clear trend you can show your doctor at the next visit.",
  },
];

const JOBS = [
  {
    key: "meds",
    num: "01",
    shortLabel: "Meds",
    label: "Remembers your medicines",
    plainTitle: "You never miss a dose.",
    tag: "Jobs we do for you",
    title: <>You <strong>never miss a dose.</strong></>,
    desc: "Reminders that match your routine — breakfast, lunch, dinner, bedtime. Refill alerts before you run out. A quiet, change-based log your doctor can actually read.",
    icon: <I.pill />,
    accent: "sky" as const,
    window: {
      title: "Today's medicines",
      greeting: "Good evening, Thufail. Here's what's on for today:",
      sections: [
        { num: "3 doses", sub: "still ahead tonight", meta: "8:00 PM · 10:00 PM · 10:30 PM", pill: { text: "ON TRACK", cls: "kept" } },
        { num: "1 refill", sub: "Metformin 500mg · 14 days left", meta: "", pill: { text: "REMIND ME", cls: "drafted" } },
        { num: "0 missed", sub: "this week — best streak in 3 months", meta: "", pill: { text: "+12", cls: "normal" } },
      ],
    },
  },
  {
    key: "explain",
    num: "02",
    shortLabel: "Explain",
    label: "Explains your labs",
    plainTitle: "You actually understand your results.",
    tag: "Jobs we do for you",
    title: <>You <strong>actually understand</strong> your results.</>,
    desc: "Every lab value, explained in plain language. Out-of-range values flagged. Trends shown over time, not as one-off numbers.",
    icon: <I.flask />,
    accent: "amber" as const,
    window: {
      title: "Lab explainer · HbA1c",
      greeting: "Your HbA1c came back at 6.8%. Here's what that means:",
      sections: [
        { num: "6.1 → 6.4 → 6.8", sub: "trending up over 3 readings", meta: "", pill: { text: "ATTENTION", cls: "pending" } },
        { num: "Prediabetic", sub: "still reversible with lifestyle changes", meta: "", pill: { text: "INFO", cls: "normal" } },
        { num: "Repeat in 3 mo", sub: "ask your GP about metformin", meta: "", pill: { text: "ACTION", cls: "high" } },
      ],
    },
  },
  {
    key: "share",
    num: "03",
    shortLabel: "Share",
    label: "Shares with your doctor",
    plainTitle: "You stop explaining your history.",
    tag: "Jobs we do for you",
    title: <>You <strong>stop explaining</strong> your history.</>,
    desc: "One-tap share to your doctor, with a clean summary, full timeline, and a structured intake. They arrive prepared. You arrive heard.",
    icon: <I.doc />,
    accent: "green" as const,
    window: {
      title: "Share with Dr. Saman K.",
      greeting: "Here's what I've put together for your visit tomorrow:",
      sections: [
        { num: "47 records", sub: "last 18 months · 3 hospitals", meta: "", pill: { text: "INCLUDED", cls: "kept" } },
        { num: "12 medicines", sub: "active · 2 with notes", meta: "", pill: { text: "INCLUDED", cls: "kept" } },
        { num: "AI summary", sub: "generated · 2-minute read", meta: "", pill: { text: "READY", cls: "normal" } },
      ],
    },
  },
  {
    key: "care",
    num: "04",
    shortLabel: "Care",
    label: "Looks after your family",
    plainTitle: "You keep them in the loop — gently.",
    tag: "Jobs we do for you",
    title: <>You <strong>keep them in the loop</strong> — gently.</>,
    desc: "Quiet alerts only when something actually changes. Multi-profile support. The people you love, looked after — without the nagging.",
    icon: <I.heart />,
    accent: "rose" as const,
    window: {
      title: "Family overview",
      greeting: "Here's how everyone did today:",
      sections: [
        { num: "Mum", sub: "1 alert · missed 8 PM dose", meta: "", pill: { text: "RESOLVED", cls: "pending" } },
        { num: "Dad", sub: "BP 142/88 · high", meta: "", pill: { text: "WATCH", cls: "high" } },
        { num: "Kids", sub: "Vitamin D taken", meta: "", pill: { text: "ALL GOOD", cls: "kept" } },
      ],
    },
  },
];

const USE_CASES = [
  {
    key: "patients",
    label: "For you",
    sub: "Patients & families",
    role: <>Your health, <em>finally in order.</em></>,
    body: "A calm timeline for every prescription, lab, and visit. AI that explains your values in plain language. Share with the people you trust — without losing control.",
    icon: <I.heart />,
    tone: "primary" as const,
    cta: "See patient features",
    ctaHref: "#tour",
    bullets: [
      "One timeline for everything",
      "Plain-language lab explainer",
      "Family sharing — read-only",
      "Multi-language: EN · සිං · த",
    ],
    visual: "phone-timeline",
  },
  {
    key: "caregivers",
    label: "For caregivers",
    sub: "Parents, kids, elders",
    role: <>Look after them, <em>without nagging.</em></>,
    body: "Quiet alerts that only fire when something actually changes — a missed dose, a new allergy, a result out of range. Multi-profile support with the same calm UI.",
    icon: <I.bell />,
    tone: "warning" as const,
    cta: "See family features",
    ctaHref: "#tour",
    bullets: [
      "Quiet, change-based alerts",
      "Multi-profile support",
      "Doctor-ready share links",
      "Read-only access controls",
    ],
    visual: "phone-caregiver",
  },
  {
    key: "doctors",
    label: "For clinicians",
    sub: "GPs, specialists, hospitals",
    role: <>Patients arrive <em>ready to talk.</em></>,
    body: "Clean, structured intake before the visit. Trends, adherence, and allergies at a glance. Time-stamped, verifiable, exportable. Spend the visit on the conversation — not the clipboard.",
    icon: <I.doc />,
    tone: "info" as const,
    cta: "See clinical features",
    ctaHref: "#tour",
    bullets: [
      "Structured intake summary",
      "Trend & adherence at a glance",
      "Time-stamped, verifiable",
      "Export to PDF / FHIR",
    ],
    visual: "stack-doctor",
  },
  {
    key: "labs",
    label: "For labs & hospitals",
    sub: "Diagnostic partners",
    role: <>Push results <em>in seconds.</em></>,
    body: "Eliminate the WhatsApp photo, the lost email, the missing printout. Direct push to a patient's record, with a full audit trail. Built for the way Sri Lanka actually works.",
    icon: <I.flask />,
    tone: "success" as const,
    cta: "See partner API",
    ctaHref: "#cta",
    bullets: [
      "Direct push to patient",
      "API & partner endpoints",
      "Audit log included",
      "Branded patient portal",
    ],
    visual: "stack-lab",
  },
];

const STATS = [
  { kicker: ["vh-pulse", "In private beta"], num: "1,247", suffix: "", lbl: "Sri Lankans on the waitlist" },
  { kicker: [null, "TestFlight rating"], num: "4.9", suffix: "★", lbl: "across 312 reviews" },
  { kicker: [null, "Onboarding"], num: "<3", suffix: " min", lbl: "from install to first record" },
  { kicker: [null, "Languages"], num: "3", suffix: "", lbl: "EN · සිං · த — written by humans" },
];

const LOGOS = [
  { name: "Daily Mirror", mark: "DM" },
  { name: "Ada Derana", mark: "AD" },
  { name: "Roar", mark: "R" },
  { name: "TechGrit", mark: "TG" },
  { name: "Lanka Business", mark: "LB" },
  { name: "Sunday Times", mark: "ST" },
];

const TESTIMONIALS = [
  {
    quote: "I haven't lost a single prescription since I started using it. My mum's reminders just… work.",
    name: "Ruwanthi P.",
    role: "Patient · Colombo",
    initials: "RP",
  },
  {
    quote: "My patients show up with a clean summary. I can spend the visit on the actual medicine.",
    name: "Dr. Saman K.",
    role: "GP · Kandy",
    initials: "SK",
  },
  {
    quote: "We push results to a patient's record in seconds. The WhatsApp era is finally over.",
    name: "Asiri L.",
    role: "Lab operations · Galle",
    initials: "AL",
  },
];

const TIERS = [
  {
    name: "Free",
    price: "LKR 0",
    period: "/ forever",
    desc: "Everything you need to get your records in one place.",
    features: [
      "Up to 2 profiles",
      "Unlimited records & medicines",
      "14-day free medicine reminders",
      "AI summaries · 10 / month",
      "iOS, Android & web",
    ],
    cta: "Get started",
    href: "/account/signup",
    featured: false,
  },
  {
    name: "Plus",
    price: "LKR 1,500",
    period: "/ year",
    desc: "For families who look after each other.",
    features: [
      "Unlimited profiles",
      "Caregiver & family sharing",
      "Unlimited medicine reminders",
      "Unlimited AI summaries",
      "Doctor-ready share links",
      "Priority support",
    ],
    cta: "Start Plus",
    href: "/account/signup?plan=plus",
    featured: true,
  },
  {
    name: "Clinic",
    price: "Custom",
    period: "",
    desc: "For practices and labs that need direct integrations.",
    features: [
      "Everything in Plus",
      "Direct result push (API)",
      "Bulk seat management",
      "Audit log & SSO",
      "Dedicated success manager",
    ],
    cta: "Talk to us",
    href: "mailto:hello@healthhub.app",
    featured: false,
  },
];

const FAQS = [
  {
    q: "Is my data really private?",
    a: "Yes. Your records live encrypted at rest, are scoped per-user, and never sold or used to train AI models. You can export or delete everything at any time from settings.",
  },
  {
    q: "Do I need a Sri Lankan phone number?",
    a: "No. HealthHub works anywhere in the world. We started in Sri Lanka because that's where we saw the problem first — but the app, the reminders, and the AI work the same way for anyone.",
  },
  {
    q: "How accurate is the lab explainer?",
    a: "The explainer is grounded in your real values and a verified medical reference. It's not a doctor — every answer ends with a clear reminder to confirm important findings with your clinician.",
  },
  {
    q: "Can my family see my records?",
    a: "Only if you invite them. Sharing is opt-in, time-bound, and you decide exactly which records each person can see. You can revoke access at any time.",
  },
  {
    q: "Do you support Sinhala and Tamil?",
    a: "Yes — written by humans, not translated. The full app, reminders, and AI summaries are available in English, සිංහල, and தமிழ். Mandarin and Bahasa are next.",
  },
  {
    q: "What if my doctor doesn't use it?",
    a: "That's fine. You can generate a clean, structured summary or a one-time share link and send it however works for them — WhatsApp, email, even print.",
  },
];

const TICKER_ITEMS = [
  { icon: <I.heart />, label: "Records" },
  { icon: <I.pill />, label: "Medicines" },
  { icon: <I.flask />, label: "Lab explainer" },
  { icon: <I.spark />, label: "AI summaries" },
  { icon: <I.bell />, label: "Reminders" },
  { icon: <I.doc />, label: "Prescriptions" },
  { icon: <I.message />, label: "Health Q&A" },
  { icon: <I.trend />, label: "Vitals & trends" },
  { icon: <I.scan />, label: "Prescription OCR" },
  { icon: <I.book />, label: "Health ID" },
  { icon: <I.shield />, label: "End-to-end encrypted" },
  { icon: <I.globe />, label: "EN · සිං · த" },
];

// ─── Hooks ──────────────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(
      ".vh-reveal, .vh-stagger, .vh-words, .vh-timeline, .vh-phone-parallax"
    );
    if (!("IntersectionObserver" in window) || !els.length) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useCountUp() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-count]");
    if (!els.length) return;

    const animate = (el: HTMLElement) => {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      const target = parseFloat(el.dataset.count || "0");
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const duration = parseInt(el.dataset.dur || "1600", 10);
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const v = target * ease(t);
        el.textContent = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      els.forEach(animate);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animate(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useMagnetic() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    const els = document.querySelectorAll<HTMLElement>(".vh-magnetic");
    const handlers: Array<{ el: HTMLElement; enter: () => void; leave: () => void; move: (e: PointerEvent) => void }> = [];
    els.forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic || "0.25");
      const onEnter = () => (el.style.transition = "transform 120ms ease-out");
      const onLeave = () => {
        el.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      };
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointermove", onMove);
      handlers.push({ el, enter: onEnter, leave: onLeave, move: onMove });
    });
    return () => {
      handlers.forEach(({ el, enter, leave, move }) => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
        el.removeEventListener("pointermove", move);
      });
    };
  }, []);
}

function useParallax() {
  useEffect(() => {
    let raf = 0;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".vh-phone-parallax"));
    if (!els.length) return;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const center = r.top + r.height / 2;
          const delta = (center - vh / 2) / vh; // -0.5..0.5
          const y = -delta * parseFloat(el.dataset.parallax || "30");
          el.style.setProperty("--parallax-y", `${y}px`);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
}

function useTilt() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    const els = document.querySelectorAll<HTMLElement>(".vh-tilt");
    const handlers: Array<() => void> = [];
    els.forEach((el) => {
      const max = parseFloat(el.dataset.tilt || "6");
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const ry = (px - 0.5) * 2 * max;
        const rx = (0.5 - py) * 2 * max;
        el.style.setProperty("--rx", `${rx}deg`);
        el.style.setProperty("--ry", `${ry}deg`);
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      };
      const onLeave = () => {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      handlers.push(() => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      });
    });
    return () => handlers.forEach((h) => h());
  }, []);
}

// ─── Cursor halo (desktop only) ────────────────────────────────────────────
function useCursorHalo() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    const halo = document.querySelector<HTMLElement>(".vh-cursor-halo");
    if (!halo) return;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      halo.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });

    const hoverSel = "a, button, .vh-magnetic, .vh-pillar, .vh-step, .vh-tier, .vh-tl-card, .vh-stat";
    const onOver = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(hoverSel)) halo.classList.add("is-hover");
    };
    const onOut = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(hoverSel)) halo.classList.remove("is-hover");
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
    };
  }, []);
}

// ─── CountUp component ──────────────────────────────────────────────────────
function CountUp({
  value,
  decimals = 0,
  dur = 1600,
  suffix = "",
  prefix = "",
}: {
  value: number;
  decimals?: number;
  dur?: number;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <span className="vh-count">
      <span data-count={value} data-decimals={decimals} data-dur={dur}>
        0
      </span>
      {suffix && <small style={{ marginLeft: 2 }}>{suffix}</small>}
      {prefix && <small style={{ marginLeft: 2 }}>{prefix}</small>}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [openUc, setOpenUc] = useState<string | null>(USE_CASES[0].key);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [openJob, setOpenJob] = useState(0);

  // Sticky-nav
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useReveal();
  useCountUp();
  useMagnetic();
  useParallax();
  useTilt();
  useCursorHalo();

  return (
    <div className="vh-root">
      {/* Cursor halo (desktop) */}
      <div className="vh-cursor-halo" aria-hidden="true" />

      {/* ─── Nav ─── */}
      <header className={`vh-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="vh-nav__island">
          {/* Brand */}
          <Link href="/" className="vh-nav__brand" aria-label="HealthHub home">
            <span className="vh-nav__logo">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M3 10h2.5l1.5-3.5 2.5 8 2.5-6.5L14 10h3" stroke="#FBF7EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="1.2" fill="#38BDF8" />
              </svg>
            </span>
            <span className="vh-nav__wordmark">HealthHub</span>
          </Link>

          {/* Center links */}
          <nav className="vh-nav__center" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="vh-nav__link">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="vh-nav__actions">
            <a href="/login" className="vh-nav__signin">Log in</a>
            <a href="#cta" className="vh-nav__cta-btn vh-magnetic" data-magnetic="0.15">
              <span>Get early access</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="vh-nav__cta-arrow"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="vh-hero">
        <div className="vh-hero__bg" aria-hidden="true">
          <svg className="vh-hero__topo" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
            <g stroke="#1A1A1A" strokeWidth="0.7" fill="none" opacity="0.16">
              <path d="M-50 200 Q 200 100 400 200 T 800 240 T 1450 290" />
              <path d="M-50 260 Q 200 160 400 260 T 800 300 T 1450 350" />
              <path d="M-50 320 Q 200 220 400 320 T 800 360 T 1450 410" />
              <path d="M-50 380 Q 200 280 400 380 T 800 420 T 1450 470" />
              <path d="M-50 440 Q 200 340 400 440 T 800 480 T 1450 530" />
              <path d="M-50 500 Q 200 400 400 500 T 800 540 T 1450 590" />
              <path d="M-50 560 Q 200 460 400 560 T 800 600 T 1450 650" />
              <path d="M-50 620 Q 200 520 400 620 T 800 660 T 1450 710" />
            </g>
          </svg>
          <div className="vh-hero__halo vh-hero__halo--sky" />
          <div className="vh-hero__halo vh-hero__halo--warm" />
          <div className="vh-hero__grain" />
        </div>
        <div className="vh-container vh-hero__grid">
          <div className="vh-hero__copy vh-reveal">
            <div className="vh-hero__folio">
              <span className="vh-hero__folio-num">Issue&nbsp;№&nbsp;04</span>
              <span className="vh-hero__folio-sep" aria-hidden="true" />
              <span className="vh-hero__folio-text">A quiet companion for the people you love</span>
            </div>
            <div className="vh-hero-pill">
              <span className="vh-hero-pill__pulse" />
              <span className="vh-hero-pill__text">Announcing v1.0 &nbsp;—&nbsp; Now in Private Beta</span>
            </div>

            <h1 className="vh-hero__headline">
              Your health, <br />
              <em>finally in one calm place.</em>
            </h1>
            <p className="vh-hero__lede">
              A private, beautifully designed health companion that brings your medical records, daily prescriptions, lab trends, and care team into a quiet, end-to-end encrypted app.
            </p>

            {/* Single Clean Interactive Action Group */}
            <div className="vh-hero-action-group">
              <div className="vh-hero__cta">
                <a href="#cta" className="vh-hero__cta-primary vh-magnetic" data-magnetic="0.18">
                  <span className="vh-hero__cta-primary-label">Request early access</span>
                  <span className="vh-hero__cta-primary-sub">1,247 Sri Lankans · 48-hour invite</span>
                  <span className="vh-hero__cta-primary-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </a>
                <a href="#tour" className="vh-hero__cta-secondary vh-magnetic" data-magnetic="0.14">
                  <span className="vh-hero__cta-secondary-thumb" aria-hidden="true">
                    <I.play />
                  </span>
                  <span className="vh-hero__cta-secondary-text">
                    <span className="vh-hero__cta-secondary-label">Watch the 60-second tour</span>
                    <span className="vh-hero__cta-secondary-meta">Loom-style · no signup</span>
                  </span>
                </a>
              </div>

              <div className="vh-hero__proof">
                <span className="vh-hero__proof-mark" aria-hidden="true">
                  <I.check />
                </span>
                <span>Free for personal use</span>
                <span className="vh-hero__proof-sep" aria-hidden="true">·</span>
                <span><strong>1,247</strong>&nbsp;Sri&nbsp;Lankans already on the waitlist</span>
              </div>
            </div>

            <div className="vh-hero__meta">
              <span className="vh-hero__meta-item"><I.shield /> End-to-end encrypted</span>
              <span className="vh-hero__meta-item"><I.globe /> Built in Colombo 🇱🇰</span>
              <span className="vh-hero__meta-item"><I.phone /> iOS · Android · Web</span>
            </div>
          </div>

          {/* Hero Device & App Showcase */}
          <div className="vh-hero__scene vh-reveal">
            <div className="vh-scene-bg" aria-hidden="true">
              <div className="vh-scene-bg__shape" />
            </div>

            <span className="vh-hero__scene-tag" aria-hidden="true">
              <span className="vh-hero__scene-tag-dot" />
              <span>Live feed — not a mockup</span>
            </span>

            <span className="vh-hero__scene-folio" aria-hidden="true">
              <span>FIG.&nbsp;01</span>
              <span className="vh-hero__scene-folio-line" />
              <span>The&nbsp;Today&nbsp;view</span>
            </span>

            <div className="vh-phone vh-phone-parallax" data-parallax="22" aria-hidden="true">
              <div className="vh-phone__notch" />
              <div className="vh-phone__screen">
                <div className="vh-phone__status">
                  <span>9:41</span>
                  <span>•••</span>
                </div>
                <div className="vh-phone__ui">
                  <div className="vh-phone__greeting">Good evening · Tue 4 Aug</div>
                  <div className="vh-phone__name">Thufail</div>
                  <div className="vh-phone__tip">
                    "Track BP, weight, height & waist to derive MAP, WHR and BMR."
                  </div>
                  <div className="vh-phone__glass">
                    <div className="vh-phone__glass-label">Upcoming today</div>
                    <div className="vh-phone__row">
                      <span className="vh-phone__row-icon"><I.pill /></span>
                      <span>Paracetamol</span>
                      <span style={{ marginLeft: "auto", opacity: 0.7, fontWeight: 500 }}>After food</span>
                    </div>
                    <div className="vh-phone__row">
                      <span className="vh-phone__row-icon"><I.bell /></span>
                      <span>Dr. visit · 20:15</span>
                    </div>
                    <div className="vh-phone__pills">
                      <span className="vh-phone__pill">B+ Blood</span>
                      <span className="vh-phone__pill">23.8 BMI</span>
                      <span className="vh-phone__pill">4 alerts</span>
                    </div>
                  </div>
                  <div className="vh-phone__quick">
                    <div className="vh-phone__quick-tile"><I.pill /> Medicines</div>
                    <div className="vh-phone__quick-tile"><I.doc /> Records</div>
                    <div className="vh-phone__quick-tile"><I.heart /> Vitals</div>
                    <div className="vh-phone__quick-tile"><I.spark /> Health AI</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social proof strip ─── */}
      <div className="vh-proof">
        <div className="vh-container">
          {/* Logos */}
          <div className="vh-proof__head vh-reveal">
            <span className="vh-proof__label">Trusted by early adopters across Sri Lanka</span>
          </div>
          <div className="vh-proof__logos vh-stagger">
            {LOGOS.map((l) => (
              <span key={l.name} className="vh-proof__logo" title={l.name}>
                {l.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Ticker ─── */}
      <div className="vh-ticker" aria-hidden="true">
        <div className="vh-ticker__track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((it, i) => (
            <span className="vh-ticker__item" key={i}>
              {it.icon}
              {it.label}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Stats panel ─── */}
      <section className="vh-section" style={{ paddingTop: 56, paddingBottom: 32 }}>
        <div className="vh-container">
          <div className="vh-stats-grid vh-reveal">
            {STATS.map((s, i) => (
              <div key={i} className="vh-stat-card">
                <div className="vh-stat-card__top">
                  <div className="vh-stat-card__kicker">
                    {s.kicker[0] && <span className={s.kicker[0]} />}
                    {s.kicker[1]}
                  </div>
                </div>
                <div className="vh-stat-card__num">
                  <CountUp
                    value={parseFloat(s.num.replace(/[^0-9.]/g, ""))}
                    decimals={s.num.includes(".") ? 1 : 0}
                    dur={1800}
                    suffix={s.num.startsWith("<") ? "" : s.suffix}
                  />
                  {s.num.startsWith("<") && <span style={{ color: "#64748B" }}>3</span>}
                  {s.num.startsWith("<") && <small>&nbsp;min</small>}
                </div>
                <div className="vh-stat-card__lbl">{s.lbl}</div>
                {/* Animated accent line at bottom */}
                <div className="vh-stat-card__accent" />
              </div>
            ))}
          </div>

          {/* Loading heartbeat animation */}
          <div className="vh-heartbeat-loader vh-reveal">
            <svg viewBox="0 0 200 40" className="vh-heartbeat-svg" aria-hidden="true">
              <polyline
                points="0,20 30,20 40,20 48,8 56,32 64,14 72,26 80,20 100,20 120,20 128,8 136,32 144,14 152,26 160,20 200,20"
                className="vh-heartbeat-line"
              />
              <circle cx="0" cy="20" r="3" className="vh-heartbeat-dot" />
            </svg>
            <span className="vh-heartbeat-text">Live · Monitoring your health data</span>
          </div>
        </div>
      </section>

      {/* ─── Pillars ─── */}
      <section className="vh-section" id="pillars">
        <span className="vh-drift vh-drift--teal vh-drift--float-a" aria-hidden="true" />
        <span className="vh-drift vh-drift--orange vh-drift--float-c" aria-hidden="true" />
        <span className="vh-section__eye" aria-hidden="true" />
        <div className="vh-container">
          <div className="vh-section__head vh-reveal">
            <div className="vh-hero-pill" style={{ margin: "0 auto 12px" }}>
              <span className="vh-hero-pill__pulse" />
              <span className="vh-hero-pill__text">Three Core Pillars</span>
            </div>
            <h2 className="vh-section__title">
              Three things, done <em>quietly</em> well.
            </h2>
            <p className="vh-section__sub">
              No noise, no notifications you don't need. Just the parts of your health that actually matter — brought together into one calm, searchable place.
            </p>
          </div>
          <div className="vh-pillars vh-stagger">
            {PILLARS.map((p, idx) => (
              <div
                key={p.tag}
                className={`vh-pillar vh-tilt vh-pillar--${p.accent}`}
                data-tilt="3.5"
                style={{ ["--i" as string]: idx }}
              >
                <span className="vh-tilt__glare" />
                <span className="vh-pillar__top" aria-hidden="true" />

                <div className="vh-pillar__header-row">
                  <div className="vh-pillar__icon">
                    <span className="vh-pillar__icon-glow" aria-hidden="true" />
                    <span className="vh-pillar__icon-mark" aria-hidden="true">
                      {p.icon}
                    </span>
                  </div>
                  <span className="vh-pillar__badge">{p.tag}</span>
                </div>

                <div className="vh-pillar__head">
                  <h3 className="vh-pillar__title">{p.title}</h3>
                </div>

                <p className="vh-pillar__copy">{p.copy}</p>

                {/* Rich UI Preview Card */}
                {p.preview && (
                  <div className={`vh-pillar__preview vh-pillar__preview--${p.preview.type}`}>
                    <div className="vh-pillar__preview-header">
                      <span className="vh-pillar__preview-tag">{p.preview.tag}</span>
                      <span className="vh-pillar__preview-chip">{p.preview.chip}</span>
                    </div>
                    <div className="vh-pillar__preview-title">{p.preview.title}</div>
                    <div className="vh-pillar__preview-meta">{p.preview.meta}</div>
                  </div>
                )}

                <ul className="vh-pillar__list">
                  {p.bullets.map((b, i) => (
                    <li key={b} style={{ ["--li-i" as string]: i }}>
                      <span className="vh-pillar__check" aria-hidden="true">
                        <I.check />
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="vh-pillar__footer">
                  <div className="vh-pillar__stat" aria-label={p.stat.label}>
                    <span className="vh-pillar__stat-num">
                      <CountUp
                        value={p.stat.value}
                        decimals={p.stat.decimals ?? 0}
                        suffix={p.stat.suffix ?? ""}
                        dur={1400}
                      />
                    </span>
                    <span className="vh-pillar__stat-label">{p.stat.label}</span>
                  </div>

                  <a href={p.href} className="vh-pillar__more vh-magnetic" data-magnetic="0.2">
                    <span>Explore</span>
                    <span className="vh-pillar__more-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works (3 steps) ─── */}
      <section className="vh-section vh-section--alt">
        <div className="vh-container">
          <div className="vh-section__head vh-reveal">
            <span className="vh-eyebrow">02 / How it works</span>
            <h2 className="vh-section__title">
              From zero to <em>quietly in control</em> in 3 minutes.
            </h2>
          </div>
          <div className="vh-how vh-stagger">
            {HOW_STEPS.map((s) => (
              <div key={s.n} className="vh-step">
                <div className="vh-step__num">{s.n}</div>
                <h3 className="vh-step__title">{s.title}</h3>
                <p className="vh-step__body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Timeline (Day 1 / 2 / 3) ─── */}
      <section className="vh-section" id="tour">
        <div className="vh-container">
          <div className="vh-section__head vh-reveal">
            <span className="vh-eyebrow">03 / A few days in</span>
            <h2 className="vh-section__title">
              You set it up. <br />
              <em>It grows with you.</em>
            </h2>
            <p className="vh-section__sub">
              HealthHub starts as a stranger and becomes someone you actually rely on. Most people say the relationship clicks in about three days.
            </p>
          </div>
          <div className="vh-tl-progress">
            <span className="vh-tl-progress__label">Onboarding in real time</span>
            <div className="vh-tl-progress__bar" />
            <span className="vh-tl-progress__count">3 / 3 days</span>
          </div>

          <div className="vh-tl-section">
            <div className="vh-tl-rail" aria-hidden="true">
              <div className="vh-tl-rail__bg" />
              <div className="vh-tl-rail__fill" />
            </div>
            <div className="vh-timeline vh-stagger">
              {TIMELINE.map((t) => (
                <div
                  key={t.day}
                  className={`vh-tl-card vh-tl-card--${t.theme}`}
                  style={{ ["--tl-color" as any]: t.theme === "neutral" ? "#94A3B8" : t.theme === "emerald" ? "#10B981" : "var(--vh-sky)" }}
                >
                  <div className="vh-tl-card__marker">
                    <span className="vh-tl-card__marker-dot" />
                    {t.marker}
                  </div>
                  <div className="vh-tl-card__day">{t.day}</div>
                  <h3 className="vh-tl-card__role">{t.role}</h3>
                  <blockquote className="vh-tl-card__quote">{t.quote}</blockquote>
                  <p className="vh-tl-card__body">{t.body}</p>
                  <div className="vh-tl-card__change">
                    <span className="vh-tl-card__change-icon">{t.changeIcon}</span>
                    <span className="vh-tl-card__change-text">
                      <strong>What changed</strong>
                      {t.changeBody}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Jobs carousel (dark, vellum-style) ─── */}
      <section className="vh-section" id="jobs">
        <div className="vh-container">
          <div className="vh-jobs vh-reveal">
            <div className="vh-jobs__inner">
              <div className="vh-jobs__head">
                <h2 className="vh-jobs__title">
                  They handle your world <em>so you can focus on what matters.</em>
                </h2>
              </div>
              <div className="vh-jobs__rail" role="tablist">
                {JOBS.map((j, i) => {
                  const active = openJob === i;
                  return (
                    <div
                      key={j.key}
                      className={`vh-jobs-card ${active ? "is-active" : "is-inactive"}`}
                      onClick={() => setOpenJob(i)}
                      role="tab"
                      tabIndex={0}
                      aria-selected={active}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenJob(i);
                        }
                      }}
                    >
                      {!active ? (
                        /* Inactive Vertical Pillar (Vellum Style) */
                        <div className="vh-jobs-card__pillar">
                          <div className="vh-jobs-card__pillar-text">{j.shortLabel || j.label.toUpperCase()}</div>
                          <div className="vh-jobs-card__pillar-icon">{j.icon}</div>
                        </div>
                      ) : (
                        /* Active Card Body */
                        <div className="vh-jobs-card__body">
                          <h3 className="vh-jobs-card__title">{j.plainTitle || j.title}</h3>
                          <p className="vh-jobs-card__desc">{j.desc}</p>

                          {/* Window mockup */}
                          <div className="vh-jobs-card__window">
                            <div className="vh-jobs-card__titlebar">
                              <div className="vh-jobs-card__traffic">
                                <span /><span /><span />
                              </div>
                              <div className="vh-jobs-card__win-title">
                                {j.window.title} <span style={{ opacity: 0.4, marginLeft: 4 }}>▾</span>
                              </div>
                              <div style={{ width: 36 }} />
                            </div>
                            <div className="vh-jobs-card__content">
                              <div className="vh-jobs-card__greet">{j.window.greeting}</div>
                              {j.window.sections.map((s, idx) => (
                                <div key={idx} className="vh-jobs-card__section">
                                  <div className="vh-jobs-card__section-label">
                                    <span>{s.num}</span>
                                    {s.pill && (
                                      <span className={`vh-jobs-card__pill vh-jobs-card__pill--${s.pill.cls}`}>
                                        {s.pill.text}
                                      </span>
                                    )}
                                  </div>
                                  <div className="vh-jobs-card__section-sub">
                                    <span>{s.sub}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* CTA bar */}
                          <div className="vh-jobs-card__cta">
                            <span className="vh-jobs-card__cta-text">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 6, color: "#38BDF8" }}>
                                <path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12" />
                              </svg>
                              Meet your personal intelligence.
                            </span>
                            <a href="#cta" className="vh-jobs-card__cta-btn vh-magnetic" data-magnetic="0.3">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12" />
                              </svg>
                              HATCH YOURS
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="vh-jobs__dots">
                {JOBS.map((j, i) => (
                  <button
                    key={j.key}
                    className={`vh-jobs__dot ${openJob === i ? "is-active" : ""}`}
                    onClick={() => setOpenJob(i)}
                    aria-label={`Show job: ${j.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Use case accordion ─── */}
      <section className="vh-section vh-section--alt" id="use-cases">
        <div className="vh-container">
          <div className="vh-section__head vh-reveal">
            <span className="vh-eyebrow">04 / Built for</span>
            <h2 className="vh-section__title">
              The same app, <em>different lives.</em>
            </h2>
            <p className="vh-section__sub">
              HealthHub quietly changes shape depending on who you are and what you need it to do. Here's how.
            </p>
          </div>
          <div className="vh-uc-2">
            {/* Dynamic visual panel */}
            <div className="vh-uc-visual vh-reveal" aria-hidden="true">
              {/* Drifting ambient orbs */}
              <div className="vh-uc-orb vh-uc-orb--1" />
              <div className="vh-uc-orb vh-uc-orb--2" />

              <div className="vh-uc-scenes">
                {USE_CASES.map((u) => (
                  <div
                    key={u.key}
                    className={`vh-uc-scene ${openUc === u.key ? "is-active" : ""}`}
                    data-scene={u.key}
                  >
                    <div className="vh-uc-scene__head">
                      <span className="vh-uc-now">
                        <span className="vh-uc-now__dot" />
                        Now showing · {u.sub}
                      </span>
                      <h3 className="vh-uc-scene__role">{u.role}</h3>
                    </div>
                    {u.visual === "phone-timeline" && (
                      <div className="vh-uc-mock">
                        <div className="vh-uc-annot vh-uc-annot--top">
                          <span className="vh-uc-annot__dot" />
                          <div className="vh-uc-annot__body">
                            <span>3 new records</span>
                            <span className="vh-uc-annot__sub">just synced</span>
                          </div>
                        </div>
                        <div className="vh-uc-annot vh-uc-annot--bottom">
                          <span className="vh-uc-annot__dot vh-uc-annot__dot--green" />
                          <div className="vh-uc-annot__body">
                            <span>AI summary ready</span>
                            <span className="vh-uc-annot__sub">2-min read</span>
                          </div>
                        </div>
                        {/* Watch (secondary device) */}
                        <div
                          className="vh-uc-watch"
                          style={{ right: "calc(50% - 120px - 70px)", top: "30px" }}
                        >
                          <div className="vh-uc-watch__band vh-uc-watch__band--top" />
                          <div className="vh-uc-watch__band vh-uc-watch__band--bottom" />
                          <div className="vh-uc-watch__screen">
                            <div className="vh-uc-watch__time">118<span style={{ fontSize: 14, opacity: 0.7 }}>/76</span></div>
                            <div className="vh-uc-watch__label">BP · Live</div>
                            <div style={{ flex: 1 }} />
                            <div className="vh-uc-watch__bar" />
                          </div>
                        </div>
                        <div className="vh-uc-phone">
                          <div className="vh-uc-phone__notch" />
                          <div className="vh-uc-phone__screen">
                            <div className="vh-uc-phone__greeting">
                              "Track BP, weight, height & waist to derive MAP, WHR and BMR."
                            </div>
                            <div className="vh-uc-phone__row vh-uc-phone__row--accent">
                              <span className="vh-uc-phone__row-icon"><I.doc style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>Lab · HbA1c 6.8</span>
                              <span style={{ fontSize: 9.5, color: "var(--vh-ink-3)" }}>2m</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon"><I.pill style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>Metformin · 500mg</span>
                              <span style={{ fontSize: 9.5, color: "var(--vh-ink-3)" }}>8 PM</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon"><I.heart style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>BP 118/76 · normal</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon"><I.book style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>Dr. K. 20:15</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {u.visual === "phone-caregiver" && (
                      <div className="vh-uc-mock">
                        <div className="vh-uc-annot vh-uc-annot--top">
                          <span className="vh-uc-annot__dot vh-uc-annot__dot--amber" />
                          <div className="vh-uc-annot__body">
                            <span>Mum missed 8 PM dose</span>
                            <span className="vh-uc-annot__sub">3 min ago</span>
                          </div>
                        </div>
                        <div className="vh-uc-annot vh-uc-annot--bottom">
                          <span className="vh-uc-annot__dot vh-uc-annot__dot--green" />
                          <div className="vh-uc-annot__body">
                            <span>Resolved · 8:42 PM</span>
                            <span className="vh-uc-annot__sub">you marked it done</span>
                          </div>
                        </div>
                        <div
                          className="vh-uc-watch"
                          style={{ right: "calc(50% - 120px - 70px)", top: "30px" }}
                        >
                          <div className="vh-uc-watch__band vh-uc-watch__band--top" />
                          <div className="vh-uc-watch__band vh-uc-watch__band--bottom" />
                          <div className="vh-uc-watch__screen">
                            <div className="vh-uc-watch__time">3<span style={{ fontSize: 14, opacity: 0.7 }}>/3</span></div>
                            <div className="vh-uc-watch__label">Doses done</div>
                            <div style={{ flex: 1 }} />
                            <div className="vh-uc-watch__bar" />
                          </div>
                        </div>
                        <div className="vh-uc-phone">
                          <div className="vh-uc-phone__notch" />
                          <div className="vh-uc-phone__screen">
                            <div className="vh-uc-phone__greeting">
                              Look after the people you love — without nagging.
                            </div>
                            <div className="vh-uc-phone__row vh-uc-phone__row--accent">
                              <span className="vh-uc-phone__row-icon"><I.bell style={{ width: 13, height: 13, color: "#D97706" }} /></span>
                              <span style={{ flex: 1 }}>Mum · Paracetamol</span>
                              <span style={{ fontSize: 9.5, color: "var(--vh-ink-3)" }}>8 PM</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon"><I.heart style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>Dad · BP 142/88</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon"><I.pill style={{ width: 13, height: 13 }} /></span>
                              <span style={{ flex: 1 }}>Kids · Vitamin D</span>
                            </div>
                            <div className="vh-uc-phone__row">
                              <span className="vh-uc-phone__row-icon" style={{ background: "rgba(16,185,129,0.12)" }}><I.check style={{ width: 13, height: 13, color: "#10B981" }} /></span>
                              <span style={{ flex: 1 }}>All caught up</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {u.visual === "stack-doctor" && (
                      <div className="vh-uc-stack">
                        <div className="vh-uc-annot vh-uc-annot--top">
                          <span className="vh-uc-annot__dot" />
                          <div className="vh-uc-annot__body">
                            <span>Visit in 23 min</span>
                            <span className="vh-uc-annot__sub">share link opened</span>
                          </div>
                        </div>
                        <div className="vh-uc-stack__card">
                          <div
                            className="vh-uc-stack__card-icon"
                            style={{ background: "var(--vh-sky-soft)", color: "var(--vh-sky)" }}
                          >
                            <I.doc />
                          </div>
                          <div className="vh-uc-stack__card-text">
                            <div className="vh-uc-stack__card-title">Thufail Perera · 32</div>
                            <div className="vh-uc-stack__card-meta">HbA1c trending up · 3 readings</div>
                          </div>
                          <span
                            className="vh-uc-stack__card-status"
                            style={{ background: "rgba(217, 119, 6, 0.12)", color: "#B45309" }}
                          >
                            ATTENTION
                          </span>
                        </div>
                        <div className="vh-uc-stack__card">
                          <div
                            className="vh-uc-stack__card-icon"
                            style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}
                          >
                            <I.trend />
                          </div>
                          <div className="vh-uc-stack__card-text">
                            <div className="vh-uc-stack__card-title">Adherence · 92%</div>
                            <div className="vh-uc-stack__card-meta">Metformin 500mg · twice daily</div>
                          </div>
                          <span
                            className="vh-uc-stack__card-status"
                            style={{ background: "rgba(16, 185, 129, 0.12)", color: "#047857" }}
                          >
                            ON TRACK
                          </span>
                        </div>
                        <div className="vh-uc-stack__card">
                          <div
                            className="vh-uc-stack__card-icon"
                            style={{ background: "rgba(232, 95, 61, 0.10)", color: "var(--vh-coral)" }}
                          >
                            <I.heart />
                          </div>
                          <div className="vh-uc-stack__card-text">
                            <div className="vh-uc-stack__card-title">Allergies</div>
                            <div className="vh-uc-stack__card-meta">Penicillin (critical)</div>
                          </div>
                          <span
                            className="vh-uc-stack__card-status"
                            style={{ background: "rgba(239, 68, 68, 0.12)", color: "#B91C1C" }}
                          >
                            CRITICAL
                          </span>
                        </div>
                      </div>
                    )}
                    {u.visual === "stack-lab" && (
                      <div className="vh-uc-stack">
                        <div className="vh-uc-annot vh-uc-annot--top">
                          <span className="vh-uc-annot__dot vh-uc-annot__dot--green" />
                          <div className="vh-uc-annot__body">
                            <span>API · 99.8% uptime</span>
                            <span className="vh-uc-annot__sub">last 90 days</span>
                          </div>
                        </div>
                        <div className="vh-uc-stack__card">
                          <div
                            className="vh-uc-stack__card-icon"
                            style={{ background: "var(--vh-sky-soft)", color: "var(--vh-sky)" }}
                          >
                            <I.flask />
                          </div>
                          <div className="vh-uc-stack__card-text">
                            <div className="vh-uc-stack__card-title">CBC · Patient #4821</div>
                            <div className="vh-uc-stack__card-meta">Pushed via API · 14:32</div>
                          </div>
                          <span
                            className="vh-uc-stack__card-status"
                            style={{ background: "rgba(16, 185, 129, 0.12)", color: "#047857" }}
                          >
                            DELIVERED
                          </span>
                        </div>
                        <div className="vh-uc-stack__card">
                          <div
                            className="vh-uc-stack__card-icon"
                            style={{ background: "rgba(99, 102, 241, 0.10)", color: "#4F46E5" }}
                          >
                            <I.doc />
                          </div>
                          <div className="vh-uc-stack__card-text">
                            <div className="vh-uc-stack__card-title">Lipid panel · 23 today</div>
                            <div className="vh-uc-stack__card-meta">Auto-delivered · audit logged</div>
                          </div>
                          <span
                            className="vh-uc-stack__card-status"
                            style={{ background: "rgba(14, 165, 233, 0.12)", color: "#0369A1" }}
                          >
                            23 SENT
                          </span>
                        </div>
                        <div className="vh-uc-stats">
                          <div className="vh-uc-stat-card">
                            <div className="vh-uc-stat-card__label">This week</div>
                            <div className="vh-uc-stat-card__value">
                              <CountUp value={2147} dur={1500} />
                            </div>
                            <div className="vh-uc-stat-card__delta vh-uc-stat-card__delta--up">
                              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15" />
                              </svg>
                              +18% vs last week
                            </div>
                          </div>
                          <div className="vh-uc-stat-card">
                            <div className="vh-uc-stat-card__label">Delivery</div>
                            <div className="vh-uc-stat-card__value">
                              <CountUp value={99.8} decimals={1} dur={1500} />
                              <small style={{ fontSize: 14, color: "var(--vh-ink-3)" }}>%</small>
                            </div>
                            <div className="vh-uc-stat-card__delta">uptime · 90 days</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Richer accordion list */}
            <div className="vh-uc-list vh-stagger" role="list">
              {USE_CASES.map((u) => {
                const open = openUc === u.key;
                const toneBg: Record<string, string> = {
                  primary: "var(--vh-sky-soft)",
                  warning: "rgba(245, 158, 11, 0.14)",
                  info: "rgba(14, 165, 233, 0.14)",
                  success: "rgba(16, 185, 129, 0.14)",
                };
                const toneFg: Record<string, string> = {
                  primary: "var(--vh-sky)",
                  warning: "#B45309",
                  info: "#0369A1",
                  success: "#047857",
                };
                return (
                  <div
                    key={u.key}
                    className="vh-uc-card"
                    role="listitem"
                    aria-expanded={open}
                  >
                    <div
                      className="vh-uc-card__head"
                      onClick={() => setOpenUc(open ? null : u.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenUc(open ? null : u.key);
                        }
                      }}
                    >
                      <span
                        className="vh-uc-card__icon"
                        style={{
                          background: toneBg[u.tone],
                          color: toneFg[u.tone],
                        }}
                      >
                        {u.icon}
                      </span>
                      <span className="vh-uc-card__title-wrap">
                        <span className="vh-uc-card__title">{u.label}</span>
                        <span className="vh-uc-card__meta">{u.sub}</span>
                      </span>
                      <span className="vh-uc-card__chev"><I.chev /></span>
                    </div>
                    <div className="vh-uc-card__body">
                      <div>
                        <div className="vh-uc-card__inner">
                          <p>{u.body}</p>
                          <ul className="vh-uc-card__list">
                            {u.bullets.map((b) => (
                              <li key={b}><I.check /> {b}</li>
                            ))}
                          </ul>
                          <a href={u.ctaHref} className="vh-uc-card__cta" onClick={(e) => e.stopPropagation()}>
                            {u.cta}
                            <I.arrow />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI Spotlight ─── */}
      <section className="vh-section vh-section--ink vh-glow" id="security">
        <span className="vh-drift vh-drift--coral vh-drift--float-b" aria-hidden="true" />
        <span className="vh-drift vh-drift--sky vh-drift--float-a" aria-hidden="true" />
        <span className="vh-section__eye" aria-hidden="true" />
        <div className="vh-container">
          <div className="vh-ai">
            <div className="vh-ai__copy vh-reveal">
              <span className="vh-eyebrow">05 / Health AI</span>
              <h2 className="vh-section__title">
                Ask anything. <br />
                <em>Grounded in your real data.</em>
              </h2>
              <p className="vh-section__sub">
                Health AI sees your records, your medicines and your trends — and answers in plain language. It explains labs, flags interactions, and writes a clean summary your doctor will actually read.
              </p>
              <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <a href="#cta" className="vh-btn vh-btn--sky vh-magnetic" data-magnetic="0.25">
                  Try Health AI
                  <span className="vh-btn-arrow"><I.arrow /></span>
                </a>
                <a href="#faq" className="vh-btn vh-magnetic" data-magnetic="0.2" style={{ background: "transparent", color: "var(--vh-cream)", border: "1px solid rgba(251,247,238,0.24)" }}>
                  How accurate is it?
                </a>
              </div>
            </div>
            <div className="vh-ai__mock vh-reveal" aria-hidden="true">
              <div className="vh-ai__mock-head">
                <span className="vh-ai__mock-mark"><I.spark /></span>
                <div>
                  <div className="vh-ai__mock-title">HealthHub AI</div>
                  <div className="vh-ai__mock-sub">Grounded in your records</div>
                </div>
              </div>
              <div className="vh-ai__msg">
                <div className="vh-ai__bubble vh-ai__bubble--user">
                  <div className="vh-ai__bubble__label">You</div>
                  My HbA1c has been creeping up for 3 readings — should I be worried?
                </div>
                <div className="vh-ai__bubble vh-ai__bubble--ai">
                  <div className="vh-ai__bubble__label">HealthHub AI</div>
                  Looking at your last three readings (6.1 → 6.4 → <strong>6.8</strong>), this is a clear upward trend — still in the <em>prediabetic</em> range, but worth a conversation with your GP. The pattern is more meaningful than any single value.
                  <br /><br />
                  <strong>Worth discussing</strong> at your next visit: diet, weight, and whether to repeat the test in 3 months.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="vh-section vh-section--alt">
        <div className="vh-container">
          <div className="vh-section__head vh-reveal">
            <span className="vh-eyebrow">06 / What people say</span>
            <h2 className="vh-section__title">
              Real humans, <em>quietly happier.</em>
            </h2>
          </div>
          <div className="vh-testi vh-stagger">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="vh-testi__card vh-tilt" data-tilt="3">
                <span className="vh-tilt__glare" />
                <span className="vh-testi__stars">
                  {[0, 1, 2, 3, 4].map((i) => <I.star key={i} />)}
                </span>
                <p className="vh-testi__quote">"{t.quote}"</p>
                <div className="vh-testi__author">
                  <span className="vh-testi__avatar">{t.initials}</span>
                  <div className="vh-testi__meta">
                    <span className="vh-testi__name">{t.name}</span>
                    <span className="vh-testi__role">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="vh-section" id="pricing">
        <div className="vh-container">
          <div className="vh-section__head vh-section__head--center vh-reveal">
            <span className="vh-eyebrow">07 / Pricing</span>
            <h2 className="vh-section__title">
              Honest pricing, <em>no ads ever.</em>
            </h2>
            <p className="vh-section__sub" style={{ marginLeft: "auto", marginRight: "auto" }}>
              Start free, stay free if you want. Pay a small yearly fee if you'd like the family features and unlimited AI.
            </p>
            <div className="vh-pricing__seal-row">
              <span><I.shield /> No card required to start</span>
              <span aria-hidden="true" className="vh-pricing__seal-dot" />
              <span>Cancel anytime</span>
              <span aria-hidden="true" className="vh-pricing__seal-dot" />
              <span>30-day refund</span>
            </div>
          </div>
          <div className="vh-pricing">
            {/* ── Free ── */}
            <div className="vh-tier vh-tier--free" data-tilt="2">
              <span className="vh-tilt__glare" />
              <div className="vh-tier__chip vh-tier__chip--sky">
                <I.heart />
                <span>For you</span>
              </div>
              <div className="vh-tier__name">Free · Personal</div>
              <div className="vh-tier__price">
                <span className="vh-tier__price-num">
                  <span className="vh-tier__price-cur">LKR</span>
                  <span className="vh-tier__price-amt">0</span>
                </span>
                <span className="vh-tier__price-period">/ forever</span>
              </div>
              <p className="vh-tier__desc">{TIERS[0].desc}</p>
              <ul className="vh-tier__features">
                <li><I.check /> <span>Up to <strong>2 profiles</strong></span></li>
                <li><I.check /> <span>Unlimited <strong>records &amp; medicines</strong></span></li>
                <li><I.check /> <span><strong>14-day</strong> medicine reminders</span></li>
                <li><I.check /> <span><strong>10</strong> AI summaries / month</span></li>
                <li><I.check /> <span><strong>iOS, Android &amp; web</strong></span></li>
              </ul>
              <a href={TIERS[0].href} className="vh-tier__cta vh-tier__cta--ghost vh-magnetic" data-magnetic="0.22">
                <span>{TIERS[0].cta}</span>
                <span className="vh-tier__cta-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </a>
              <div className="vh-tier__trust">
                <I.shield /> No credit card required
              </div>
            </div>

            {/* ── Plus (Featured) ── */}
            <div className="vh-tier vh-tier--featured vh-shine" data-tilt="2">
              <span className="vh-tilt__glare" />
              <div className="vh-tier__chip vh-tier__chip--featured">
                <span className="vh-tier__chip-pulse" aria-hidden="true" />
                <I.star />
                <span>Most popular</span>
                <span className="vh-tier__chip-meta">— 64% pick this</span>
              </div>
              <div className="vh-tier__name">Plus · For families</div>
              <div className="vh-tier__price">
                <span className="vh-tier__price-num">
                  <span className="vh-tier__price-cur">LKR</span>
                  <span className="vh-tier__price-amt">1,500</span>
                </span>
                <span className="vh-tier__price-period">/ year</span>
              </div>
              <p className="vh-tier__price-equiv">≈ LKR&nbsp;125 / month · billed yearly</p>
              <p className="vh-tier__desc">{TIERS[1].desc}</p>
              <ul className="vh-tier__features">
                <li><I.check /> <span><strong>Unlimited</strong> profiles</span></li>
                <li><I.check /> <span>Caregiver &amp; <strong>family sharing</strong></span></li>
                <li><I.check /> <span><strong>Unlimited</strong> medicine reminders</span></li>
                <li><I.check /> <span><strong>Unlimited</strong> AI summaries</span></li>
                <li><I.check /> <span>Doctor-ready <strong>share links</strong></span></li>
                <li><I.check /> <span><strong>Priority support</strong> — 24-hour reply</span></li>
              </ul>
              <a href={TIERS[1].href} className="vh-tier__cta vh-tier__cta--featured vh-magnetic" data-magnetic="0.22">
                <span>{TIERS[1].cta}</span>
                <span className="vh-tier__cta-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </a>
              <div className="vh-tier__trust">
                <I.shield /> 30-day refund · Cancel anytime
              </div>
            </div>

            {/* ── Clinic ── */}
            <div className="vh-tier vh-tier--clinic" data-tilt="2">
              <span className="vh-tilt__glare" />
              <div className="vh-tier__chip vh-tier__chip--coral">
                <I.flask />
                <span>For practices &amp; labs</span>
              </div>
              <div className="vh-tier__name">Clinic · Healthcare partners</div>
              <div className="vh-tier__price">
                <span className="vh-tier__price-num">
                  <span className="vh-tier__price-amt">Custom</span>
                </span>
                <span className="vh-tier__price-period">/ per practice</span>
              </div>
              <p className="vh-tier__desc">{TIERS[2].desc}</p>
              <ul className="vh-tier__features">
                <li><I.check /> <span><strong>Everything</strong> in Plus</span></li>
                <li><I.check /> <span><strong>Direct result push</strong> — API</span></li>
                <li><I.check /> <span><strong>Bulk seat</strong> management</span></li>
                <li><I.check /> <span><strong>Audit log</strong> &amp; SSO</span></li>
                <li><I.check /> <span><strong>Dedicated success</strong> manager</span></li>
              </ul>
              <a href={TIERS[2].href} className="vh-tier__cta vh-tier__cta--ink vh-magnetic" data-magnetic="0.22">
                <span>{TIERS[2].cta}</span>
                <span className="vh-tier__cta-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </span>
              </a>
              <div className="vh-tier__trust">
                <I.heart /> Trusted by 23 practices island-wide
              </div>
            </div>
          </div>

          <div className="vh-pricing__after">
            <a href="#compare" className="vh-pricing__compare vh-magnetic" data-magnetic="0.18">
              <span>Compare every feature, side-by-side</span>
              <span className="vh-pricing__compare-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </span>
            </a>
            <p className="vh-pricing__assurance">
              <I.shield /><I.heart /><I.globe />
              <span>No ads, ever · Encrypted, always · Built in Colombo 🇱🇰</span>
            </p>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="vh-section vh-section--alt" id="faq">
        <div className="vh-container vh-container-narrow">
          <div className="vh-section__head vh-reveal">
            <span className="vh-eyebrow">08 / Questions</span>
            <h2 className="vh-section__title">
              Quick <em>honest</em> answers.
            </h2>
          </div>
          <div className="vh-faq vh-stagger">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={f.q}
                  className="vh-faq__item"
                  aria-expanded={open}
                >
                  <button
                    type="button"
                    className="vh-faq__q"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-controls={`faq-a-${i}`}
                  >
                    <span>{f.q}</span>
                    <span className="vh-faq__plus" aria-hidden="true" />
                  </button>
                  <div id={`faq-a-${i}`} className="vh-faq__a">
                    <div>
                      <div className="vh-faq__a-inner">{f.a}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="vh-section" id="cta">
        <div className="vh-container">
          <div className="vh-cta vh-reveal">
            <div className="vh-cta__glow-bg" aria-hidden="true" />
            <h2 className="vh-cta__title">
              Your health, <em className="vh-cta__highlight">quietly</em> in order.
            </h2>
            <p className="vh-cta__sub">
              Join the private beta today. Free for personal use, no credit card required, zero ads — ever.
            </p>
            <div className="vh-cta__row">
              <a href="/account/signup" className="vh-cta-btn-primary vh-magnetic" data-magnetic="0.25">
                Get started — it's free
                <span className="vh-btn-arrow"><I.arrow /></span>
              </a>
              <a href="mailto:hello@healthhub.app" className="vh-cta-btn-secondary vh-magnetic" data-magnetic="0.2">
                Talk to a human
              </a>
            </div>
            <div className="vh-cta__meta">
              <span>iOS · Android · Web</span>
              <span className="vh-cta__meta-dot">•</span>
              <span>EN · සිං · த</span>
              <span className="vh-cta__meta-dot">•</span>
              <span>100% Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="vh-footer">
        {/* Top section: brand + newsletter */}
        <div className="vh-container">
          <div className="vh-footer__top">
            <div className="vh-footer__brand-col">
              <Link href="/" className="vh-footer__brand" aria-label="HealthHub home">
                <span className="vh-footer__brand-mark">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
                <span>HealthHub</span>
              </Link>
              <p className="vh-footer__tag">
                A private, beautifully designed health companion — built quietly in Colombo, for the way you actually look after the people you love.
              </p>
              {/* Social Icons */}
              <div className="vh-footer__socials">
                <a href="#" className="vh-footer__social" aria-label="Twitter / X">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="vh-footer__social" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                </a>
                <a href="#" className="vh-footer__social" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>

            <div className="vh-footer__newsletter-col">
              <h4 className="vh-footer__col-title">Stay in the loop</h4>
              <p className="vh-footer__newsletter-desc">Product updates, health tips, and early access — straight to your inbox.</p>
              <form className="vh-footer__newsletter" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder="you@email.com" className="vh-footer__newsletter-input" aria-label="Newsletter email" />
                <button type="submit" className="vh-footer__newsletter-btn">Subscribe</button>
              </form>
            </div>
          </div>

          {/* Link columns */}
          <div className="vh-footer__links-grid">
            <div className="vh-footer__col">
              <h4 className="vh-footer__col-title">Product</h4>
              <ul>
                <li><a href="#pillars">Features</a></li>
                <li><a href="#tour">Tour</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#security">Security</a></li>
                <li><a href="#jobs">Use Cases</a></li>
              </ul>
            </div>
            <div className="vh-footer__col">
              <h4 className="vh-footer__col-title">Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Careers <span className="vh-footer__badge">Hiring</span></a></li>
                <li><a href="#">Press</a></li>
                <li><a href="mailto:hello@healthhub.app">Contact</a></li>
              </ul>
            </div>
            <div className="vh-footer__col">
              <h4 className="vh-footer__col-title">Resources</h4>
              <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div className="vh-footer__col">
              <h4 className="vh-footer__col-title">Legal</h4>
              <ul>
                <li><a href="/privacy">Privacy Policy</a></li>
                <li><a href="/terms">Terms of Service</a></li>
                <li><a href="#">Security</a></li>
                <li><a href="#">DPA</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="vh-footer__bottom">
            <div className="vh-footer__bottom-left">
              <span className="vh-footer__status">
                <span className="vh-footer__status-dot" />
                All systems operational
              </span>
              <span className="vh-footer__copyright">© 2026 HealthHub · Colombo, Sri Lanka 🇱🇰</span>
            </div>
            <div className="vh-footer__bottom-right">
              <span className="vh-footer__encrypt">
                <I.shield style={{ width: 13, height: 13 }} />
                End-to-end encrypted
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
