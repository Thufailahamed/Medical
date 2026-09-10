"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarCheck,
  Check,
  ChevronDown,
  FileSearch,
  HeartPulse,
  Lock,
  Menu,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";

const NAV_LINKS = [
  { label: "The record", href: "#record" },
  { label: "How it works", href: "#how" },
  { label: "Health AI", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
];

const HOSPITALS = ["Asiri Health", "Nawaloka", "Durdans", "Lanka Hospitals", "Hemas Labs", "Ninewells", "Lanka Hospitals Diagnostics"];

const TAPE = [
  ["HbA1c", "6.1%", "in range"],
  ["Blood pressure", "122/78", "this morning"],
  ["Next dose", "8:00 PM", "after rice"],
  ["Visit", "Tue 09:30", "Dr. Perera"],
  ["Records", "148", "indexed"],
  ["Family", "5 profiles", "shared on purpose"],
];

const FILM = [
  { src: "/assets/insurance/plan-types/insurance-family.jpg", cap: "Sunday with the boys" },
  { src: "/assets/brand/harbor-hands.png", cap: "Amma’s reports, read together" },
  { src: "/assets/insurance/plan-types/insurance-senior.jpg", cap: "The appointment, prepared" },
  { src: "/assets/brand/harbor-still-life.png", cap: "What used to live in a drawer" },
  { src: "/assets/insurance/plan-types/insurance-maternity.jpg", cap: "The first file that matters" },
  { src: "/assets/insurance/hero.jpg", cap: "Private by construction" },
];

const FEATURES = [
  {
    id: "timeline",
    k: "01",
    title: "A record that reads like a letter",
    body: "Labs, prescriptions and visits land in date order — searchable in English, Sinhala or Tamil. No more hunting through WhatsApp.",
    mock: "timeline" as const,
  },
  {
    id: "meds",
    k: "02",
    title: "The nudge before the last tablet",
    body: "Doses slide into breakfast, lunch, bedtime. Refill alerts arrive while the bottle still has weight. Never a siren. Never a nag.",
    mock: "meds" as const,
  },
  {
    id: "family",
    k: "03",
    title: "Look after everyone from one login",
    body: "Five profiles. Granular sharing. Watch over elders from London or Dehiwala — with permission, always, and a revoke that actually works.",
    mock: "family" as const,
  },
  {
    id: "share",
    k: "04",
    title: "Walk in with the story already written",
    body: "One tap makes an expiring doctor link: summary, selected records, nothing extra. You see when it was opened.",
    mock: "share" as const,
  },
];

const FAQS = [
  ["Is my data really private?", "Yes. Records are encrypted in transit and at rest, scoped strictly to your account, and never sold. AI never trains on your data. Export or delete everything from Settings."],
  ["Do I need a Sri Lankan number?", "No. HealthHub works worldwide. We started in Colombo — so Sinhala, Tamil and English are first-class — but anyone with a complex health history can use it."],
  ["What does Health AI actually do?", "It reads your uploaded labs, prescriptions and vitals, explains trends in plain language, cites the exact record it used, and drafts questions for your doctor. It never diagnoses — and it tells you when to see a clinician."],
  ["Can my family use it with me?", "Yes. Invite parents, kids or a caregiver, choose exactly what each person sees, and revoke access in one tap. Built for looking after elders from abroad."],
  ["Can I share with my doctor?", "One tap creates a secure, expiring link with a clean summary and selected records. No login needed for your doctor. You see when it was opened."],
];

const TIERS = [
  { name: "Personal", price: "Free", per: "forever", detail: "Your own health, kept properly.", items: ["2 profiles", "Unlimited records & medicines", "Smart reminders (14-day)", "10 AI summaries / month"], href: "/account/signup", cta: "Get started" },
  { name: "Plus", price: "LKR 1,500", per: "per year", detail: "For families who share the work.", items: ["Everything in Personal", "Unlimited profiles + sharing", "Unlimited AI summaries", "Doctor-ready share links", "Priority support"], href: "/account/signup?plan=plus", cta: "Start Plus", featured: true },
  { name: "Clinic", price: "Custom", per: "for practices & labs", detail: "Push results straight to patients.", items: ["Everything in Plus", "Direct result push + API", "Seats, audit log & SSO", "Dedicated success manager"], href: "mailto:hello@healthhub.app", cta: "Talk to us" },
];

function useReveal() {
  useEffect(() => {
    const els = () => document.querySelectorAll("[data-reveal]");
    const show = (e: Element) => e.classList.add("is-in");
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.top < window.innerHeight * 0.96 && r.bottom > 24;
    };
    const sweep = () => els().forEach((e) => { if (visible(e)) show(e); });

    if (!("IntersectionObserver" in window)) {
      els().forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            show(en.target);
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.02, rootMargin: "0px 0px 18% 0px" },
    );
    els().forEach((e) => (visible(e) ? show(e) : io.observe(e)));
    sweep();
    window.addEventListener("scroll", sweep, { passive: true });
    window.addEventListener("hashchange", sweep);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", sweep);
      window.removeEventListener("hashchange", sweep);
    };
  }, []);
}

