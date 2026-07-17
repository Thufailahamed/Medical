"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Stethoscope,
  Users,
  Heart,
  Baby,
  Activity,
  Smile,
  AlertTriangle,
  Building2,
  ArrowRight,
  Check,
  Wallet,
  Hospital,
  Sparkles,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  planType: string;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  coverageSummaryLkr: number;
  copayPct: number;
  networkHospitalCount: number;
  isFeatured: boolean;
  annualDiscountPct: number;
  provider: { name: string; slug: string };
}

interface CatalogResponse {
  plans: Plan[];
  providers: Array<{ id: string; name: string; slug: string }>;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const PLAN_TYPE_META: Record<
  string,
  { label: string; icon: typeof Heart; color: string }
> = {
  individual: { label: "Individual", icon: Heart, color: "#DC2626" },
  family_floater: { label: "Family Floater", icon: Users, color: "#2563EB" },
  senior: { label: "Senior", icon: Stethoscope, color: "#7C3AED" },
  critical_illness: {
    label: "Critical Illness",
    icon: AlertTriangle,
    color: "#D97706",
  },
  cancer: { label: "Cancer Care", icon: Activity, color: "#DB2777" },
  dental: { label: "Dental", icon: Smile, color: "#0891B2" },
  maternity: { label: "Maternity", icon: Baby, color: "#16A34A" },
};

function formatLkr(value: number): string {
  return `LKR ${value.toLocaleString("en-LK")}`;
}

export default function PublicInsuranceLanding() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${API_URL}/insurance-marketplace/catalog`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: CatalogResponse) => {
        if (!alive) return;
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message ?? "Failed to load");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const plans = data?.plans ?? [];
  const providers = data?.providers ?? [];
  const featured = plans.filter((p) => p.isFeatured).slice(0, 3);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-sky-50/40 to-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-slate-100">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-bold text-slate-900 text-lg">
            MedLocker
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#how" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#plans" className="hover:text-slate-900">
              Plans
            </a>
            <a href="#providers" className="hover:text-slate-900">
              Insurers
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/login"
              className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/portal/me/insurance/quote"
              className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-800"
            >
              Get a quote <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="container mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
              <Sparkles size={12} /> Insurance marketplace
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.05]">
              Health cover, bought the{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                calm, private way.
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-xl">
              Compare plans from Sri Lanka&apos;s top insurers, get a
              personalised quote in under a minute, and enrol online — all from
              the same app that already holds your health records.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/portal/me/insurance/quote"
                className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 shadow-sm"
              >
                Get a personalised quote
                <ArrowRight size={16} />
              </Link>
              <a
                href="#plans"
                className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300"
              >
                Browse all plans
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Check size={14} className="text-emerald-600" /> No paperwork
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={14} className="text-emerald-600" /> Cashless at
                network hospitals
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={14} className="text-emerald-600" /> Claims via the
                app
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={14} className="text-emerald-600" /> Cancel anytime
              </span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <FeaturedPanel plans={featured} loading={loading} />
          </div>
        </div>
      </section>

      {/* ───────── Stat strip ───────── */}
      <section className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatPill
            label="Plans"
            value={loading ? "…" : String(plans.length)}
            hint="across all insurers"
          />
          <StatPill
            label="Insurers"
            value={loading ? "…" : String(providers.length)}
            hint="regulated, verified"
          />
          <StatPill
            label="Network hospitals"
            value="40+"
            hint="cashless across SL"
          />
          <StatPill
            label="Avg. approval"
            value="72h"
            hint="for clean claims"
          />
        </div>
      </section>

      {/* ───────── Plan type grid ───────── */}
      <section
        className="container mx-auto px-6 py-20"
        id="how"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            Why MedLocker Insurance
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
            Seven kinds of cover. One quiet place to choose.
          </h2>
          <p className="mt-4 text-slate-600">
            Whether you&apos;re after a basic individual plan, a family
            floater with no-claim bonus, or a critical-illness rider — every
            plan is fully underwritten by a licensed Sri Lankan insurer, and
            every claim is tracked inside the same app your doctor uses.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PLAN_TYPE_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = plans.filter((p) => p.planType === key).length;
            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-100 bg-white p-5 hover:border-slate-200 transition"
              >
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: meta.color + "1A", color: meta.color }}
                >
                  <Icon size={22} />
                </div>
                <div className="mt-4 font-bold text-slate-900">
                  {meta.label}
                </div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {loading ? "…" : `${count} plan${count === 1 ? "" : "s"}`}
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <div className="mt-4 font-bold text-slate-900">
                Not sure which?
              </div>
              <div className="text-sm text-slate-600 mt-0.5">
                Answer 6 questions and we&apos;ll match you.
              </div>
            </div>
            <Link
              href="/portal/me/insurance/quote"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Take the quiz <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Plans list ───────── */}
      <section
        className="bg-slate-50/60 py-20"
        id="plans"
      >
        <div className="container mx-auto px-6">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Live catalogue
              </span>
              <h2 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
                {plans.length} plans, sorted by best match.
              </h2>
              <p className="mt-3 text-slate-600 max-w-2xl">
                Sign in to get a side-by-side comparison, a personalised quote,
                and to enrol.
              </p>
            </div>
            <Link
              href="/portal/me/insurance/marketplace"
              className="hidden sm:inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-slate-700"
            >
              See all <ArrowRight size={14} />
            </Link>
          </div>

          {error ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-800">
              Couldn&apos;t load plans ({error}). Showing sample view.
            </div>
          ) : null}

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-72 rounded-2xl bg-white border border-slate-100 animate-pulse"
                  />
                ))
              : plans.slice(0, 9).map((plan) => {
                  const meta =
                    PLAN_TYPE_META[plan.planType] ??
                    PLAN_TYPE_META.individual;
                  const Icon = meta.icon;
                  return (
                    <article
                      key={plan.id}
                      className="rounded-2xl border border-slate-100 bg-white p-6 flex flex-col hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: meta.color + "1A",
                            color: meta.color,
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-500 truncate">
                            {plan.provider.name}
                          </div>
                          <div className="font-bold text-slate-900 truncate">
                            {plan.name}
                          </div>
                        </div>
                        {plan.isFeatured ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                            Featured
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            Monthly
                          </div>
                          <div className="font-bold text-slate-900">
                            {formatLkr(plan.monthlyPremiumLkr)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            Annual
                          </div>
                          <div className="font-bold text-slate-900">
                            {formatLkr(plan.annualPremiumLkr)}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">
                            Coverage
                          </div>
                          <div className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                            <ShieldCheck size={13} />
                            Up to {formatLkr(plan.coverageSummaryLkr)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Hospital size={11} /> {plan.networkHospitalCount}+
                          hospitals
                        </span>
                        <span>{plan.copayPct}% co-pay</span>
                      </div>

                      <Link
                        href="/portal/me/insurance/plans"
                        className="mt-6 inline-flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-800"
                      >
                        View & enrol <ArrowRight size={13} />
                      </Link>
                    </article>
                  );
                })}
          </div>
        </div>
      </section>

      {/* ───────── Providers ───────── */}
      <section
        className="container mx-auto px-6 py-20"
        id="providers"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          Insurers
        </span>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
          We work with the names Sri Lanka trusts.
        </h2>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-white border border-slate-100 animate-pulse"
                />
              ))
            : providers.slice(0, 12).map((p) => (
                <Link
                  key={p.id}
                  href={`/portal/me/insurance/marketplace/${p.slug}`}
                  className="rounded-xl border border-slate-100 bg-white p-5 flex flex-col items-center justify-center gap-2 text-center hover:border-slate-200"
                >
                  <Building2 size={20} className="text-slate-400" />
                  <div className="font-semibold text-sm text-slate-900">
                    {p.name}
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="bg-slate-900 text-white py-20">
        <div className="container mx-auto px-6">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            How it works
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold">
            From &quot;I think I need cover&quot; to insured in three steps.
          </h2>

          <ol className="mt-12 grid md:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Quote"
              body="Six quick questions about you and anyone you want covered. We'll show a real premium from each insurer — not a teaser."
            />
            <Step
              n={2}
              title="Choose"
              body="Compare benefits, hospital networks, and exclusions side-by-side. Pick the plan that fits, not the one with the loudest ad."
            />
            <Step
              n={3}
              title="Enrol & pay"
              body="Pay online via PayHere. Your e-card is in the app instantly. Claims? Submitted, tracked and paid in the same place."
            />
          </ol>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section
        className="container mx-auto px-6 py-20"
        id="faq"
      >
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            FAQ
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
            Things people ask first.
          </h2>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-slate-100 border-y border-slate-100">
          <Faq
            q="Is MedLocker an insurer?"
            a="No. We're a licensed insurance broker. We help you compare, choose and buy from regulated insurers like Sri Lanka Insurance, Ceylinco, AIA and more. Your policy is with the insurer, not with us."
          />
          <Faq
            q="How is the premium calculated?"
            a="Each insurer sets their own rates. We ask for your age, location, smoking status and pre-existing conditions, then return the real premium for each plan — no manual underwriting by us."
          />
          <Faq
            q="What happens when I make a claim?"
            a="Open the app, take a photo of your hospital bill and discharge summary, and submit. Most claims are reviewed within 72 hours. Track every step inside the app."
          />
          <Faq
            q="Can I use my e-card at any hospital?"
            a="Only at hospitals in your insurer's network. We show the network hospital count on every plan card so you know before you buy."
          />
          <Faq
            q="Can I cancel anytime?"
            a="Yes — your policy is yours. Most plans have a 14-day free-look period where you can cancel for a full refund."
          />
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="container mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Your records are already here.
              <br />
              <span className="text-emerald-400">Your cover should be too.</span>
            </h2>
            <p className="mt-3 text-slate-300">
              No call centre. No paperwork. Just one quiet place where your
              health lives.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/portal/me/insurance/quote"
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-3 rounded-xl"
            >
              Get my quote <ArrowRight size={16} />
            </Link>
            <Link
              href="/portal/login"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="container mx-auto px-6 py-10 text-sm text-slate-500 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} MedLocker. Insurance broking services
            offered in partnership with licensed insurers.
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-700">
              Terms
            </Link>
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeaturedPanel({
  plans,
  loading,
}: {
  plans: Plan[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-8 animate-pulse h-72" />
    );
  }
  if (plans.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-slate-100 shadow-lg p-8 h-72 flex items-center justify-center text-slate-500 text-sm">
        Featured plans will appear here.
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-xl p-8 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-100/60" />
      <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-sky-100/60" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
          <Sparkles size={12} /> Top picks this week
        </div>
        <div className="mt-6 space-y-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-xl bg-slate-50/60 p-4 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                <Wallet size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 truncate">
                  {p.provider.name}
                </div>
                <div className="font-bold text-slate-900 truncate">
                  {p.name}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-slate-900">
                  {formatLkr(p.monthlyPremiumLkr)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  / month
                </div>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/portal/me/insurance/marketplace"
          className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          See all featured plans <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 px-5 py-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="text-4xl font-bold text-emerald-400">
        {n.toString().padStart(2, "0")}
      </div>
      <div className="mt-3 text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-slate-300 leading-relaxed">{body}</p>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-5">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-semibold text-slate-900">{q}</span>
        <span className="text-slate-400 group-open:rotate-45 transition-transform text-2xl leading-none">
          +
        </span>
      </summary>
      <p className="mt-3 text-slate-600 max-w-2xl">{a}</p>
    </details>
  );
}