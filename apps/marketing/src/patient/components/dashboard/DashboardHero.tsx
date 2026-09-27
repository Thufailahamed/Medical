"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowUpRight,
  Activity,
  Droplets,
  HeartPulse,
  Sparkles,
  Scale,
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
  PageHero,
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
 * Personalized dashboard hero — VYRO ink card with live metrics,
 * wellness stat block, and quick clinical shortcuts.
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
  const level = wellness.data?.level?.label ?? null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <PageHero
        icon={<span className="text-base leading-none">{greetingEmoji(hour)}</span>}
        kicker={getTodayFormatted()}
        title={`${greetingForHour(hour)}, ${firstName}`}
        description={tipFromWellness(score)}
        status={
          alertCount > 0 ? (
            <Link
              href="/patient/vitals"
              className={cn(
                heroSecondaryAction,
                "!border-amber-400/30 !bg-amber-400/15 !text-amber-200",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                {alertCount} vital alert{alertCount === 1 ? "" : "s"}
              </span>
            </Link>
          ) : (
            <HeroStatusPill label="Vitals steady" tone="success" />
          )
        }
        actions={
          <Link
            href="/patient/health"
            className={cn(heroPrimaryAction, "focus-visible:outline-2 focus-visible:outline-white")}
          >
            <Activity size={14} aria-hidden />
            Log vitals
          </Link>
        }
        footer={
          <>
            {blood ? (
              <span className="inline-flex items-center gap-1.5">
                <Droplets size={11} className="text-rose-300" aria-hidden />
                Blood {blood}
              </span>
            ) : null}
            {bmi != null ? (
              <span className="inline-flex items-center gap-1.5">
                <Scale size={11} aria-hidden />
                BMI {Number(bmi).toFixed(1)}
                {bmiCat ? ` · ${bmiCat}` : ""}
              </span>
            ) : null}
            {insurance.data?.policy ? (
              <Link
                href="/patient/insurance"
                className="font-semibold text-white/80 hover:text-white"
                data-testid="hero-insurance-line"
              >
                {insurance.data.policy.provider}
                {insurance.data.policy.renewsAt
                  ? ` · renews in ${Math.max(0, Math.ceil((new Date(insurance.data.policy.renewsAt).getTime() - Date.now()) / 86_400_000))}d`
                  : ""}{" "}
                →
              </Link>
            ) : null}
          </>
        }
      />

      {/* Wellness stat card — VYRO metrics block on paper */}
      <Link
        href="/patient/health"
        className="patient-card group flex items-center gap-4 p-4"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brand text-white shadow-brand transition-transform group-hover:scale-105">
          <HeartPulse size={22} strokeWidth={2.3} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="pt-kicker flex items-center gap-1">
            <Sparkles size={11} aria-hidden />
            <span>Wellness</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="pt-metric text-3xl text-text">
              {score != null ? score : "—"}
            </span>
            {score != null && (
              <span className="t-micro">pts</span>
            )}
          </div>
          <span className="t-micro mt-0.5 block">
            {level ?? "Building health rhythm"}
          </span>
        </div>

        <ArrowUpRight
          size={16}
          className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand"
        />
      </Link>
    </div>
  );
}