function useCount(target: number, active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const raf = requestAnimationFrame(() => setN(target));
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);
  return n;
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const n = useCount(value, on);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setOn(true); }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const shown = suffix === "%" || suffix === "×" ? n.toFixed(suffix === "×" ? 1 : 0) : Math.round(n).toString();
  return (
    <div className="stat" ref={ref}>
      <strong>{suffix === "−" ? `−${shown}` : shown}{suffix === "−" ? "%" : suffix}</strong>
      <span>{label}</span>
    </div>
  );
}

function PhoneMock({ kind }: { kind: "timeline" | "meds" | "family" | "share" }) {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock__bar">
        <b>HealthHub</b>
        <small>Colombo · 19:42</small>
      </div>
      {kind === "timeline" && (
        <>
          <span className="mock__chip"><HeartPulse size={11} /> Timeline</span>
          <div className="mock__card mock__card--navy">
            <div className="mock__k">HbA1c · Asiri Central</div>
            <div className="mock__v">6.1% — in range</div>
            <div className="mock__s">12 Mar · down from 6.4</div>
            <svg className="mock__ecg" viewBox="0 0 200 36">
              <path className="draw" d="M0 22h28l6-12 8 24 6-16 8 8H200" />
            </svg>
          </div>
          <div className="mock__card">
            <div className="mock__k">Prescription · Dr. Perera</div>
            <div className="mock__v">Metformin 500mg</div>
            <div className="mock__s">After dinner · 14 days left</div>
          </div>
          <div className="mock__card">
            <div className="mock__k">Vaccine · Ninewells</div>
            <div className="mock__v">Influenza 2026</div>
            <div className="mock__s">Logged from the paper card</div>
          </div>
        </>
      )}
      {kind === "meds" && (
        <>
          <span className="mock__chip"><BellRing size={11} /> Tonight</span>
          <div className="mock__card mock__card--navy">
            <div className="mock__k">8:00 PM · after food</div>
            <div className="mock__v">Paracetamol 500</div>
            <div className="mock__s">2 of 3 doses on track</div>
          </div>
          <div className="mock__row">
            <div className="mock__pill"><div className="mock__k">Breakfast</div><div className="mock__v">Done</div></div>
            <div className="mock__pill"><div className="mock__k">Lunch</div><div className="mock__v">Done</div></div>
          </div>
          <div className="mock__card">
            <div className="mock__k">Refill</div>
            <div className="mock__v">Metformin · 5 days</div>
            <div className="mock__s">We’ll remind you Thursday</div>
          </div>
        </>
      )}
      {kind === "family" && (
        <>
          <span className="mock__chip">Family · 5</span>
          {[["Amma", "BP 128/82", "Shared: labs + meds"], ["Appa", "HbA1c 6.8", "Shared: all"], ["Nimal", "Vaccines", "Paediatric"]].map(([n, v, s]) => (
            <div className="mock__card" key={n}>
              <div className="mock__k">{s}</div>
              <div className="mock__v">{n}</div>
              <div className="mock__s">{v}</div>
            </div>
          ))}
        </>
      )}
      {kind === "share" && (
        <>
          <span className="mock__chip"><ShieldCheck size={11} /> Share link</span>
          <div className="mock__card mock__card--navy">
            <div className="mock__k">Expires in 48 hours</div>
            <div className="mock__v">Dr. Perera pack</div>
            <div className="mock__s">Opened 14:03 · Durdans</div>
          </div>
          <div className="mock__card">
            <div className="mock__k">Included</div>
            <div className="mock__v">3 labs · 1 Rx</div>
            <div className="mock__s">AI questions attached</div>
          </div>
        </>
      )}
    </div>
  );
}

function finePointer() {
  return typeof window !== "undefined"
    && window.matchMedia("(pointer: fine)").matches
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function magnetic(e: MouseEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.2}px`);
  el.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.26}px`);
  el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
}
function magneticOut(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.setProperty("--mx", "0px");
  e.currentTarget.style.setProperty("--my", "0px");
}

