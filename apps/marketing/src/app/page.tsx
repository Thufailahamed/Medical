"use client";

import "./home.css";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BellRing,
  CalendarCheck,
  Check,
  FileSearch,
  FileText,
  HeartPulse,
  Menu,
  Plus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

/* ------------------------------- content ------------------------------- */

const NAV_LINKS = [
  { label: "The record", href: "#record" },
  { label: "How it works", href: "#how" },
  { label: "Health AI", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
];

const HOSPITALS = ["Asiri Health", "Nawaloka", "Durdans", "Lanka Hospitals", "Hemas", "Ninewells"];

const TAPE = [
  ["HbA1c", "6.1%", "in range"],
  ["Blood pressure", "122/78", "this morning"],
  ["Next dose", "8:00 PM", "after rice"],
  ["Visit", "Tue 09:30", "Dr. Perera"],
  ["Records", "148", "indexed"],
  ["Family", "5 profiles", "shared on purpose"],
] as const;

const FILM = [
  { src: "/assets/insurance/plan-types/insurance-family.jpg", cap: "Sunday with the boys" },
  { src: "/assets/brand/harbor-hands.png", cap: "Amma’s reports, read together" },
  { src: "/assets/insurance/plan-types/insurance-senior.jpg", cap: "The appointment, prepared" },
  { src: "/assets/brand/harbor-still-life.png", cap: "What used to live in a drawer" },
  { src: "/assets/insurance/plan-types/insurance-maternity.jpg", cap: "The first file that matters" },
  { src: "/assets/insurance/hero.jpg", cap: "Private by construction" },
];

const JOBS = [
  {
    id: "timeline",
    num: "01",
    tag: "The timeline",
    variant: "hx-card--dark",
    title: <>A record that reads <em>like a letter.</em></>,
    body: "Labs, prescriptions and visits land in date order — searchable in English, Sinhala or Tamil. No more hunting through WhatsApp the night before a visit.",
    points: ["OCR in English, Sinhala and Tamil — including the messy ones", "PDF to structured values: dates, doses, units, searchable", "Offline-ready on your phone — the story travels with you"],
    mini: "timeline" as const,
  },
  {
    id: "meds",
    num: "02",
    tag: "Medication",
    variant: "hx-card--mint",
    title: <>The nudge before <em>the last tablet.</em></>,
    body: "Doses slide into breakfast, lunch and bedtime. Refill alerts arrive while the bottle still has weight. Never a siren. Never a nag.",
    points: ["Gentle dose windows that follow your meals, not the clock", "Refill warnings days before you run out", "One-tap taken / skipped — adherence that writes itself"],
    mini: "meds" as const,
  },
  {
    id: "family",
    num: "03",
    tag: "Family",
    variant: "hx-card--light",
    title: <>Look after everyone <em>from one login.</em></>,
    body: "Five profiles. Granular sharing. Watch over elders from London or Dehiwala — with permission, always, and a revoke that actually works.",
    points: ["Per-person scopes: labs only, meds only, or everything", "Instant revoke — access ends the moment you say so", "Built for the diaspora keeping care going from abroad"],
    mini: "family" as const,
  },
  {
    id: "share",
    num: "04",
    tag: "Doctor-ready",
    variant: "hx-card--lapis",
    title: <>Walk in with the story <em>already written.</em></>,
    body: "One tap makes an expiring doctor link: summary, selected records, nothing extra. You see the moment it was opened.",
    points: ["Expiring links — 24 or 48 hours, then they vanish", "Open receipts: know when the doctor read it", "AI-drafted questions attached, cited to your records"],
    mini: "share" as const,
  },
];

const FAQS = [
  ["Is my data really private?", "Yes. Records are encrypted in transit and at rest, scoped strictly to your account, and never sold. AI never trains on your data. Export or delete everything from Settings."],
  ["Do I need a Sri Lankan number?", "No. HealthHub works worldwide. We started in Colombo — so Sinhala, Tamil and English are first-class — but anyone with a complex health history can use it."],
  ["What does Health AI actually do?", "It reads your uploaded labs, prescriptions and vitals, explains trends in plain language, cites the exact record it used, and drafts questions for your doctor. It never diagnoses — and it tells you when to see a clinician."],
  ["Can my family use it with me?", "Yes. Invite parents, kids or a caregiver, choose exactly what each person sees, and revoke access in one tap. Built for looking after elders from abroad."],
  ["Can I share with my doctor?", "One tap creates a secure, expiring link with a clean summary and selected records. No login needed for your doctor. You see when it was opened."],
] as const;

const TIERS = [
  { name: "Personal", price: "Free", per: "forever", detail: "Your own health, kept properly.", items: ["2 profiles", "Unlimited records & medicines", "Smart reminders (14-day)", "10 AI summaries / month"], href: "/account/signup", cta: "Get started" },
  { name: "Plus", price: "LKR 1,500", per: "per year", detail: "For families who share the work.", items: ["Everything in Personal", "Unlimited profiles + sharing", "Unlimited AI summaries", "Doctor-ready share links", "Priority support"], href: "/account/signup?plan=plus", cta: "Start Plus", featured: true },
  { name: "Clinic", price: "Custom", per: "for practices & labs", detail: "Push results straight to patients.", items: ["Everything in Plus", "Direct result push + API", "Seats, audit log & SSO", "Dedicated success manager"], href: "mailto:hello@healthhub.app", cta: "Talk to us" },
];

const STATS = [
  { value: 62, prefix: "−", suffix: "%", decimals: 0, label: "Less time hunting for old reports before appointments" },
  { value: 4.2, prefix: "", suffix: "×", decimals: 1, label: "More consistent evening doses with gentle reminders" },
  { value: 89, prefix: "", suffix: "%", decimals: 0, label: "Said the doctor visit felt more prepared with a share link" },
  { value: 100, prefix: "", suffix: "%", decimals: 0, label: "Data exportable and deletable — no lock-in, ever" },
];

/* ------------------------------- helpers ------------------------------- */

function finePointer() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* cursor-tracked spotlight for cards */
function spotMove(e: MouseEvent<HTMLElement>) {
  if (!finePointer()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--sx", `${e.clientX - r.left}px`);
  el.style.setProperty("--sy", `${e.clientY - r.top}px`);
}

/* deterministic drifting motes for the hero */
const PARTICLES: CSSProperties[] = Array.from({ length: 14 }, (_, i) => {
  const rnd = (n: number) => {
    const v = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    "--px": `${(rnd(1) * 94 + 3).toFixed(2)}%`,
    "--py": `${(rnd(2) * 80 + 8).toFixed(2)}%`,
    "--ps": `${(2 + rnd(3) * 3.5).toFixed(1)}px`,
    "--pd": `${(10 + rnd(4) * 12).toFixed(1)}s`,
    "--pdel": `${(-rnd(5) * 18).toFixed(1)}s`,
    "--pdx": `${(rnd(6) * 70 - 35).toFixed(0)}px`,
  } as unknown as CSSProperties;
});

function useHxReveal(armed: boolean) {
  useEffect(() => {
    if (!armed) return;
    const revealEls = Array.from(document.querySelectorAll("[data-hxreveal]"));
    const litEls = Array.from(document.querySelectorAll("[data-hxlit]"));
    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((e) => e.classList.add("is-in"));
      litEls.forEach((e) => e.classList.add("is-lit"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          if (el.hasAttribute("data-hxlit")) el.classList.add("is-lit");
          else el.classList.add("is-in");
          io.unobserve(el);
        }),
      { threshold: 0.12, rootMargin: "0px 0px 8% 0px" },
    );
    [...revealEls, ...litEls].forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [armed]);
}

function useCount(target: number, active: boolean, decimals: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setN(target));
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);
  return n.toFixed(decimals);
}

