"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity,
  CalendarPlus,
  Droplets,
  HeartPulse,
  Pill,
  Scale,
  ShieldCheck,
} from "lucide-react";

import {
  useHealthSummary,
  useInsurance,
  useProfile,
  useRefillDue,
  useVitalsAlerts,
  useWellness,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
} from "@/portal/components/doctor/Workspace";

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
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

const ATTENTION_CHIP =
  "inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25";

/** Glass ring on the hero showing the wellness score. */
function WellnessRing({ score, label }: { score: number | null; label: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  return (
    <Link
      href="/patient/health"
      className="flex min-w-[13.5rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pl-2.5 pr-4 backdrop-blur-md transition-colors hover:bg-white/[0.1]"
    >
      <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="wellnessRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="url(#wellnessRing)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <text
          x="28"
          y="28"
          transform="rotate(90 28 28)"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize="14"
          fontWeight="700"
        >
          {score ?? "—"}
        </text>
      </svg>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">
          Wellness score
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-white">{label}</span>
        <span className="block text-[11px] text-white/55">out of 100</span>
      </span>
    </Link>
  );
}

/**
 * Patient home hero — the same ink plate as the doctor and admin
 * workspaces: kicker, greeting, live status chips, a glass wellness
 * ring and the two primary actions. The stat strip overlaps its
 * bottom edge (see the dashboard page).
 */
export function DashboardHero() {
  const profile = useProfile();
  const summary = useHealthSummary();
  const wellness = useWellness();
  const alerts = useVitalsAlerts(7);
  const insurance = useInsurance();
  const refills = useRefillDue(14);

  const hour = useMemo(() => new Date().getHours(), []);
  const firstName = (profile.data?.name ?? "there").split(" ")[0];
  const blood = summary.data?.demographics?.bloodGroup ?? null;
  const bmi = summary.data?.demographics?.bmi ?? null;
  const bmiCat = summary.data?.demographics?.bmiCategory ?? null;
  const alertCount = alerts.data?.count ?? summary.data?.alerts?.count ?? 0;
  const refillCount = refills.data?.count ?? 0;
  const score = wellness.data?.score ?? null;
  const policy = insurance.data?.policy ?? null;

  return (
    <DoctorHero
      kickerIcon={<HeartPulse size={13} aria-hidden />}
      kicker="Personal care"
      kickerMeta={getTodayFormatted()}
      title={
        <>
          {greetingForHour(hour)},{" "}
          <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
            {firstName}
          </span>
        </>
      }
      description={tipFromWellness(score)}
      chips={
        <>
          {alertCount > 0 ? (
            <Link href="/patient/vitals" className={ATTENTION_CHIP}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
              {alertCount} vital alert{alertCount === 1 ? "" : "s"} to review
            </Link>
          ) : (
            <span className={HERO_CHIP}>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Vitals steady
            </span>
          )}
          {refillCount > 0 ? (
            <Link href="/patient/medications" className={ATTENTION_CHIP}>
              <Pill size={12} aria-hidden />
              {refillCount} refill{refillCount === 1 ? "" : "s"} due
            </Link>
          ) : null}
          {blood ? (
            <span className={HERO_CHIP}>
              <Droplets size={12} className="text-rose-300" aria-hidden />
              Blood {blood}
            </span>
          ) : null}
          {bmi != null ? (
            <span className={HERO_CHIP}>
              <Scale size={12} className="text-sky-300" aria-hidden />
              BMI {Number(bmi).toFixed(1)}
              {bmiCat ? ` · ${bmiCat}` : ""}
            </span>
          ) : null}
          {policy ? (
            <Link
              href="/patient/insurance"
              data-testid="hero-insurance-line"
              className={cn(HERO_CHIP, "transition-colors hover:bg-white/10 hover:text-white")}
            >
              <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
              {policy.provider}
              {policy.renewsAt
                ? ` · renews in ${Math.max(0, Math.ceil((new Date(policy.renewsAt).getTime() - Date.now()) / 86_400_000))}d`
                : ""}
            </Link>
          ) : null}
        </>
      }
      aside={
        <WellnessRing score={score} label={wellness.data?.level.label ?? "Building rhythm"} />
      }
      actions={
        <>
          <Link href="/patient/appointments/book" className={HERO_GHOST}>
            <CalendarPlus size={15} aria-hidden />
            Book visit
          </Link>
          <Link href="/patient/vitals" className={HERO_PRIMARY}>
            <Activity size={15} className="text-sky-600" aria-hidden />
            Log vitals
          </Link>
        </>
      }
    />
  );
}