function tiltMove(e: MouseEvent<HTMLElement>) {
  if (!finePointer()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
  el.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
  el.style.setProperty("--px", `${x * 100}%`);
  el.style.setProperty("--py", `${y * 100}%`);
  el.classList.add("is-tilting");
}
function tiltOut(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.classList.remove("is-tilting");
}

function Btn({
  href,
  variant = "primary",
  size,
  children,
  icon,
}: {
  href: string;
  variant?: "primary" | "ghost" | "light";
  size?: "sm";
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`btn btn--${variant}${size ? ` btn--${size}` : ""}`}
      onMouseMove={magnetic}
      onMouseLeave={magneticOut}
    >
      <span className="btn__shine" aria-hidden="true" />
      <span className="btn__label">{children}</span>
      <span className="btn__glyph">{icon ?? <ArrowRight size={16} />}</span>
    </a>
  );
}

function FeatureMock({ kind }: { kind: (typeof FEATURES)[number]["mock"] }) {
  return (
    <div className="switcher__glass">
      <PhoneMock kind={kind} />
    </div>
  );
}

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [feature, setFeature] = useState(0);
  const pauseFeatures = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  useReveal();

  useEffect(() => {
    const f = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(f);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pauseFeatures.current) return;
      setFeature((i) => (i + 1) % FEATURES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const [heroTab, setHeroTab] = useState<"trends" | "prescriptions" | "doctor">("trends");
  const pauseHeroTabs = useRef(false);

  useEffect(() => {
    const tabs: ("trends" | "prescriptions" | "doctor")[] = ["trends", "prescriptions", "doctor"];
    const id = window.setInterval(() => {
      if (pauseHeroTabs.current) return;
      setHeroTab((curr) => {
        const nextIdx = (tabs.indexOf(curr) + 1) % tabs.length;
        return tabs[nextIdx];
      });
    }, 4600);
    return () => window.clearInterval(id);
  }, []);

  const onHeroMove = (e: MouseEvent<HTMLElement>) => {
    const root = heroRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    root.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    root.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div className={`root ${ready ? "is-ready" : ""}`}>
      <a className="skip" href="#main">Skip to content</a>

      <div className="announce">
        <div className="announce__inner">
          <span className="announce__pill">Private beta · Colombo</span>
          <span><b>500 families</b> this season — free for personal use · <a href="#cta">Claim a place</a></span>
        </div>
      </div>

      <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="nav__progress" style={{ transform: `scaleX(${progress})` }} />
        <div className="nav__inner">
          <Link href="/" className="nav__brand" onClick={() => setMenuOpen(false)}>
            <img className="brand-mark" src="/assets/logo.svg" alt="HealthHub" />
            <span>HealthHub</span>
            <span className="nav__badge">Beta</span>
          </Link>
          <nav className="nav__links" aria-label="Primary">
            {NAV_LINKS.map((l) => <a key={l.href} className="nav__link" href={l.href}>{l.label}</a>)}
          </nav>
          <div className="nav__actions">
            <a href="/login" className="nav__signin">Log in</a>
            <Btn href="#cta" variant="primary" size="sm" icon={<ArrowUpRight size={15} />}>Join the beta</Btn>
            <button className="nav__menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="nav__mobile" aria-label="Mobile">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}<ArrowUpRight size={16} /></a>)}
            <a href="/login" onClick={() => setMenuOpen(false)}>Log in<ArrowUpRight size={16} /></a>
          </nav>
        )}
      </header>

      <main id="main">
        <section className="hero hero--editorial" aria-labelledby="hero-title" ref={heroRef} onMouseMove={onHeroMove}>
          <div className="hero__spot" aria-hidden="true" />
          <div className="container hero__inner">
            <div className="hero__copy rise">
              <p className="eyebrow"><span className="eyebrow__dot" /> Colombo · EN · සිංහල · தமிழ் · Private Beta</p>
              <h1 id="hero-title">Your health has<br />a history. <em>Keep it close.</em></h1>
              <p className="hero__lede">
                The prescription in your drawer. The scan on WhatsApp. The things you remember only when someone asks.
                HealthHub gives every piece a place — private, readable, and doctor-ready in English, Sinhala, and Tamil.
              </p>
              <div className="hero__actions">
                <Btn href="/account/signup">Start your record</Btn>
                <Btn href="#record" variant="ghost" icon={<ArrowRight size={16} />}>See how it works</Btn>
              </div>
              <div className="hero__trust">
                <span><ShieldCheck size={14} /> Bank-grade 256-bit encryption</span>
                <span><Sparkles size={14} /> Reads handwritten prescriptions</span>
                <span><HeartPulse size={14} /> Multi-profile family timeline</span>
              </div>
              <div className="hero__note">
                <span className="hero__note-number">01</span>
                <p><b>Made for the people who keep the family story.</b> Built in Colombo, for records that have travelled farther than they should have to.</p>
              </div>
            </div>

            <div
              className="hero-journal"
              aria-label="HealthHub keeps the story of care together"
              onMouseEnter={() => { pauseHeroTabs.current = true; }}
              onMouseLeave={() => { pauseHeroTabs.current = false; }}
            >
              <div className="hero-journal__photo">
                <img src="/assets/brand/harbor-hands.png" alt="A family reviewing a health report together" />
                <span className="hero-journal__caption">Colombo · the kitchen table</span>
                <div className="hero-journal__photo-badge">
                  <span className="live-dot" />
                  <span>Paper to digital in 3.8s</span>
                </div>
              </div>

              <div className="hero-journal__paper" aria-hidden="true">
                <div className="paper-header">
                  <span>DURDANS CLINICAL LABS</span>
                  <small>REF 8820-C · COLOMBO 03</small>
                </div>
              </div>

              <article className="hero-journal__card living-record">
                {/* Patient Header */}
                <div className="living-record__patient">
                  <div className="living-record__user-info">
                    <div className="living-record__avatar">AP</div>
                    <div className="living-record__meta">
                      <b>Amara Perera</b>
                      <small>Colombo 07 · O+ · 52y</small>
                    </div>
                  </div>
                  <div className="living-record__status">
                    <span className="live-pulse" />
                    <span>Live Record</span>
                  </div>
                </div>

                {/* Interactive Tabs */}
                <div className="living-record__tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={heroTab === "trends"}
                    className={`living-record__tab ${heroTab === "trends" ? "is-active" : ""}`}
                    onClick={() => setHeroTab("trends")}
                  >
                    Lab Trends
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={heroTab === "prescriptions"}
                    className={`living-record__tab ${heroTab === "prescriptions" ? "is-active" : ""}`}
                    onClick={() => setHeroTab("prescriptions")}
                  >
                    Rx Scan
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={heroTab === "doctor"}
                    className={`living-record__tab ${heroTab === "doctor" ? "is-active" : ""}`}
                    onClick={() => setHeroTab("doctor")}
                  >
                    Doctor Brief
                  </button>
                </div>

                {/* Dynamic Preview Body */}
                <div className="living-record__body">
                  {heroTab === "trends" && (
                    <div className="living-record__content">
                      <div className="living-record__source">
                        <span className="tag-hospital">Durdans Hospital</span>
                        <small>HbA1c · 3 tests / 14 mo</small>
                      </div>
                      <div className="living-record__metric">
                        <div>
                          <span className="metric-num">6.1<small>%</small></span>
                          <span className="metric-delta">▼ 0.7% down</span>
                        </div>
                        <span className="metric-badge in-range">In optimal range</span>
                      </div>
                      <div className="living-record__chart">
                        <svg viewBox="0 0 220 44" className="sparkline" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="gradHbA1c" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 10 38 Q 65 30, 110 22 T 210 8 L 210 44 L 10 44 Z"
                            fill="url(#gradHbA1c)"
                          />
                          <path
                            d="M 10 38 Q 65 30, 110 22 T 210 8"
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="10" cy="38" r="3.5" fill="#EF4444" />
                          <circle cx="110" cy="22" r="3.5" fill="#F59E0B" />
                          <circle cx="210" cy="8" r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                        <div className="sparkline-labels">
                          <span>Aug '25 (6.8%)</span>
                          <span>Jan '26 (6.4%)</span>
                          <span className="highlight">Jun '26 (6.1%)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {heroTab === "prescriptions" && (
                    <div className="living-record__content">
                      <div className="living-record__source">
                        <span className="tag-hospital">Nawaloka Hospital</span>
                        <small>Dr. K. Perera · OCR Verified</small>
                      </div>
                      <div className="living-record__meds">
                        <div className="med-row">
                          <span className="med-icon">💊</span>
                          <div className="med-info">
                            <b>Metformin 500mg</b>
                            <small>Morning after meal · මෙට්ෆෝමින්</small>
                          </div>
                          <span className="med-time">8:00 AM</span>
                        </div>
                        <div className="med-row">
                          <span className="med-icon">💊</span>
                          <div className="med-info">
                            <b>Atorvastatin 20mg</b>
                            <small>Nightly before bed · அட்டர்வாஸ்டாடின்</small>
                          </div>
                          <span className="med-time">9:30 PM</span>
                        </div>
                      </div>
                      <div className="med-note">
                        <Sparkles size={12} />
                        <span>2 medicines auto-classified from handwritten scan</span>
                      </div>
                    </div>
                  )}

                  {heroTab === "doctor" && (
                    <div className="living-record__content">
                      <div className="living-record__source">
                        <span className="tag-hospital">Consultation Brief</span>
                        <small>Dr. N. Silva · 09:30 AM</small>
                      </div>
                      <div className="doctor-card">
                        <div className="doctor-card__item">
                          <small>Key talking point</small>
                          <b>HbA1c normalized to 6.1% on current Metformin plan</b>
                        </div>
                        <div className="doctor-card__item">
                          <small>Questions prepared</small>
                          <b>Review kidney panel & discuss dosage tapering</b>
                        </div>
                      </div>
                      <div className="doctor-card__security">
                        <ShieldCheck size={14} />
                        <span>Expiring 24h secure link · 0 records stored by third-party</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="living-record__rule" />
                <div className="living-record__footer">
                  <span><ShieldCheck size={11} /> Private by default</span>
                  <span>Asiri · Durdans · Nawaloka</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <div className="logos" aria-label="Hospitals and labs">
          <div className="container logos__inner">
            <span className="label">Reports we already read</span>
            <div className="logos__track" aria-hidden="true">
              {[0, 1].map((c) => (
                <span key={c} style={{ display: "flex", gap: 40 }}>
                  {HOSPITALS.map((h) => <b key={`${c}-${h}`}><i>◆</i>{h}</b>)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="signal" aria-label="Live health values">
          <div className="tape">
            <div className="tape__track">
              {[0, 1].map((c) => (
                <div className="tape__set" key={c} aria-hidden={c === 1}>
                  {TAPE.map(([k, v, n]) => <span className="tape__item" key={`${c}-${k}`}><small>{k}</small><strong>{v}</strong><em>{n}</em></span>)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="film" aria-hidden="true">
          <div className="film__track">
            {[0, 1].map((c) => (
              <span key={c} style={{ display: "flex", gap: 14 }}>
                {FILM.map((f) => (
                  <div className="film__card" key={`${c}-${f.cap}`}>
                    <img src={f.src} alt="" />
                    <span>{f.cap}</span>
                  </div>
                ))}
              </span>
            ))}
          </div>
        </div>

        <section className="care-brief" aria-labelledby="care-brief-title">
          <div className="container">
            <div className="care-brief__shell" data-reveal>
              <div className="care-brief__photo">
                <img src="/assets/lab/hero.jpg" alt="A patient receiving thoughtful, prepared care" />
                <span className="care-brief__location"><i /> Durdans · Tuesday morning</span>
                <div className="care-brief__seal" aria-hidden="true"><span>Care</span><b>∞</b><span>continues</span></div>
              </div>
              <div className="care-brief__copy">
                <p className="eyebrow eyebrow--dark"><span className="eyebrow__dot" /> The appointment brief</p>
                <h2 id="care-brief-title">The calmest part of a visit should be <em>before you arrive.</em></h2>
                <p className="care-brief__lede">HealthHub turns a drawer of reports into a quiet, doctor-ready handoff. The context lands first; the conversation can start somewhere better.</p>
                <div className="care-brief__timeline" aria-label="A care brief comes together in three steps">
                  <div><span>08:41</span><p><b>Lab trend surfaced</b><small>HbA1c · 3 readings · 14 months</small></p></div>
                  <div><span>08:43</span><p><b>Questions prepared</b><small>Written against the exact records</small></p></div>
                  <div><span>08:45</span><p><b>Doctor link secured</b><small>Expires after the visit · open history shown</small></p></div>
                </div>
                <a className="care-brief__link" href="#how">See how the handoff works <ArrowUpRight size={16} /></a>
              </div>
              <aside className="care-brief__document tilt" aria-label="Sample secure appointment brief" onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <div className="care-brief__document-top"><span>HealthHub</span><small>Prepared · 08:45</small></div>
                <div className="care-brief__patient"><span>NP</span><p><b>Nadeesha Perera</b><small>Dr. Perera · 09:30 today</small></p></div>
                <div className="care-brief__finding"><small>One thing to discuss</small><b>HbA1c rose from 6.1% to 6.8%</b><p>Three readings, with prescription changes in context.</p></div>
                <div className="care-brief__document-foot"><span><ShieldCheck size={13} /> Expiring share</span><span>01 / 03</span></div>
              </aside>
            </div>
          </div>
        </section>

        <section className="section" id="record">
          <div className="container">
            <div className="chapter" data-reveal>
              <div className="chapter__photo">
                <img src="/assets/brand/harbor-hands.png" alt="A younger hand holding an elder’s, papers between them" />
                <span className="chapter__stamp">Colombo · the kitchen table</span>
              </div>
              <div>
                <p className="section__kicker">01 — The record</p>
                <h3>Health is a pile of paper until someone <em>keeps it.</em></h3>
                <p>
                  The bypass file from 2019. Last month’s HbA1c. The prescription you photographed in a car park.
                  HealthHub reads them, files them, and hands them back as a timeline you can actually finish.
                </p>
                <ul className="chapter__list">
                  <li><span className="chapter__n">01</span><span>OCR in English, Sinhala and Tamil — including the messy ones.</span></li>
                  <li><span className="chapter__n">02</span><span>PDF to structured values. Dates, doses, units. Searchable.</span></li>
                  <li><span className="chapter__n">03</span><span>Offline-ready on your phone. The story travels with you.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="product" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section__head" data-reveal>
              <p className="eyebrow"><span className="eyebrow__dot" /> The product</p>
              <h2>Four things, done with <em>unreasonable care.</em></h2>
              <p>Not a dashboard of everything. The four jobs a family actually has, every week.</p>
            </div>
            <div
              className="switcher"
              data-reveal
              onMouseEnter={() => { pauseFeatures.current = true; }}
              onMouseLeave={() => { pauseFeatures.current = false; }}
            >
              <div className="switcher__list" role="tablist" aria-label="Product">
                {FEATURES.map((f, i) => (
                  <button
                    key={f.id}
                    className={`switcher__item ${feature === i ? "is-on" : ""}`}
                    role="tab"
                    aria-selected={feature === i}
                    onClick={() => setFeature(i)}
                    onMouseEnter={() => setFeature(i)}
                  >
                    <small>{f.k}</small>
                    <b>{f.title}</b>
                    <p>{f.body}</p>
                  </button>
                ))}
              </div>
              <div className="switcher__stage">
                <img src="/assets/brand/harbor-still-life.png" alt="" />
                <FeatureMock key={FEATURES[feature].id} kind={FEATURES[feature].mock} />
              </div>
            </div>
          </div>
        </section>

        <section className="section workflow" id="how">
          <div className="container">
            <div className="section__head" data-reveal>
              <p className="eyebrow"><span className="eyebrow__dot" /> How it works</p>
              <h2>Capture. Understand. <em>Walk in ready.</em></h2>
              <p>Three steps, under five minutes. Written with Colombo doctors and busy daughters in mind.</p>
            </div>
            <div className="steps">
              <article className="step tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <div className="step__img"><img src="/assets/brand/harbor-still-life.png" alt="Paper records and medicines on a table" /></div>
                <div className="step__body">
                  <span className="step__num">01 — Gather</span>
                  <h3>Snap. Forward. Done.</h3>
                  <p>Photograph a prescription or forward a lab PDF. Dates, values and doses are pulled out for you.</p>
                </div>
              </article>
              <article className="step tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <div className="step__img"><img src="/assets/brand/harbor-hands.png" alt="Hands reviewing a report together" /></div>
                <div className="step__body">
                  <span className="step__num">02 — Make sense</span>
                  <h3>Trends, translated.</h3>
                  <p>See HbA1c, pressure and weight beside the history that gives them meaning — in plain language.</p>
                </div>
              </article>
              <article className="step tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <div className="step__img"><img src="/assets/insurance/plan-types/insurance-senior.jpg" alt="A clinician with a patient" /></div>
                <div className="step__body">
                  <span className="step__num">03 — Arrive prepared</span>
                  <h3>One link. No folder.</h3>
                  <p>Send a one-time doctor pack. Walk in with answers, not a plastic bag of printouts.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section ai" id="ai">
          <img className="ai__bg" src="/assets/brand/harbor-ecg.png" alt="" />
          <div className="ai__veil" aria-hidden="true" />
          <div className="container ai__inner">
            <div className="ai__copy" data-reveal>
              <p className="eyebrow eyebrow--dark"><span className="eyebrow__dot" /> Health AI · grounded</p>
              <h2>A second pair of eyes, <em>with the file open.</em></h2>
              <p className="lead">Ask in English, Sinhala or Tamil. Every answer cites the exact lab or prescription it came from — and says clearly when a clinician should take over.</p>
              <ul className="ai__bullets">
                <li><span className="ai__check"><Check size={13} /></span>Explains “creeping up” with dates and values, not vibes</li>
                <li><span className="ai__check"><Check size={13} /></span>Drafts three sharp questions for the next visit</li>
                <li><span className="ai__check"><Check size={13} /></span>Never trains on your data. Sources always shown</li>
              </ul>
              <Btn href="/account/signup" variant="light" icon={<ArrowUpRight size={16} />}>Try Health AI free</Btn>
            </div>
            <div className="chat tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
              <div className="chat__bar"><span>Health AI · grounded</span><span className="chat__live"><i /> Live</span></div>
              <div className="chat__q">Amma’s HbA1c has been creeping. What should I actually ask on Tuesday?</div>
              <div className="chat__a">
                <span className="chat__avatar">AI</span>
                <div>
                  <p>The last three readings are <b>6.1 → 6.4 → 6.8%</b>. That slope is worth a conversation — not a panic. I’ve drafted three questions and attached the labs plus the metformin changes around each date.</p>
                  <span className="chat__src">Sources: 3 lab records · 1 prescription · cited inline</span>
                </div>
              </div>
              <div className="chat__cite">
                <img src="/assets/insurance/plan-types/insurance-senior.jpg" alt="" />
                <p>Prepared for Dr. Perera · Tuesday 09:30 · Durdans</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section outcomes">
          <div className="container">
            <div className="section__head section__head--center" data-reveal>
              <p className="eyebrow"><span className="eyebrow__dot" /> From the beta</p>
              <h2>Calmer days, <em>measured.</em></h2>
              <p>2,400 patients across Colombo, Kandy and the diaspora. 2026 private beta.</p>
            </div>
            <div className="stats-grid" data-reveal>
              <Stat value={62} suffix="−" label="Less time hunting for old reports before appointments" />
              <Stat value={4.2} suffix="×" label="More consistent evening doses with gentle reminders" />
              <Stat value={89} suffix="%" label="Said the doctor visit felt more prepared with a share link" />
              <Stat value={100} suffix="%" label="Data exportable and deletable — no lock-in, ever" />
            </div>
          </div>
        </section>

        <section className="section letters">
          <div className="container">
            <div className="section__head" data-reveal>
              <p className="eyebrow eyebrow--dark"><span className="eyebrow__dot" /> Letters from the beta</p>
              <h2 style={{ color: "#fff" }}>Families feel the <em style={{ color: "#b7ccff" }}>difference.</em></h2>
            </div>
            <div className="letters__grid">
              <article className="letter letter--lead tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="stars">★★★★★</span>
                <p style={{ marginTop: 16 }}>“My father’s bypass files were scattered across three hospitals. Before his review, I sent one HealthHub link — the cardiologist said it was the clearest history he’d seen all week.”</p>
                <div className="letter__who">
                  <img src="/assets/insurance/plan-types/insurance-family.jpg" alt="Tharushi Fernando" />
                  <div><b>Tharushi Fernando</b><small>Caregiver · Colombo</small></div>
                </div>
              </article>
              <article className="letter tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="stars">★★★★★</span>
                <p style={{ marginTop: 14 }}>“It showed my HbA1c creeping 6.1 → 6.8 and wrote three questions for my GP. That ten-minute visit finally felt useful.”</p>
                <div className="letter__who">
                  <img src="/assets/insurance/plan-types/insurance-senior.jpg" alt="Mohamed Rizwan" />
                  <div><b>Mohamed Rizwan</b><small>Plus · Kandy</small></div>
                </div>
              </article>
              <article className="letter tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="stars">★★★★★</span>
                <p style={{ marginTop: 14 }}>“I haven’t missed my mother’s evening dose in four months. The app nudges. It never nags.”</p>
                <div className="letter__who">
                  <img src="/assets/brand/harbor-hands.png" alt="Anjali Perera" />
                  <div><b>Anjali Perera</b><small>Plus · London</small></div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section trust" id="security">
          <div className="container">
            <div className="trust__row">
              <div className="trust__item tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="section__kicker"><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Encrypted</span>
                <h3>Private enough for real life.</h3>
                <p>At rest and in transit. Scoped per account. Never sold, never used to train a model on your file.</p>
              </div>
              <div className="trust__item tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="section__kicker"><FileSearch size={14} style={{ verticalAlign: -2 }} /> You own sharing</span>
                <h3>Invite. Limit. Revoke.</h3>
                <p>Choose exactly what family or doctors see. Expiring links, a full audit, no dark patterns.</p>
              </div>
              <div className="trust__item tilt" data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                <span className="section__kicker"><CalendarCheck size={14} style={{ verticalAlign: -2 }} /> Take it with you</span>
                <h3>Export anytime.</h3>
                <p>Full PDF and data export, or one-tap delete. Your story is yours to keep or to leave.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section pricing" id="pricing">
          <div className="container">
            <div className="section__head section__head--center" data-reveal>
              <p className="eyebrow"><span className="eyebrow__dot" /> Pricing</p>
              <h2>Care shouldn’t <em>come with ads.</em></h2>
              <p>Start free. Stay free if that’s all you need. Plus is for families who share the work.</p>
            </div>
            <div className="pricing__grid">
              {TIERS.map((t) => (
                <article key={t.name} className={`price tilt ${t.featured ? "price--featured" : ""}`} data-reveal onMouseMove={tiltMove} onMouseLeave={tiltOut}>
                  {t.featured && <span className="price__badge">Most families</span>}
                  <span className="price__name">{t.name}</span>
                  <strong className="cost">{t.price}</strong>
                  <p className="desc">{t.per} · {t.detail}</p>
                  <ul>{t.items.map((i) => <li key={i}><Check size={15} />{i}</li>)}</ul>
                  <Btn href={t.href} variant={t.featured ? "light" : "ghost"} icon={<ArrowUpRight size={15} />}>{t.cta}</Btn>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section faq" id="faq">
          <div className="container faq__grid">
            <div className="section__head" data-reveal>
              <p className="eyebrow"><span className="eyebrow__dot" /> Questions</p>
              <h2>No mystery in the <em>fine print.</em></h2>
              <p>Still curious? Write to <a href="mailto:hello@healthhub.app" style={{ color: "var(--lapis)", fontWeight: 700 }}>hello@healthhub.app</a> — a human replies within a day.</p>
              <div className="faq__portrait">
                <img src="/assets/insurance/plan-types/insurance-maternity.jpg" alt="The kind of file families keep for years" />
              </div>
            </div>
            <div className="faq__list" data-reveal>
              {FAQS.map(([q, a], i) => {
                const open = openFaq === i;
                return (
                  <div className={`faq__item ${open ? "is-open" : ""}`} key={q}>
                    <button aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                      <span>{q}</span><ChevronDown size={18} />
                    </button>
                    <div className="faq__drawer" aria-hidden={!open}><div className="faq__answer"><p>{a}</p></div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="cta" id="cta">
          <img className="cta__photo" src="/assets/brand/harbor-still-life.png" alt="" />
          <div className="cta__veil" aria-hidden="true" />
          <div className="container cta__inner" data-reveal>
            <div>
              <p className="eyebrow eyebrow--dark"><span className="eyebrow__dot" /> Private beta · 500 places</p>
              <h2>Put the whole story <em>in one place.</em></h2>
            </div>
            <div className="cta__card tilt" onMouseMove={tiltMove} onMouseLeave={tiltOut}>
              <p><Stethoscope size={16} style={{ verticalAlign: -3 }} /> Free for personal use. No ads, no card. Bring one old prescription today — feel the calm by tonight’s dose.</p>
              <Btn href="/account/signup" variant="light">Join HealthHub</Btn>
              <p className="cta__tiny"><Pill size={11} style={{ verticalAlign: -1 }} /> EN · සිං · தமிழ் · Encrypted by default</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__mark" aria-hidden="true">HealthHub</div>
          <div className="footer__inner">
            <div className="footer__brand">
              <Link href="/" className="nav__brand" style={{ color: "#fff" }}>
                <img className="brand-mark" src="/assets/logo.svg" alt="" /><span>HealthHub</span>
              </Link>
              <p>A private health companion, crafted in Colombo. Records, medicines, family and AI — designed to disappear into the day, so care feels human again.</p>
            </div>
            <div className="footer__links">
              <div><span>Explore</span><a href="#record">The record</a><a href="#how">How it works</a><a href="#ai">Health AI</a><a href="#pricing">Pricing</a></div>
              <div><span>Company</span><a href="mailto:hello@healthhub.app">Contact</a><a href="/login">Log in</a><a href="/account/signup">Join beta</a></div>
              <div><span>Legal</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="#security">Security</a></div>
            </div>
            <div className="footer__bottom">
              <span>© 2026 HealthHub · Colombo, Sri Lanka</span>
              <span>HARBOR LAPIS · FRAUNCES + BRICOLAGE · EN · සිං · த</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