function Stat({ value, prefix, suffix, decimals, label }: (typeof STATS)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const shown = useCount(value, on, decimals);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setOn(true); }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="hx-stat" ref={ref} onMouseMove={spotMove}>
      <i className="hx-spot" aria-hidden="true" />
      <span className="hx-stat__num">{prefix}{shown}<sup>{suffix}</sup></span>
      <p>{label}</p>
    </div>
  );
}

function magnetic(e: MouseEvent<HTMLAnchorElement>) {
  if (!finePointer()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
  el.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
  el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
}
function magneticOut(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.setProperty("--mx", "0px");
  e.currentTarget.style.setProperty("--my", "0px");
}

function HxBtn({
  href,
  variant = "primary",
  size,
  children,
  icon,
}: {
  href: string;
  variant?: "primary" | "ghost" | "light" | "onlight";
  size?: "sm";
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`hx-btn hx-btn--${variant}${size ? ` hx-btn--${size}` : ""}`}
      onMouseMove={magnetic}
      onMouseLeave={magneticOut}
    >
      <span>{children}</span>
      <span className="hx-btn__glyph">{icon ?? <ArrowRight size={16} />}</span>
    </a>
  );
}

/* --------------------------- cursor + loader --------------------------- */

function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!finePointer()) return;
    const root = ref.current;
    if (!root) return;
    const glow = root.querySelector<HTMLElement>(".hx-cursor__glow");
    const ring = root.querySelector<HTMLElement>(".hx-cursor__ring");
    const dot = root.querySelector<HTMLElement>(".hx-cursor__dot");
    if (!glow || !ring || !dot) return;
    let mx = -100, my = -100;
    let gx = -100, gy = -100, rx = -100, ry = -100;
    const onMove = (e: globalThis.MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const onOver = (e: globalThis.MouseEvent) => {
      const t = e.target as HTMLElement | null;
      root.classList.toggle("is-hover", !!t?.closest("a, button, [role='tab']"));
    };
    let raf = 0;
    const loop = () => {
      gx += (mx - gx) * 0.07; gy += (my - gy) * 0.07;
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      glow.style.transform = `translate(${gx - 170}px, ${gy - 170}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);
  return (
    <div className="hx-cursor" ref={ref} aria-hidden="true">
      <div className="hx-cursor__glow" />
      <div className="hx-cursor__ring" />
      <div className="hx-cursor__dot" />
    </div>
  );
}

function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const start = performance.now();
    const dur = 1150;
    let raf = 0;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 2.4))));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setLeaving(true);
        doneRef.current();
        try { sessionStorage.setItem("hh_booted", "1"); } catch { /* private mode */ }
        t2 = setTimeout(() => { /* unmount handled by parent */ }, 0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (t2) clearTimeout(t2); };
  }, []);

  return (
    <div className={`hx-loader ${leaving ? "is-done" : ""}`} aria-hidden="true">
      <div className="hx-loader__inner">
        <img className="hx-loader__mark" src="/assets/logo.svg" alt="" />
        <div className="hx-loader__word">
          {"HEALTHHUB".split("").map((c, i) => (
            <span key={i} style={{ animationDelay: `${0.05 + i * 0.045}s` }}>{c}</span>
          ))}
        </div>
        <div className="hx-loader__bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></div>
        <span className="hx-loader__pct">{pct}%</span>
      </div>
    </div>
  );
}

/* ------------------------------ job minis ------------------------------ */

function JobMini({ kind }: { kind: (typeof JOBS)[number]["mini"] }) {
  if (kind === "timeline") {
    return (
      <div className="hx-mini">
        <div className="hx-mini__bar"><b>Timeline</b><span>148 records</span></div>
        <div className="hx-mini__row hx-mini__row--hi">
          <span className="hx-mini__dot" style={{ background: "#39d6c0" }} />
          <div><span className="hx-mini__k">HbA1c · Asiri Central</span><span className="hx-mini__v">6.1% — in range</span></div>
          <span className="hx-mini__meta">12 Mar</span>
        </div>
        <div className="hx-mini__row">
          <span className="hx-mini__dot" style={{ background: "#7eb0ff" }} />
          <div><span className="hx-mini__k">Prescription · Dr. Perera</span><span className="hx-mini__v">Metformin 500mg</span></div>
          <span className="hx-mini__meta">02 Mar</span>
        </div>
        <div className="hx-mini__row">
          <span className="hx-mini__dot" style={{ background: "#c9a557" }} />
          <div><span className="hx-mini__k">Vaccine · Ninewells</span><span className="hx-mini__v">Influenza 2026</span></div>
          <span className="hx-mini__meta">18 Feb</span>
        </div>
        <div className="hx-mini__foot"><span>සිං · தமிழ் · EN</span><span>searchable</span></div>
      </div>
    );
  }
  if (kind === "meds") {
    return (
      <div className="hx-mini">
        <div className="hx-mini__bar"><b>Tonight</b><span>2 / 3 on track</span></div>
        <div className="hx-mini__row hx-mini__row--hi">
          <span className="hx-mini__avatar"><BellRing size={13} /></span>
          <div><span className="hx-mini__k">8:00 PM · after food</span><span className="hx-mini__v">Paracetamol 500</span></div>
          <span className="hx-mini__meta">due</span>
        </div>
        <div className="hx-mini__row">
          <span className="hx-mini__avatar"><Check size={13} /></span>
          <div><span className="hx-mini__k">Breakfast</span><span className="hx-mini__v">Metformin 500mg</span></div>
          <span className="hx-mini__meta">done</span>
        </div>
        <div className="hx-mini__row">
          <span className="hx-mini__avatar"><Sparkles size={13} /></span>
          <div><span className="hx-mini__k">Refill</span><span className="hx-mini__v">Metformin · 5 days left</span></div>
          <span className="hx-mini__meta">Thu</span>
        </div>
        <div className="hx-mini__foot"><span>never a siren</span><span>never a nag</span></div>
      </div>
    );
  }
  if (kind === "family") {
    return (
      <div className="hx-mini">
        <div className="hx-mini__bar"><b>Family</b><span>5 profiles</span></div>
        {[
          ["AM", "Amma", "BP 128/82 · labs + meds"],
          ["AP", "Appa", "HbA1c 6.8 · all shared"],
          ["NI", "Nimal", "Vaccines · paediatric"],
        ].map(([ini, n, s], i) => (
          <div className={`hx-mini__row ${i === 0 ? "hx-mini__row--hi" : ""}`} key={n}>
            <span className="hx-mini__avatar">{ini}</span>
            <div><span className="hx-mini__k">{s}</span><span className="hx-mini__v">{n}</span></div>
            <span className="hx-mini__meta"><ShieldCheck size={11} /></span>
          </div>
        ))}
        <div className="hx-mini__foot"><span>revoke in one tap</span><span>audit log on</span></div>
      </div>
    );
  }
  return (
    <div className="hx-mini">
      <div className="hx-mini__bar"><b>Share link</b><span>expires 48h</span></div>
      <div className="hx-mini__row hx-mini__row--hi">
        <span className="hx-mini__avatar"><FileText size={13} /></span>
        <div><span className="hx-mini__k">Dr. Perera pack</span><span className="hx-mini__v">3 labs · 1 prescription</span></div>
        <span className="hx-mini__meta">14:03</span>
      </div>
      <div className="hx-mini__row">
        <span className="hx-mini__avatar"><ScanLine size={13} /></span>
        <div><span className="hx-mini__k">Opened</span><span className="hx-mini__v">Durdans · today 14:03</span></div>
        <span className="hx-mini__meta">seen</span>
      </div>
      <div className="hx-mini__row">
        <span className="hx-mini__avatar"><Sparkles size={13} /></span>
        <div><span className="hx-mini__k">Attached</span><span className="hx-mini__v">3 AI questions, cited</span></div>
        <span className="hx-mini__meta">AI</span>
      </div>
      <div className="hx-mini__foot"><span>no login for doctor</span><span>auto-expires</span></div>
    </div>
  );
}

/* -------------------------------- page --------------------------------- */

export default function HomePage() {
  const [booted, setBooted] = useState(false);
  const [loaderGone, setLoaderGone] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLButtonElement>(null);

  useHxReveal(booted);

  // nav link follows the section in view
  useEffect(() => {
    if (!booted || !("IntersectionObserver" in window)) return;
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".hx-nav__link"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((l) => l.classList.toggle("is-active", l.hash === `#${en.target.id}`));
        }),
      { rootMargin: "-38% 0px -52% 0px" },
    );
    NAV_LINKS.forEach(({ href }) => {
      const s = document.getElementById(href.slice(1));
      if (s) io.observe(s);
    });
    return () => io.disconnect();
  }, [booted]);

  // boot sequence (skip on repeat visits in the same session / reduced motion)
  useEffect(() => {
    let skipped = false;
    try { skipped = sessionStorage.getItem("hh_booted") === "1"; } catch { /* ignore */ }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = requestAnimationFrame(() => {
      if (skipped || reduce) {
        setBooted(true);
      } else {
        setLoaderGone(false);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // unmount loader after curtain transition
  useEffect(() => {
    if (!booted || loaderGone) return;
    const t = setTimeout(() => setLoaderGone(true), 1000);
    return () => clearTimeout(t);
  }, [booted, loaderGone]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, y / max) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`;
      if (topRef.current) {
        topRef.current.classList.toggle("is-show", y > 640);
        const ring = topRef.current.querySelector<SVGCircleElement>(".hx-top__ring");
        if (ring) ring.style.strokeDashoffset = `${100.5 * (1 - p)}`;
      }
      const hero = heroRef.current;
      if (hero && y < hero.offsetHeight) {
        hero.style.setProperty("--hy", `${Math.min(y, 900) * 0.16}px`);
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const onHeroMove = (e: MouseEvent<HTMLElement>) => {
    if (!finePointer()) return;
    const stage = stageRef.current;
    const hero = heroRef.current;
    if (!stage || !hero) return;
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty("--sry", `${x * 9}deg`);
    stage.style.setProperty("--srx", `${y * -7}deg`);
  };
  const onHeroLeave = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--srx", "0deg");
    stage.style.setProperty("--sry", "0deg");
  };

  const onCtaMove = (e: MouseEvent<HTMLElement>) => {
    if (!finePointer()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--cx", `${e.clientX - r.left}px`);
    el.style.setProperty("--cy", `${e.clientY - r.top}px`);
  };

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`home ${booted ? "is-live" : ""}`}>
      <a className="hx-skip" href="#main">Skip to content</a>
      {!loaderGone && <Loader onDone={() => setBooted(true)} />}
      <Cursor />
      <div className="hx-progress" aria-hidden="true"><i ref={progressRef} /></div>

      {/* floating pill nav */}
      <header className={`hx-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="hx-nav__pill">
          <Link href="/" className="hx-nav__brand" onClick={() => setMenuOpen(false)}>
            <img src="/assets/logo.svg" alt="HealthHub" />
            <span>HealthHub</span>
            <span className="hx-nav__beta">Beta</span>
          </Link>
          <nav className="hx-nav__links" aria-label="Primary">
            {NAV_LINKS.map((l) => <a key={l.href} className="hx-nav__link" href={l.href}>{l.label}</a>)}
          </nav>
          <div className="hx-nav__actions">
            <a href="/login" className="hx-nav__signin">Log in</a>
            <HxBtn href="#cta" size="sm" icon={<ArrowUpRight size={15} />}>Join the beta</HxBtn>
            <button
              className="hx-nav__menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </header>

      {/* mobile menu */}
      <div className={`hx-menu ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <nav aria-label="Mobile">
          {NAV_LINKS.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              <small>0{i + 1}</small>{l.label}
            </a>
          ))}
          <a href="/login" onClick={() => setMenuOpen(false)}><small>05</small>Log in</a>
        </nav>
      </div>

      <main id="main">
        {/* ============================== HERO ============================== */}
        <section className="hx-hero" ref={heroRef} onMouseMove={onHeroMove} onMouseLeave={onHeroLeave} aria-labelledby="hx-hero-title">
          <div className="hx-aurora hx-aurora--a" aria-hidden="true" />
          <div className="hx-aurora hx-aurora--b" aria-hidden="true" />
          <div className="hx-aurora hx-aurora--c" aria-hidden="true" />
          <div className="hx-hero__grid" aria-hidden="true" />
          <div className="hx-particles" aria-hidden="true">
            {PARTICLES.map((v, i) => (
              <i key={i} style={v} />
            ))}
          </div>

          <div className="hx-container hx-hero__inner">
            <div className="hx-hero__copy">
              <p className="hx-eyebrow"><i /> Private beta · Colombo · EN · සිංහල · தமிழ்</p>
              <h1 className="hx-hero__title" id="hx-hero-title">
                <span className="hx-line"><span>Your health has</span></span>
                <span className="hx-line"><span><em>a history.</em></span></span>
                <span className="hx-line"><span className="hx-outline">Keep it close.</span></span>
              </h1>
              <p className="hx-hero__lede">
                The prescription in your drawer. The scan on WhatsApp. The things you remember only when someone asks.
                HealthHub gives every piece a place — <b>private, readable, and doctor-ready</b> in English, Sinhala, and Tamil.
              </p>
              <div className="hx-hero__actions">
                <HxBtn href="/account/signup">Start your record</HxBtn>
                <HxBtn href="#how" variant="ghost" icon={<ArrowRight size={16} />}>See how it works</HxBtn>
              </div>
              <div className="hx-hero__meta">
                <div><b>148</b><span>records indexed</span></div>
                <div><b>03</b><span>languages, natively</span></div>
                <div><b>00</b><span>ads, ever</span></div>
                <div><b>3.8s</b><span>paper → digital</span></div>
              </div>
            </div>

            <div className="hx-hero__stage" aria-label="A preview of the living HealthHub record">
              <div className="hx-hero__stage-inner" ref={stageRef}>
                <svg className="hx-ring-text" viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <path id="hx-circle" d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" />
                  </defs>
                  <circle cx="100" cy="100" r="78" />
                  <text><textPath href="#hx-circle">private by design · crafted in colombo · සිං · த ·</textPath></text>
                </svg>

                <div className="hx-hero__photo" aria-hidden="true">
                  <img src="/assets/brand/harbor-hands.png" alt="" />
                  <span>Colombo · the kitchen table</span>
                </div>

                <article className="hx-spec">
                  <div className="hx-spec__head">
                    <div className="hx-spec__id">
                      <span className="hx-spec__avatar">AP</span>
                      <div><b>Amara Perera</b><small>Colombo 07 · O+ · 52y</small></div>
                    </div>
                    <span className="hx-spec__live"><i /> Live</span>
                  </div>
                  <div className="hx-spec__metric">
                    <div>
                      <small>HbA1c · Durdans · 3 tests / 14 mo</small>
                      <b>6.1<em>%</em></b>
                    </div>
                    <span className="hx-spec__trend">▼ 0.7 this year</span>
                  </div>
                  <div className="hx-spec__chart" aria-hidden="true">
                    <svg viewBox="0 0 220 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="hx-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#5b8cff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M 8 46 Q 60 38, 112 26 T 212 8 L 212 60 L 8 60 Z" fill="url(#hx-grad)" />
                      <path className="hx-spark-line" d="M 8 46 Q 60 38, 112 26 T 212 8" fill="none" stroke="#7eb0ff" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="8" cy="46" r="3.5" fill="#f4768a" />
                      <circle cx="112" cy="26" r="3.5" fill="#c9a557" />
                      <circle cx="212" cy="8" r="4.5" fill="#39d6c0" stroke="#0b1f3a" strokeWidth="2" />
                    </svg>
                    <div className="hx-spec__dates"><span>Aug ’25 · 6.8</span><span>Jan ’26 · 6.4</span><span>Jun ’26 · 6.1</span></div>
                  </div>
                  <div className="hx-spec__ecg" aria-hidden="true">
                    <svg viewBox="0 0 200 30" preserveAspectRatio="none">
                      <path d="M0 16h30l6-11 7 20 6-13 5 6h30l6-11 7 20 6-13 5 6h92" />
                    </svg>
                    <span className="hx-spec__bpm"><b>72</b> bpm · resting</span>
                  </div>
                </article>

                <div className="hx-chip hx-chip--a" aria-hidden="true">
                  <span className="hx-chip__icon"><BellRing size={14} /></span>
                  <span><small>Next dose</small><b>8:00 PM · after rice</b></span>
                </div>
                <div className="hx-chip hx-chip--b hx-chip--mint" aria-hidden="true">
                  <span className="hx-chip__icon"><HeartPulse size={14} /></span>
                  <span><small>Blood pressure</small><b>122/78 · this morning</b></span>
                </div>
                <div className="hx-chip hx-chip--c" aria-hidden="true">
                  <span className="hx-chip__icon"><ScanLine size={14} /></span>
                  <span><small>This week</small><b>3 papers scanned in</b></span>
                </div>
              </div>
            </div>
          </div>

          <div className="hx-container hx-hero__foot">
            <span className="hx-scroll-cue"><i /> Scroll — the story unfolds</span>
            <div className="hx-hero__hospitals" aria-label="Hospitals and labs we read">
              {HOSPITALS.map((h) => <b key={h}>{h}</b>)}
            </div>
            <span className="hx-hero__index"><b>01</b> / 06 — the record</span>
          </div>
        </section>

        {/* ========================= GIANT MARQUEE ========================= */}
        <div className="hx-marquee" aria-hidden="true">
          <div className="hx-marquee__row hx-marquee__row--l">
            {[0, 1].map((c) => (
              <span key={c}>Keep the <em>whole story</em> — keep it <em>close</em> —&nbsp;</span>
            ))}
          </div>
          <div className="hx-marquee__row hx-marquee__row--r">
            {[0, 1].map((c) => (
              <span key={c}>Health · සෞඛ්‍යය · <em>சுகம்</em> · Records · බීජ ·&nbsp;</span>
            ))}
          </div>
        </div>

        {/* ============================ MANIFESTO ============================ */}
        <section className="hx-mani" id="record" aria-label="Why HealthHub exists">
          <div className="hx-container">
            <div className="hx-mani__grid">
              {/* Left Column: Illuminated Manifesto */}
              <div className="hx-mani__left">
                <div className="hx-mani__kicker-wrap" data-hxreveal>
                  <p className="hx-mani__kicker">01 — The Record</p>
                  <span className="hx-mani__tag">Archive & Continuity</span>
                </div>

                <div className="hx-mani__headline">
                  <span className="hx-mani__line" data-hxlit>The prescription in the drawer.</span>
                  <span className="hx-mani__line" data-hxlit>The scan buried in WhatsApp.</span>
                  <span className="hx-mani__line" data-hxlit>The number you remember only when a doctor asks.</span>
                  <span className="hx-mani__line" data-hxlit>We keep the pieces — <em>so care can continue.</em></span>
                </div>

                <p className="hx-mani__desc" data-hxreveal>
                  Scattered across bedside tables, messaging apps, and memory.
                  HealthHub organizes your family’s medical history into a private,
                  chronological health vault — readable, searchable, and doctor-ready
                  in English, Sinhala and Tamil.
                </p>

                <div className="hx-mani__pills" data-hxreveal>
                  <span className="hx-mani__pill">
                    <ShieldCheck size={14} className="text-[#0284c7]" />
                    Zero-Knowledge Vault
                  </span>
                  <span className="hx-mani__pill">
                    <ScanLine size={14} className="text-[#059669]" />
                    Tri-Lingual OCR
                  </span>
                  <span className="hx-mani__pill">
                    <HeartPulse size={14} className="text-[#e11d48]" />
                    Expiring Doctor Links
                  </span>
                </div>

                <div className="hx-mani__sign" data-hxreveal>
                  <img src="/assets/logo.svg" alt="" />
                  <div>
                    <strong>HealthHub · Family Archive</strong>
                    <span>Private by construction · Est. Colombo, 2026</span>
                  </div>
                </div>
              </div>

              {/* Right Column: "The Scattered Pieces" Showcase */}
              <div className="hx-mani__showcase" data-hxreveal>
                <div className="hx-mani__showcase-head">
                  <span className="hx-mani__badge">The Scattered Pieces</span>
                  <span className="hx-mani__subbadge">Unified Timeline</span>
                </div>

                <div className="hx-pieces">
                  {/* Piece 1: The Prescription */}
                  <div className="hx-piece hx-piece--rx">
                    <div className="hx-piece__header">
                      <div className="hx-piece__meta">
                        <span className="hx-piece__rx">℞</span>
                        <div>
                          <strong>Dr. Kasun Perera, MD</strong>
                          <span>Cardiology · Asiri Central</span>
                        </div>
                      </div>
                      <span className="hx-piece__tag hx-piece__tag--green">
                        <Check size={11} /> OCR Indexed
                      </span>
                    </div>
                    <div className="hx-piece__body">
                      <div className="hx-piece__rx-item">
                        <span>Atorvastatin 20mg</span>
                        <em>1 tab nocte · 30 days</em>
                      </div>
                      <div className="hx-piece__rx-item">
                        <span>Metformin 500mg</span>
                        <em>1 tab bd pc · 60 days</em>
                      </div>
                    </div>
                  </div>

                  {/* Piece 2: The WhatsApp Scan */}
                  <div className="hx-piece hx-piece--scan">
                    <div className="hx-piece__header">
                      <div className="hx-piece__meta">
                        <div className="hx-piece__icon-thumb">
                          <FileText size={16} />
                        </div>
                        <div>
                          <strong>Chest X-Ray (PA View)</strong>
                          <span>Asiri Hospital · 2.4 MB PDF</span>
                        </div>
                      </div>
                      <span className="hx-piece__tag hx-piece__tag--blue">
                        <ScanLine size={11} /> PDF Parsed
                      </span>
                    </div>
                    <div className="hx-piece__chat-bubble">
                      <span>💬 &ldquo;Amma’s report from this morning — show to doctor&rdquo;</span>
                    </div>
                  </div>

                  {/* Piece 3: The Vital Number */}
                  <div className="hx-piece hx-piece--vitals">
                    <div className="hx-piece__header">
                      <div className="hx-piece__meta">
                        <div className="hx-piece__icon-thumb text-rose-500">
                          <HeartPulse size={16} />
                        </div>
                        <div>
                          <strong>Vitals & Critical Flags</strong>
                          <span>Recorded this week</span>
                        </div>
                      </div>
                      <span className="hx-piece__tag hx-piece__tag--purple">
                        Active Health ID
                      </span>
                    </div>
                    <div className="hx-vitals-grid">
                      <div className="hx-vital-chip">
                        <small>Blood Pressure</small>
                        <strong>122/78</strong>
                        <span>mmHg · Normal</span>
                      </div>
                      <div className="hx-vital-chip">
                        <small>HbA1c</small>
                        <strong>6.1%</strong>
                        <span>In range</span>
                      </div>
                      <div className="hx-vital-chip">
                        <small>Blood Group</small>
                        <strong>O+</strong>
                        <span>Rh positive</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integration Summary Banner */}
                <div className="hx-mani__summary">
                  <span className="hx-mani__summary-dot" />
                  <span>3 records synchronized to family profile · Ready for appointment</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== FOUR JOBS (STACK) ====================== */}
        <section className="hx-jobs" id="how" aria-label="How HealthHub works">
          <div className="hx-container">
            <div className="hx-jobs__head">
              <div data-hxreveal>
                <p className="hx-kicker">02 — How it works</p>
                <h2>Four jobs, done with <em>unreasonable care.</em></h2>
              </div>
              <p data-hxreveal style={{ ["--d" as string]: "120ms" }}>
                Not a dashboard of everything. The four jobs a family actually has,
                every week — each one finished, end to end.
              </p>
            </div>

            <div className="hx-stack">
              {JOBS.map((job, i) => (
                <div className="hx-stack__item" key={job.id} style={{ ["--i" as string]: i }}>
                  <article className={`hx-card ${job.variant}`} onMouseMove={spotMove}>
                    <i className="hx-spot" aria-hidden="true" />
                    <span className="hx-card__num" aria-hidden="true">{job.num}</span>
                    <div>
                      <span className="hx-card__tag">{job.tag}</span>
                      <h3>{job.title}</h3>
                      <p className="hx-card__body">{job.body}</p>
                      <ul className="hx-card__points">
                        {job.points.map((p) => <li key={p}><Check size={14} />{p}</li>)}
                      </ul>
                    </div>
                    <div className="hx-card__visual" aria-hidden="true">
                      <JobMini kind={job.mini} />
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= TAPE ============================= */}
        <div className="hx-tape" aria-label="Live health values">
          <div className="hx-tape__track">
            {[0, 1].map((c) => (
              <div className="hx-tape__set" key={c} aria-hidden={c === 1}>
                {TAPE.map(([k, v, n]) => (
                  <span className="hx-tape__item" key={`${c}-${k}`}>
                    <small>{k}</small><strong>{v}</strong><em>{n}</em>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ============================== AI ============================== */}
        <section className="hx-ai" id="ai" aria-labelledby="hx-ai-title">
          <div className="hx-ai__bg" aria-hidden="true" />
          <div className="hx-container hx-ai__inner">
            <div data-hxreveal>
              <p className="hx-kicker hx-kicker--dark">03 — Health AI · grounded</p>
              <h2 id="hx-ai-title">A second pair of eyes, <em>with the file open.</em></h2>
              <p className="hx-ai__lead">
                Ask in English, Sinhala or Tamil. Every answer cites the exact lab or prescription
                it came from — and says clearly when a clinician should take over.
              </p>
              <ul className="hx-ai__bullets">
                <li><span className="hx-ai__check"><Check size={12} /></span>Explains “creeping up” with dates and values, not vibes</li>
                <li><span className="hx-ai__check"><Check size={12} /></span>Drafts three sharp questions for the next visit</li>
                <li><span className="hx-ai__check"><Check size={12} /></span>Never trains on your data. Sources always shown</li>
              </ul>
              <HxBtn href="/account/signup" variant="primary" icon={<ArrowUpRight size={16} />}>Try Health AI free</HxBtn>
            </div>

            <div className="hx-chat" data-hxreveal style={{ ["--d" as string]: "140ms" }}>
              <div className="hx-chat__bar"><span>Health AI · grounded</span><span className="hx-chat__live"><i /> Live</span></div>
              <div className="hx-chat__q">Amma’s HbA1c has been creeping. What should I actually ask on Tuesday?</div>
              <div className="hx-chat__a">
                <span className="hx-chat__avatar">AI</span>
                <div>
                  <p>The last three readings are <b>6.1 → 6.4 → 6.8%</b>. That slope is worth a conversation — not a panic. I’ve drafted three questions and attached the labs plus the metformin changes around each date.</p>
                  <div className="hx-chat__srcs">
                    <span><FileText size={9} /> 3 lab records</span>
                    <span><FileText size={9} /> 1 prescription</span>
                    <span><ShieldCheck size={9} /> cited inline</span>
                  </div>
                </div>
              </div>
              <div className="hx-chat__typing" aria-hidden="true"><i /><i /><i /></div>
            </div>
          </div>
        </section>

        {/* ============================= FILM ============================= */}
        <section className="hx-film" aria-label="Life around the record">
          <div className="hx-container hx-film__head">
            <div data-hxreveal>
              <p className="hx-kicker">04 — Field notes</p>
              <h2>Made for the people who <em>keep the story.</em></h2>
            </div>
            <p data-hxreveal style={{ ["--d" as string]: "120ms" }}>
              Built in Colombo, for records that have travelled farther than they should have to.
            </p>
          </div>
          <div className="hx-film__track" aria-hidden="true">
            {[0, 1].map((c) => (
              <div className="hx-film__set" key={c}>
                {FILM.map((f) => (
                  <div className="hx-film__card" key={`${c}-${f.cap}`}>
                    <img src={f.src} alt="" />
                    <span>{f.cap}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ============================= STATS ============================= */}
        <section className="hx-stats" aria-label="Outcomes from the beta">
          <div className="hx-container">
            <div className="hx-sechead hx-sechead--center" data-hxreveal>
              <p className="hx-kicker" style={{ justifyContent: "center" }}>05 — From the beta</p>
              <h2>Calmer days, <em>measured.</em></h2>
            </div>
            <div className="hx-stats__grid" data-hxreveal>
              {STATS.map((s) => <Stat key={s.label} {...s} />)}
            </div>
            <p className="hx-stats__note" data-hxreveal>2,400 patients · Colombo, Kandy & the diaspora · 2026 private beta</p>
          </div>
        </section>

        {/* =========================== SECURITY =========================== */}
        <section className="hx-sec" id="security" aria-label="Security and ownership">
          <div className="hx-container">
            <div className="hx-sechead" data-hxreveal>
              <p className="hx-kicker">Private by construction</p>
              <h2>Quiet on the outside. <em>Fortified inside.</em></h2>
            </div>
            <div className="hx-sec__grid" data-hxreveal>
              <div className="hx-sec__item" onMouseMove={spotMove}>
                <i className="hx-spot" aria-hidden="true" />
                <span className="hx-sec__icon"><ShieldCheck size={19} /></span>
                <h3>Private enough for real life</h3>
                <p>Encrypted at rest and in transit. Scoped per account. Never sold, never used to train a model on your file.</p>
              </div>
              <div className="hx-sec__item" onMouseMove={spotMove}>
                <i className="hx-spot" aria-hidden="true" />
                <span className="hx-sec__icon"><FileSearch size={19} /></span>
                <h3>Invite. Limit. Revoke.</h3>
                <p>Choose exactly what family or doctors see. Expiring links, a full audit trail, no dark patterns.</p>
              </div>
              <div className="hx-sec__item" onMouseMove={spotMove}>
                <i className="hx-spot" aria-hidden="true" />
                <span className="hx-sec__icon"><CalendarCheck size={19} /></span>
                <h3>Take it with you</h3>
                <p>Full PDF and data export, or one-tap delete. Your story is yours to keep — or to leave with.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================ PRICING ============================ */}
        <section className="hx-pricing" id="pricing" aria-labelledby="hx-pricing-title">
          <div className="hx-container">
            <div className="hx-pricing__head" data-hxreveal>
              <p className="hx-kicker hx-kicker--dark" style={{ justifyContent: "center" }}>Pricing</p>
              <h2 id="hx-pricing-title">Care shouldn’t <em>come with ads.</em></h2>
              <p>Start free. Stay free if that’s all you need. Plus is for families who share the work.</p>
            </div>
            <div className="hx-pricing__grid">
              {TIERS.map((t, i) => (
                <article
                  key={t.name}
                  className={`hx-price ${t.featured ? "hx-price--featured" : ""}`}
                  data-hxreveal
                  onMouseMove={spotMove}
                  style={{ ["--d" as string]: `${i * 110}ms` }}
                >
                  <i className="hx-spot" aria-hidden="true" />
                  {t.featured && <span className="hx-price__badge">Most families</span>}
                  <span className="hx-price__name">{t.name}</span>
                  <strong className="hx-price__cost">{t.price} <small>{t.per}</small></strong>
                  <p className="hx-price__desc">{t.detail}</p>
                  <ul>{t.items.map((it) => <li key={it}><Check size={14} />{it}</li>)}</ul>
                  <HxBtn href={t.href} variant={t.featured ? "primary" : "ghost"} icon={<ArrowUpRight size={15} />}>{t.cta}</HxBtn>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== FAQ ============================== */}
        <section className="hx-faq" id="faq" aria-label="Frequently asked questions">
          <div className="hx-container hx-faq__grid">
            <div className="hx-faq__head" data-hxreveal>
              <p className="hx-kicker">Questions</p>
              <h2>No mystery in the <em>fine print.</em></h2>
              <p>Still curious? Write to <a href="mailto:hello@healthhub.app">hello@healthhub.app</a> — a human replies within a day.</p>
            </div>
            <div data-hxreveal style={{ ["--d" as string]: "120ms" }}>
              {FAQS.map(([q, a], i) => {
                const open = openFaq === i;
                return (
                  <div className={`hx-faq__item ${open ? "is-open" : ""}`} key={q}>
                    <button className="hx-faq__q" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                      <span className="hx-faq__idx">0{i + 1}</span>
                      <b>{q}</b>
                      <span className="hx-faq__icon"><Plus size={16} /></span>
                    </button>
                    <div className="hx-faq__drawer" aria-hidden={!open}>
                      <div className="hx-faq__answer"><p>{a}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================== CTA ============================== */}
        <section className="hx-cta" id="cta" aria-labelledby="hx-cta-title" onMouseMove={onCtaMove}>
          <div className="hx-cta__glow" aria-hidden="true" />
          <div className="hx-cta__spot" aria-hidden="true" />
          <div className="hx-container hx-cta__inner" data-hxreveal>
            <p className="hx-kicker hx-kicker--dark">Private beta · 500 places this season</p>
            <h2 id="hx-cta-title">Put the whole story <em>in one place.</em></h2>
            <p>
              Free for personal use. No ads, no card. Bring one old prescription today —
              feel the calm by tonight’s dose.
            </p>
            <div className="hx-cta__row">
              <HxBtn href="/account/signup" variant="light" icon={<ArrowUpRight size={16} />}>Join HealthHub</HxBtn>
              <HxBtn href="mailto:hello@healthhub.app" variant="ghost" icon={<ArrowRight size={16} />}>Talk to a human</HxBtn>
            </div>
            <p className="hx-cta__tiny">EN · සිං · த · Encrypted by default · Export anytime</p>
          </div>
        </section>
      </main>

      {/* back to top */}
      <button className="hx-top" ref={topRef} aria-label="Back to top" onClick={toTop}>
        <svg className="hx-top__dial" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="hx-top__track" cx="18" cy="18" r="16" />
          <circle className="hx-top__ring" cx="18" cy="18" r="16" />
        </svg>
        <ArrowUp size={15} />
      </button>

      {/* ============================= FOOTER ============================= */}
      <footer className="hx-footer">
        <div className="hx-container">
          <div className="hx-footer__top">
            <div className="hx-footer__brand">
              <Link href="/" className="hx-nav__brand">
                <img src="/assets/logo.svg" alt="" />
                <span>HealthHub</span>
              </Link>
              <p>
                A private health companion, crafted in Colombo. Records, medicines, family and AI —
                designed to disappear into the day, so care feels human again.
              </p>
            </div>
            <div className="hx-footer__links">
              <div>
                <span>Explore</span>
                <a href="#record">The record</a>
                <a href="#how">How it works</a>
                <a href="#ai">Health AI</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <span>Company</span>
                <a href="mailto:hello@healthhub.app">Contact</a>
                <a href="/login">Log in</a>
                <a href="/account/signup">Join beta</a>
              </div>
              <div>
                <span>Legal</span>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="#security">Security</a>
              </div>
            </div>
          </div>
          <div className="hx-footer__mark" aria-hidden="true">HealthHub</div>
          <div className="hx-footer__bottom">
            <span>© 2026 HealthHub · Colombo, Sri Lanka</span>
            <span>Harbor Lapis · Fraunces + Bricolage · EN සිං த</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
