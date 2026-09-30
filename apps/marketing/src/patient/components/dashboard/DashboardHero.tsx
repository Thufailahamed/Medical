"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity,
  CalendarPlus,
  Droplets,
  Scale,
  ShieldCheck,
} from "lucide-react";

import {
  useHealthSummary,
  useInsurance,
  useProfile,
  useVitalsAlerts,
  useWellness,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import {
  HeroStatusPill,
  heroPrimaryAction,
  heroSecondaryAction,
} from "@/patient/components/primitives/PageHero";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function greetingEmoji(hour: number): string {
  if (hour < 5) return "🌙";
  if (hour < 12) return "☀️";
  if (hour < 17) return "🌤";
  return "🌙";
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function tipFromWellness(score: number | null | undefined): string {
  if (score == null) return "A quiet check-in keeps your care plan on track.";
  if (score >= 80) return "You're in a strong place — keep the rhythm going.";
  if (score >= 60) return "Small habits today compound into clearer vitals.";
  return "Prioritize rest, meds, and one gentle walk if you can.";
}

/**
 * Personalized dashboard hero — ink plate with greeting, live status,
 * primary shortcuts and a quiet facts row. The stat strip overlaps its
 * bottom edge (see the dashboard page), so the plate reserves space.
 */
export function DashboardHero({ className }: { className?: string }) {
  const profile = useProfile();
  const summary = useHealthSummary();
  const wellness = useWellness();
  const alerts = useVitalsAlerts(7);
  const insurance = useInsurance();

  const hour = useMemo(() => new Date().getHours(), []);
  const firstName = (profile.data?.name ?? "there").split(" ")[0];
  const blood = summary.data?.demographics?.bloodGroup ?? null;
  const bmi = summary.data?.demographics?.bmi ?? null;
  const bmiCat = summary.data?.demographics?.bmiCategory ?? null;
  const alertCount = alerts.data?.count ?? summary.data?.alerts?.count ?? 0;
  const score = wellness.data?.score ?? null;
  const policy = insurance.data?.policy ?? null;

  return (
    <header className={cn("pt-hero anim-rise", className)}>
      {/* ECG trace — decorative */}
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] text-sky-300/25 md:block"
        viewBox="0 0 600 220"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          d="M0 132 H250 l14 -34 12 70 16 -104 12 88 14 -20 H420 l10 -18 10 30 10 -12 H600"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="relative z-10 px-6 pb-20 pt-6 md:px-8 md:pb-24 md:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <div className="pt-hero-kicker">
              <span className="text-sm leading-none" aria-hidden>
                {greetingEmoji(hour)}
              </span>
              <span>{getTodayFormatted()}</span>
            </div>
            <h1 className="mt-3 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {greetingForHour(hour)}, {firstName}
            </h1>
            <p className="pt-hero-desc mt-2">{tipFromWellness(score)}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {alertCount > 0 ? (
                <Link
                  href="/patient/vitals"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  {alertCount} vital alert{alertCount === 1 ? "" : "s"} to review
                </Link>
              ) : (
                <HeroStatusPill label="Vitals steady" tone="success" />
              )}
              {blood ? (
                <HeroFact icon={<Droplets size={12} className="text-rose-300" aria-hidden />}>
                  Blood {blood}
                </HeroFact>
              ) : null}
              {bmi != null ? (
                <HeroFact icon={<Scale size={12} className="text-sky-300" aria-hidden />}>
                  BMI {Number(bmi).toFixed(1)}
                  {bmiCat ? ` · ${bmiCat}` : ""}
                </HeroFact>
              ) : null}
              {policy ? (
                <Link
                  href="/patient/insurance"
                  data-testid="hero-insurance-line"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                  {policy.provider}
                  {policy.renewsAt
                    ? ` · renews in ${Math.max(0, Math.ceil((new Date(policy.renewsAt).getTime() - Date.now()) / 86_400_000))}d`
                    : ""}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/patient/appointments/book"
              className={cn(heroSecondaryAction, "text-sm")}
            >
              <CalendarPlus size={15} aria-hidden />
              Book visit
            </Link>
            <Link
              href="/patient/vitals"
              className={cn(
                heroPrimaryAction,
                "text-sm focus-visible:outline-2 focus-visible:outline-white",
              )}
            >
              <Activity size={15} aria-hidden />
              Log vitals
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroFact({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80">
      {icon}
      {children}
    </span>
  );
}
