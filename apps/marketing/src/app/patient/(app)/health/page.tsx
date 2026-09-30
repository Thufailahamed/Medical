"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Droplets,
  HeartPulse,
  Pill,
  Plus,
  Scale,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import { VitalsTrend } from "@/patient/components/dashboard/VitalsTrend";
import {
  useHealthSummary,
  useVitalsAlerts,
  useWellness,
} from "@/patient/hooks";
import { VITAL_REGISTRY } from "@/patient/lib/vitals";
import {
  Badge,
  EmptyBlock,
  HERO_ATTENTION_CHIP,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  InfoField,
  LiveDot,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  RailRow,
  StatTile,
  todayLong,
} from "@/patient/components/workspace";

function isSevere(classification?: string | null) {
  const c = (classification ?? "").toLowerCase();
  return c.includes("low") || c.includes("critical") || c.includes("high") || c.includes("crisis");
}

export default function HealthPage() {
  const summary = useHealthSummary();
  const alerts = useVitalsAlerts(7);
  const wellness = useWellness();

  const demo = summary.data?.demographics;
  const alertItems = alerts.data?.items ?? [];
  const alertCount = alerts.data?.count ?? alertItems.length;
  const score = wellness.data?.score ?? null;
  const meds = summary.data?.activeMedicines ?? [];
  const bmi = demo?.bmi != null ? Number(demo.bmi).toFixed(1) : null;
  const bmiCategory = demo?.bmiCategory ?? null;
  const bloodGroup = demo?.bloodGroup ?? null;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<HeartPulse size={13} aria-hidden />}
          kicker="My health"
          kickerMeta={todayLong()}
          title={
            <>
              Your body, <HeroAccent>in numbers</HeroAccent>
            </>
          }
          description="Vitals, trends, alerts and your clinical profile in one place — log a reading and everything here updates."
          chips={
            <>
              {alertCount > 0 ? (
                <Link href="/patient/vitals" className={HERO_ATTENTION_CHIP}>
                  <AlertTriangle size={12} aria-hidden />
                  {alertCount} alert{alertCount === 1 ? "" : "s"} this week
                </Link>
              ) : (
                <span className={HERO_CHIP}>
                  <LiveDot />
                  All vitals in range
                </span>
              )}
              {bloodGroup ? (
                <span className={HERO_CHIP}>
                  <Droplets size={12} className="text-rose-300" aria-hidden />
                  Blood {bloodGroup}
                </span>
              ) : null}
              {bmi ? (
                <span className={HERO_CHIP}>
                  <Scale size={12} className="text-sky-300" aria-hidden />
                  BMI {bmi}
                  {bmiCategory ? ` · ${bmiCategory}` : ""}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/patient/trends" className={HERO_GHOST}>
                <Activity size={15} aria-hidden />
                Trends
              </Link>
              <Link href="/patient/vitals" className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Log vitals
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            href="/patient/trends"
            label="Wellness"
            icon={<HeartPulse size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={score != null ? String(score) : "—"}
            unit={score != null ? "/ 100" : undefined}
            sub={wellness.data?.level?.label ?? "Building rhythm"}
            progress={score}
          />
          <StatTile
            href="/patient/vitals"
            label="Alerts · 7 days"
            icon={<Activity size={16} />}
            tone={alertCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}
            value={String(alertCount)}
            sub={alertCount === 0 ? "Everything in range" : "Readings to review"}
            badge={alertCount > 0 ? { text: "Review", tone: "bg-amber-50 text-amber-700" } : undefined}
            pulse={alertCount > 0}
          />
          <StatTile
            href="/patient/medications"
            label="Active medicines"
            icon={<Pill size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={summary.data ? String(meds.length) : "—"}
            sub={meds.length > 0 ? "On your current plan" : "Nothing active"}
          />
          <StatTile
            href="/patient/profile"
            label="Body mass index"
            icon={<Scale size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={bmi ?? "—"}
            sub={bmiCategory ?? "Add height & weight"}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <VitalsTrend />

          {/* About you */}
          <section className={PANEL} aria-labelledby="hl-about">
            <PanelHeader
              id="hl-about"
              icon={<UserRound size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="About you"
              caption="Clinical profile your care team sees"
              href="/patient/profile"
              linkLabel="Edit profile"
            />
            {summary.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : summary.isError ? (
              <PanelError onRetry={() => void summary.refetch()} />
            ) : (
              <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField icon={<UserRound size={14} />} label="Full name">
                  {demo?.name ?? "—"}
                </InfoField>
                <InfoField icon={<CalendarDays size={14} />} label="Age">
                  {demo?.age != null ? `${demo.age} years` : "—"}
                </InfoField>
                <InfoField icon={<Users size={14} />} label="Sex">
                  <span className="capitalize">{demo?.sex ?? "—"}</span>
                </InfoField>
                <InfoField icon={<Droplets size={14} />} label="Blood group">
                  {bloodGroup ?? "Not recorded"}
                </InfoField>
                <InfoField icon={<Scale size={14} />} label="BMI">
                  {bmi ? `${bmi}${bmiCategory ? ` · ${bmiCategory}` : ""}` : "Not recorded"}
                </InfoField>
                <InfoField icon={<Pill size={14} />} label="Active medicines">
                  {meds.length}
                </InfoField>
              </dl>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Health overview">
          {/* Recent alerts */}
          <section className={PANEL} aria-labelledby="hl-alerts">
            <PanelHeader
              id="hl-alerts"
              icon={<AlertTriangle size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Recent alerts"
              caption="Readings outside range · past 7 days"
              href="/patient/vitals"
              linkLabel="Vitals"
            />
            {alerts.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : alertItems.length === 0 ? (
              <EmptyBlock
                icon={<CheckCircle2 size={19} />}
                title="Looking good"
                body="Every reading this week is within its healthy target range."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {alertItems.slice(0, 6).map((a, i) => {
                  const severe = isSevere(a.classification);
                  return (
                    <li key={`${a.type}-${a.value}-${i}`}>
                      <Link href={`/patient/vitals?type=${a.type}`}>
                        <RailRow
                          tone={severe ? "rose" : "amber"}
                          icon={<Activity size={16} />}
                          title={
                            <>
                              {VITAL_REGISTRY[a.type]?.label ?? a.type}: {a.value}{" "}
                              <span className="font-normal text-slate-400">{VITAL_REGISTRY[a.type]?.unit ?? ""}</span>
                            </>
                          }
                          meta={a.classification}
                          trailing={<ChevronRight size={16} className="text-slate-300" aria-hidden />}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Active medicines */}
          <section className={PANEL} aria-labelledby="hl-meds">
            <PanelHeader
              id="hl-meds"
              icon={<Pill size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Current medicines"
              caption={meds.length > 0 ? `${meds.length} active` : "Nothing active"}
              href="/patient/medications"
              linkLabel="Manage"
            />
            {meds.length === 0 ? (
              <EmptyBlock
                icon={<Pill size={19} />}
                title="No active medicines"
                body="Prescriptions from your doctor and medicines you add appear here."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-0.5">
                {meds.slice(0, 6).map((m, i) => (
                  <li key={`${m.name}-${i}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-slate-50">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{m.name}</span>
                    {m.dosage ? <Badge tone="sky">{m.dosage}</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href="/patient/ai"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(56,189,248,0.30), transparent 60%), linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(49,46,129,0.6)",
            }}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-inset ring-white/15">
              <Sparkles size={21} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sky-200/80">
                AI assistant
              </span>
              <span className="mt-1 block text-base font-semibold">Explain my numbers</span>
              <span className="block text-xs text-white/60">Plain-language read of your trends</span>
            </span>
            <ChevronRight size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </aside>
      </div>
    </PatientPage>
  );
}
