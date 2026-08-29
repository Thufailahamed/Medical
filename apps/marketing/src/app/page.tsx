"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { LivingTimeline } from "../components/living-timeline";
import { AssayFigure, ContentsLedger, DayStrip, PulseTrace, VitalsTape } from "../components/journal-pieces";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
];

const FEATURES = [
  {
    number: "01",
    kicker: "The record",
    title: "A living history, not a pile of files.",
    body: "Bring lab reports, prescriptions, discharge summaries, and vaccination cards into one private timeline. HealthHub makes the details findable when they matter.",
    tone: "paper",
  },
  {
    number: "02",
    kicker: "The routine",
    title: "Care that fits around real life.",
    body: "Quiet reminders follow your day, refill alerts arrive before the last tablet, and family profiles keep the people you care about close without the nagging.",
    tone: "ember",
  },
  {
    number: "03",
    kicker: "The conversation",
    title: "Answers with your context attached.",
    body: "Ask about a result in plain language. Health AI reads your records and shows its work, so you can have a better conversation with your clinician.",
    tone: "ink",
  },
];

const JOBS = [
  ["Stay on top of medicines", "Reminders meet you at breakfast, after lunch, or before bed. Refill alerts arrive with enough time to act."],
  ["See the change over time", "A single number rarely tells the whole story. HealthHub places results beside the history that gives them meaning."],
  ["Arrive prepared", "Create a structured, one-time share link with the records and summary your clinician needs for a better visit."],
];

const FAQS = [
  ["Is my data really private?", "Your records are encrypted at rest, scoped per account, and never sold or used to train AI models. You can export or delete everything from settings."],
  ["Do I need a Sri Lankan phone number?", "No. HealthHub works anywhere. We started in Sri Lanka because that is where we first saw the problem, but the app is built for anyone caring for a complicated health history."],
  ["How does the lab explainer work?", "Health AI uses your recorded values and a medical reference to explain patterns in plain language. It is not a doctor, and it clearly tells you when to speak with one."],
  ["Can my family see my records?", "Only when you invite them. Sharing is opt-in and you decide which profile or records are visible. Access can be revoked at any time."],
  ["Do you support Sinhala and Tamil?", "Yes. The app, reminders, and summaries are available in English, සිංහල, and தமிழ்."],
];

const TIERS = [
  { name: "Personal", price: "Free", detail: "For your own health history", items: ["Two profiles", "Unlimited records & medicines", "14-day medicine reminders", "10 AI summaries each month"], href: "/account/signup" },
  { name: "Plus", price: "LKR 1,500", detail: "For families who look after each other", items: ["Everything in Personal", "Unlimited profiles", "Caregiver & family sharing", "Unlimited AI summaries", "Doctor-ready share links"], href: "/account/signup?plan=plus", featured: true },
  { name: "Clinic", price: "Custom", detail: "For practices and labs", items: ["Everything in Plus", "Direct result push & API", "Bulk seat management", "Audit log & SSO", "Dedicated success manager"], href: "mailto:hello@healthhub.app" },
];

