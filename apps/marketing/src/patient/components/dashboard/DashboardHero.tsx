"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Droplets,
  HeartPulse,
  QrCode,
  Scale,
  Sparkles,
} from "lucide-react";

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
 * Personalized dashboard hero — oceanic gradient banner with live metrics,
 * wellness cockpit, and quick clinical shortcuts matching doctor portal.
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
        "dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
        boxShadow:
          "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
      }}
    >
      {/* ── Decorative ambient glowing orbs ──────────────────────────────── */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 50%)",
        }}
        aria-hidden
      />

      {/* ── Clinical cross watermark texture ─────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          {/* ── Left Column: Greeting, Headline, Guidance & Vitals Pills ─── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg leading-none">{greetingEmoji(hour)}</span>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/70">
                {getTodayFormatted()}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {greetingForHour(hour)}, {firstName}
            </h1>

            <p className="text-sm text-white/80 mt-1.5 max-w-lg leading-relaxed">
              {tipFromWellness(score)}
            </p>

            {/* Quick Metrics & Vitals Status Pills */}
            <div className="flex items-center gap-2.5 mt-4 flex-wrap">
              {blood ? (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm border"
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    borderColor: "rgba(255, 255, 255, 0.18)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Droplets size={13} className="text-rose-300" aria-hidden />
                  <span>Blood: {blood}</span>
                </div>
              ) : null}

              {bmi != null ? (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm border"
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    borderColor: "rgba(255, 255, 255, 0.18)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <Scale size={13} className="text-sky-300" aria-hidden />
                  <span>BMI {Number(bmi).toFixed(1)}</span>
                  {bmiCat ? (
                    <span className="text-white/70 font-normal">· {bmiCat}</span>
                  ) : null}
                </div>
              ) : null}

              {alertCount > 0 ? (
                <Link
                  href="/patient/vitals"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-200 border shadow-sm transition-transform hover:scale-[1.03]"
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    borderColor: "rgba(251, 191, 36, 0.35)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>
                    {alertCount} vital alert{alertCount === 1 ? "" : "s"}
                  </span>
                </Link>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-200 border shadow-sm"
                  style={{
                    background: "rgba(16, 185, 129, 0.18)",
                    borderColor: "rgba(52, 211, 153, 0.3)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
                  <span>Vitals steady</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Wellness Score Card & Action Shortcuts ──────── */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            {/* Wellness Badge Link */}
            <Link
              href="/patient/health"
              className="group flex min-w-[13.5rem] items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-200 hover:scale-[1.02] border"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-md transition-transform group-hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)",
                  boxShadow: "0 4px 14px rgba(14, 165, 233, 0.4)",
                }}
              >
                <HeartPulse size={22} strokeWidth={2.3} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-200">
                  <Sparkles size={11} className="text-sky-300" />
                  <span>Wellness</span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {score != null ? score : "—"}
                  </span>
                  {score != null && (
                    <span className="text-xs font-semibold text-white/70">
                      pts
                    </span>
                  )}
                </div>
                <span className="text-[11.5px] font-medium text-sky-100/80 block mt-0.5">
                  {level ?? "Building health rhythm"}
                </span>
              </div>

              <ArrowUpRight
                size={16}
                className="shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
              />
            </Link>

            {/* Quick Action Shortcuts */}
            <div className="flex items-center gap-2">
              <Link
                href="/patient/health"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] border"
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <Activity size={12} className="text-sky-300" />
                <span>Log vitals</span>
              </Link>

              <Link
                href="/patient/health-id"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] border"
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <QrCode size={12} className="text-emerald-300" />
                <span>Health ID</span>
              </Link>

              <Link
                href="/patient/appointments"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] border"
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <Calendar size={12} className="text-sky-300" />
                <span>Book visit</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
