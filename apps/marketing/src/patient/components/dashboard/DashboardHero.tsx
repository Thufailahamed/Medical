"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Droplets,
  HeartPulse,
  Scale,
} from "lucide-react";

import { Pill } from "@/patient/components/primitives/Pill";
import {
  useHealthSummary,
  useProfile,
  useVitalsAlerts,
  useWellness,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function tipFromWellness(score: number | null | undefined): string {
  if (score == null) return "A quiet check-in keeps your care plan on track.";
  if (score >= 80) return "You're in a strong place — keep the rhythm going.";
  if (score >= 60) return "Small habits today compound into clearer vitals.";
  return "Prioritize rest, meds, and one gentle walk if you can.";
}

/**
 * Personalized dashboard hero — greeting + wellness snapshot.
 * Inbox lives in the topbar; avoid repeating it here.
 */
export function DashboardHero({ className }: { className?: string }) {
  const profile = useProfile();
  const summary = useHealthSummary();
  const wellness = useWellness();
  const alerts = useVitalsAlerts(7);

  const hour = useMemo(() => new Date().getHours(), []);
  const firstName = (profile.data?.name ?? "there").split(" ")[0];
  const blood = summary.data?.demographics?.bloodGroup ?? null;
  const bmi = summary.data?.demographics?.bmi ?? null;
  const bmiCat = summary.data?.demographics?.bmiCategory ?? null;
  const alertCount = alerts.data?.count ?? summary.data?.alerts?.count ?? 0;
  const score = wellness.data?.score ?? null;
  const level = wellness.data?.level?.label ?? null;

  return (
    <header
      className={cn(
        "anim-rise relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 left-1/4 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="t-label">{greetingForHour(hour)}</p>
          <h1 className="t-display mt-1 text-text">
            {firstName}
            <span className="text-brand">.</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-text-soft sm:text-[15px]">
            {tipFromWellness(score)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {blood ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text">
                <Droplets size={13} className="text-danger" aria-hidden />
                {blood}
              </span>
            ) : null}
            {bmi != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text">
                <Scale size={13} className="text-brand" aria-hidden />
                BMI {Number(bmi).toFixed(1)}
                {bmiCat ? (
                  <span className="font-medium text-text-soft">· {bmiCat}</span>
                ) : null}
              </span>
            ) : null}
            {alertCount > 0 ? (
              <Link href="/patient/vitals">
                <Pill tone="warn" icon={<AlertTriangle size={11} />}>
                  {alertCount} vital alert{alertCount === 1 ? "" : "s"}
                </Pill>
              </Link>
            ) : (
              <Pill tone="success">Vitals steady</Pill>
            )}
          </div>
        </div>

        <Link
          href="/patient/health"
          className="group flex min-w-[11.5rem] items-center gap-4 rounded-[var(--radius-inner)] border border-border bg-surface-2/80 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-brand/25 hover:bg-white hover:shadow-[var(--shadow-md)]"
        >
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"
            aria-hidden
          >
            <HeartPulse size={22} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-label block">Wellness</span>
            <span className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-text">
                {score != null ? score : "—"}
              </span>
              {score != null ? (
                <span className="text-xs font-medium text-text-muted">pts</span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-text-soft">
              {level ?? "Building your score"}
            </span>
          </span>
          <ArrowUpRight
            size={16}
            className="shrink-0 text-text-muted transition-colors group-hover:text-brand"
            aria-hidden
          />
        </Link>
      </div>
    </header>
  );
}