function Mark({ small = false }: { small?: boolean }) {
  return <img className={`brand-mark ${small ? "brand-mark--small" : ""}`} src="/assets/logo.svg" alt="" />;
}

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openJob, setOpenJob] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const paint = () => {
      const rect = hero.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight, 1);
      const progress = reduce ? 0 : Math.max(0, Math.min(1, -rect.top / travel));
      hero.style.setProperty("--hero-x", `${pointerX}px`);
      hero.style.setProperty("--hero-y", `${pointerY}px`);
      hero.style.setProperty("--hero-progress", `${progress}`);
      frame = 0;
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(paint); };
    const onPointerMove = (event: PointerEvent) => {
      if (reduce || window.matchMedia("(pointer: coarse)").matches) return;
      pointerX = (event.clientX / window.innerWidth - 0.5) * 16;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 12;
      schedule();
    };
    const onPointerLeave = () => { pointerX = 0; pointerY = 0; schedule(); };
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`root ${ready ? "is-ready" : ""}`}>
      <a className="skip" href="#hero-title">Skip to content</a>
      <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="nav__inner">
          <Link href="/" className="nav__brand" onClick={() => setMenuOpen(false)}><Mark /><span>HealthHub</span></Link>
          <nav className="nav__links" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href} className="nav__link">{link.label}</a>)}
          </nav>
          <div className="nav__actions">
            <a href="/login" className="nav__signin">Log in</a>
            <a href="#cta" className="nav__cta">Join the beta <ArrowUpRight size={15} /></a>
            <button className="nav__menu" type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" className="nav__mobile" aria-label="Mobile navigation">
          {NAV_LINKS.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={16} /></a>)}
          <a href="/login" onClick={() => setMenuOpen(false)}>Log in<ArrowUpRight size={16} /></a>
        </nav>}
      </header>

      <main>
        <section ref={heroRef} className="hero" aria-labelledby="hero-title">
          <div className="hero__stage">
            <div className="hero__grid" aria-hidden="true" />
            <div className="hero__grain" aria-hidden="true" />
            <div className="hero__rail" aria-hidden="true"><span>Vol. 01</span><i /><span>Personal health journal</span><i /><span>2026</span></div>
            <div className="container hero__inner">
              <div className="hero__copy">
                <p className="masthead"><span>Vol. 01</span><span>Issue 08</span><span>Colombo</span><span>ISSN-HH 2026</span></p>
                <p className="eyebrow"><span className="eyebrow__dot" /> Private beta · built in Colombo</p>
                <h1 id="hero-title">Your health,<br />finally <em>together.</em></h1>
                <p className="hero__lede">HealthHub gathers the small things that shape your care, then gives them back in the right order: what happened, what matters today, and what to ask next.</p>
                <div className="hero__actions">
                  <a href="/account/signup" className="button button--ember">Join the private beta <ArrowUpRight size={17} /></a>
                  <a href="#product" className="button button--text">Enter the record <ArrowDown size={16} /></a>
                </div>
                <div className="hero__meta"><span><ShieldCheck size={15} /> Private by default</span><span>Free for personal use</span></div>
              </div>
              <LivingTimeline />
            </div>
            <div className="hero__foot container">
              <PulseTrace />
              <span>Scroll to enter the timeline <ArrowDown size={14} /></span>
            </div>
          </div>
        </section>

        <section className="signal" aria-label="Current health values">
          <VitalsTape />
        </section>

        <section className="section atlas" id="product">
          <div className="container">
            <div className="section__intro" data-reveal><p className="eyebrow">A personal health atlas</p><h2>Nothing important<br /><em>gets lost.</em></h2><p>Health is a collection of small details. HealthHub gives each one a place, then connects the dots quietly in the background.</p></div>
            <div className="atlas__feature" data-reveal>
              <div className="atlas__copy"><span className="section__index">01 — records</span><h3>Your history has a shape.</h3><p>Lab results, prescriptions, hospital visits, and vaccinations become one searchable timeline. The next appointment starts with the whole picture, not a blank page.</p><a href="#how" className="inline-link">See the simple rhythm <ArrowUpRight size={15} /></a></div>
              <div className="atlas__image">
                <AssayFigure />
                <span>Fig. 02<br />the assay</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section medicine" aria-labelledby="medicine-title">
          <div className="container medicine__inner" data-reveal>
            <div className="medicine__image">
              <div className="dose-sheet">
                <div className="dose-sheet__top"><span>Daily routine</span><span>Thu 04 Aug</span></div>
                <h3>Evening</h3>
                <DayStrip />
                <div className="dose-sheet__dose dose-sheet__dose--done"><span className="dose-sheet__check">✓</span><div><strong>Vitamin D3</strong><small>1 tablet · after breakfast</small></div><time>08:00</time></div>
                <div className="dose-sheet__dose dose-sheet__dose--next"><span className="dose-sheet__check">○</span><div><strong>Paracetamol 500mg</strong><small>1 tablet · after food</small></div><time>20:00</time></div>
                <div className="dose-sheet__dose"><span className="dose-sheet__check">○</span><div><strong>Metformin 500mg</strong><small>1 tablet · with water</small></div><time>22:00</time></div>
                <div className="dose-sheet__footer"><span>2 of 3 doses</span><div><i /></div><span>on track</span></div>
              </div>
            </div>
            <div className="medicine__copy"><span className="section__index">02 — medicines</span><h2 id="medicine-title">The right nudge.<br /><em>Never the noise.</em></h2><p>Medication is part of a day, not the whole day. HealthHub learns the rhythm you already have and places a gentle reminder inside it.</p><div className="medicine__note"><span className="medicine__note-mark">✓</span><div><strong>Tonight, 8:00 PM</strong><span>Paracetamol · after food</span></div></div><a href="/account/signup" className="inline-link">Make room for the important things <ArrowUpRight size={15} /></a></div>
          </div>
        </section>

        <section className="section workflow" id="how">
          <div className="container"><div className="section__intro section__intro--wide" data-reveal><p className="eyebrow">The rhythm</p><h2>Capture. Understand. <em>Move forward.</em></h2><p>A calmer health system is not another thing to manage. It is the thing that gives you back some attention.</p></div><ContentsLedger /></div>
        </section>

        <section className="section features" aria-labelledby="features-title">
          <div className="container"><div className="features__heading" data-reveal><p className="eyebrow eyebrow--light">The useful parts</p><h2 id="features-title">Small moments,<br /><em>handled well.</em></h2></div><div className="features__grid" data-reveal data-stagger>{FEATURES.map((feature) => <article className={`feature feature--${feature.tone}`} key={feature.number}><span className="feature__number">{feature.number}</span><span className="feature__kicker">{feature.kicker}</span><h3>{feature.title}</h3><p>{feature.body}</p><div className="feature__mark"><span /><span /><span /></div></article>)}</div></div>
        </section>

        <section className="section ai" id="ai">
          <div className="container ai__inner" data-reveal><div className="ai__copy"><p className="eyebrow eyebrow--light">Health AI</p><h2>A second pair of eyes, <em>with your records open.</em></h2><p>Ask about a trend, a result, or what to bring to your next appointment. Health AI answers from your history, cites the relevant record, and tells you when a clinician should take over.</p><a href="/account/signup" className="button button--light">Explore Health AI <ArrowUpRight size={17} /></a></div><div className="ai__conversation"><div className="conversation__bar"><span>Health AI</span><span>Grounded in your data</span></div><div className="conversation__question">My HbA1c has been creeping up. What should I ask my doctor?</div><div className="conversation__answer"><span className="conversation__avatar">AI</span><div><p>Your last three readings are 6.1 → 6.4 → <strong>6.8%</strong>.</p><p>That is a pattern worth discussing with your GP. I can prepare a short summary of the dates, results, and medicines around each test.</p><small>Sources: 3 lab records · 1 medicine record</small></div></div></div></div>
        </section>

        <section className="section jobs" aria-labelledby="jobs-title">
          <div className="container jobs__inner"><div className="jobs__heading" data-reveal><p className="eyebrow">For real life</p><h2 id="jobs-title">You keep living.<br /><em>We keep the thread.</em></h2></div><div className="jobs__content" data-reveal><div className="jobs__tabs" role="tablist" aria-label="HealthHub benefits">{JOBS.map(([title], i) => <button key={title} id={`job-tab-${i}`} role="tab" aria-selected={openJob === i} aria-controls={`job-panel-${i}`} className={openJob === i ? "is-active" : ""} onClick={() => setOpenJob(i)}><span>0{i + 1}</span>{title}</button>)}</div><div className="jobs__panel" id={`job-panel-${openJob}`} role="tabpanel" aria-labelledby={`job-tab-${openJob}`} key={openJob}><Sparkles size={21} /><h3>{JOBS[openJob][0]}</h3><p>{JOBS[openJob][1]}</p><a href="#cta" className="inline-link">Start with your own history <ArrowUpRight size={15} /></a></div></div></div>
        </section>

        <section className="section security" id="security"><div className="container security__inner"><div data-reveal><p className="eyebrow eyebrow--invert">Trust, by design</p><h2>Private enough<br /><em>for your real life.</em></h2></div><div className="security__list" data-reveal data-stagger><div><ShieldCheck size={21} /><h3>Encrypted by default</h3><p>Your records are protected at rest and in transit.</p></div><div><Check size={21} /><h3>Sharing is yours</h3><p>Invite someone, choose what they see, revoke access whenever you want.</p></div><div><ArrowDown size={21} /><h3>Take it with you</h3><p>Export or delete your information from your account settings.</p></div></div></div></section>

        <section className="section pricing" id="pricing"><div className="container"><div className="section__intro section__intro--center" data-reveal><p className="eyebrow">Simple pricing</p><h2>Care should not<br /><em>come with ads.</em></h2><p>Start free. Stay free if that is all you need. Plus is for the families who share the work.</p></div><div className="pricing__grid" data-reveal data-stagger>{TIERS.map((tier) => <article key={tier.name} className={`price ${tier.featured ? "price--featured" : ""}`}>{tier.featured && <span className="price__badge">Most popular</span>}<span className="price__name">{tier.name}</span><p>{tier.detail}</p><strong>{tier.price}</strong>{tier.name === "Plus" && <small>per year</small>}<ul>{tier.items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul><a href={tier.href} className={`button ${tier.featured ? "button--ember" : "button--outline"}`}>{tier.name === "Clinic" ? "Talk to us" : tier.name === "Plus" ? "Start Plus" : "Get started"}<ArrowUpRight size={16} /></a></article>)}</div></div></section>

        <section className="section faq" id="faq"><div className="container faq__inner"><div className="section__intro" data-reveal><p className="eyebrow">Questions, answered</p><h2>No mystery<br /><em>in the fine print.</em></h2></div><div className="faq__list" data-reveal>{FAQS.map(([question, answer], i) => { const open = openFaq === i; return <div className={`faq__item ${open ? "is-open" : ""}`} key={question}><button aria-expanded={open} aria-controls={`faq-answer-${i}`} onClick={() => setOpenFaq(open ? null : i)}><span>{question}</span><ChevronDown size={19} /></button><div className="faq__drawer" id={`faq-answer-${i}`} role="region" aria-hidden={!open}><div className="faq__answer"><p>{answer}</p></div></div></div>; })}</div></div></section>

        <section className="cta" id="cta"><div className="cta__orb" aria-hidden="true" /><div className="container cta__inner" data-reveal><div><p className="eyebrow eyebrow--light">Private beta · now welcoming new members</p><h2>Put the whole story<br />in <em>one place.</em></h2></div><div className="cta__action"><p>HealthHub is free for personal use. No ads, no credit card, no medical jargon between you and your own information.</p><a href="/account/signup" className="button button--light">Join HealthHub <ArrowUpRight size={17} /></a></div></div></section>
      </main>

      <footer className="footer"><div className="container footer__inner"><div className="footer__brand"><Link href="/" className="nav__brand"><Mark small /><span>HealthHub</span></Link><p>A private health companion, built quietly in Colombo for the way you actually look after the people you love.</p></div><div className="footer__links"><div><span>Explore</span><a href="#product">Product</a><a href="#how">How it works</a><a href="#pricing">Pricing</a></div><div><span>Company</span><a href="mailto:hello@healthhub.app">Contact</a><a href="/login">Log in</a></div><div><span>Legal</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="#security">Security</a></div></div><div className="footer__bottom"><span>© 2026 HealthHub · Colombo, Sri Lanka</span><span>EN · සිං · த · Encrypted by default</span></div></div></footer>
    </div>
  );
}
