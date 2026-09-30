"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  Copy,
  FlaskConical,
  Info,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { AiToolHero } from "@/patient/components/ai/AiToolHero";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  GROUP_LABEL,
  HERO_PRIMARY,
  MetricTile,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientPage,
  PRIMARY_BTN,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

const TEST_CATEGORIES = [
  {
    category: "Glycemic & Metabolic",
    tests: ["HbA1c", "Fasting Glucose", "Creatinine", "eGFR"],
  },
  {
    category: "Lipid & Cardiovascular",
    tests: ["Total Cholesterol", "LDL", "HDL", "Triglycerides"],
  },
  {
    category: "Hormones & Nutrients",
    tests: ["TSH", "Vitamin D", "Hemoglobin", "Ferritin"],
  },
];

interface LabTrend {
  type: string;
  count: number;
  lastDate: string | null;
  pendingCount: number;
  completedCount: number;
  series: Array<{ date: string; status: string }>;
  narrative: string;
  overdue?: boolean | null;
  intervalMonths?: number | null;
  nextSuggestedDate?: string | null;
}

export default function AiLabTrendPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const [test, setTest] = useState("HbA1c");
  const [customInput, setCustomInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [trend, setTrend] = useState<LabTrend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedTest = customInput.trim() || test;

  async function run() {
    if (!selectedTest.trim()) {
      setError("Please select or enter a lab test name.");
      return;
    }
    if (!patientId) {
      setError(
        profile.isLoading
          ? "Your profile is still loading — try again in a moment."
          : "We couldn't load your patient profile. Please refresh and try again.",
      );
      return;
    }

    setBusy(true);
    setError(null);
    setTrend(null);

    try {
      const res = await api<{ trend: LabTrend }>(
        `/ai/lab-trend?patientId=${encodeURIComponent(patientId)}&type=${encodeURIComponent(selectedTest)}&months=24`,
        { method: "GET" },
      );
      if (!res?.trend) throw new Error("Empty response");
      setTrend(res.trend);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't load the trend narrative. Please try a different test.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!trend) return;
    void navigator.clipboard.writeText(trend.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const known = TEST_CATEGORIES.flatMap((c) => c.tests);

  return (
    <PatientPage>
      <AiToolHero
        icon={<TrendingUp size={13} aria-hidden />}
        badge="Health trends"
        title="Lab trend narrative"
        description="See how a marker has moved across your history — and what the direction means for your health."
        trust={["Last 24 months", "Non-diagnostic"]}
        actions={
          <Link href="/patient/ai/lab-explain" className={HERO_PRIMARY}>
            <FlaskConical size={15} className="text-emerald-600" aria-hidden />
            Lab explainer
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="lt-pick">
            <PanelHeader
              id="lt-pick"
              icon={<FlaskConical size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Pick a marker"
              caption="Common tests, or type any marker from your records"
            />

            <div className="mt-5 flex flex-col gap-4">
              {TEST_CATEGORIES.map((cat) => (
                <div key={cat.category}>
                  <p className={GROUP_LABEL}>{cat.category}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cat.tests.map((t) => {
                      const on = selectedTest === t && !customInput;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setTest(t);
                            setCustomInput("");
                          }}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all",
                            on
                              ? "bg-[#07233a] text-white shadow-md shadow-slate-900/15"
                              : "bg-slate-50 text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-white hover:text-slate-900",
                          )}
                        >
                          {on ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <label htmlFor="lt-custom" className={FIELD_LABEL}>Or type any marker</label>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="lt-custom"
                  type="text"
                  value={customInput || (test && !known.includes(test) ? test : "")}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    setTest(e.target.value);
                  }}
                  placeholder="e.g. Uric acid, Bilirubin, Vitamin B12…"
                  className={cn(FIELD_INPUT, "pl-9")}
                />
              </div>
            </div>

            {error ? (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={14} className="shrink-0" aria-hidden />
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="hidden text-[11px] text-slate-400 sm:inline">Compared against clinical reference ranges</span>
              <button
                type="button"
                onClick={run}
                disabled={!selectedTest.trim() || busy}
                className="inline-flex h-10 min-w-0 items-center gap-1.5 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
              >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <TrendingUp size={15} aria-hidden />}
                <span className="truncate">{busy ? "Building trend…" : `Show ${selectedTest || "trend"}`}</span>
              </button>
            </div>
          </section>

          {busy && !trend ? (
            <section className={PANEL} aria-busy>
              <PanelSkeleton rows={4} className="mt-0" />
            </section>
          ) : null}

          {trend ? (
            <section className={PANEL} aria-labelledby="lt-result">
              <PanelHeader
                id="lt-result"
                icon={<Sparkles size={16} />}
                tone="bg-indigo-50 text-indigo-600"
                title={`${trend.type} over time`}
                caption="AI-written summary of your history"
                action={
                  <button type="button" onClick={handleCopy} className={cn(SECONDARY_BTN, "h-8 px-3")}>
                    {copied ? <Check size={12} className="text-emerald-600" aria-hidden /> : <Copy size={12} aria-hidden />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                }
              />

              {trend.overdue === true ? (
                <div className="relative mt-4 flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                  <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-amber-400" aria-hidden />
                  <span className="ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-amber-50 text-amber-600" aria-hidden>
                    <CalendarClock size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                    This test is overdue
                    <span className="block text-xs font-normal text-slate-400">Consider booking it soon</span>
                  </span>
                  <Link href="/patient/diagnostic-tests" className={cn(PRIMARY_BTN, "h-8 px-3")}>
                    Book test
                  </Link>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MetricTile icon={<FlaskConical size={16} />} tone="bg-sky-50 text-sky-600" label="Reports on file" value={trend.count} />
                <MetricTile icon={<CalendarDays size={16} />} tone="bg-emerald-50 text-emerald-600" label="Last done" value={<span className="text-base">{trend.lastDate ?? "—"}</span>} />
                <MetricTile icon={<Clock size={16} />} tone="bg-violet-50 text-violet-600" label="Usual interval" value={<span className="text-base">{trend.intervalMonths ? `~${trend.intervalMonths} mo` : "—"}</span>} />
                <MetricTile icon={<CalendarClock size={16} />} tone="bg-amber-50 text-amber-600" label="Next suggested" value={<span className="text-base">{trend.nextSuggestedDate ?? "—"}</span>} />
              </div>

              <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{trend.narrative}</div>

              {trend.series.length > 0 ? (
                <div className="mt-5">
                  <p className={GROUP_LABEL}>Report history · last 24 months</p>
                  <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                    {trend.series.map((pt, i) => {
                      const done = pt.status === "completed";
                      return (
                        <li
                          key={`${pt.date}-${i}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums",
                            done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", done ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
                          {pt.date}
                          <span className="font-normal opacity-70">· {pt.status}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                  Highlights direction over time to help you talk to your doctor — not a diagnosis.
                </p>
                <Link
                  href={`/patient/ai/chat?prompt=${encodeURIComponent(`Help me understand my ${trend.type} trend over time: ` + trend.narrative.slice(0, 150))}`}
                  className={cn(PRIMARY_BTN, "shrink-0")}
                >
                  <MessageSquare size={13} aria-hidden />
                  Discuss in chat
                </Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="About trends">
          <section className={PANEL} aria-labelledby="lt-why">
            <PanelHeader id="lt-why" icon={<TrendingUp size={16} />} tone="bg-sky-50 text-sky-600" title="Why trends matter" caption="One result is a snapshot" />
            <ul className="mt-4 flex flex-col gap-3">
              {[
                { title: "Direction beats a single value", body: "A slowly rising HbA1c can matter more than one borderline reading." },
                { title: "Spot overdue tests", body: "We compare how often you've had a test with how often it's usually repeated." },
                { title: "Better conversations", body: "Bring the summary to your next visit to talk it through." },
              ].map((r, i) => (
                <li key={r.title} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold tabular-nums text-slate-600">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-900">{r.title}</span>
                    <span className="block text-xs leading-relaxed text-slate-500">{r.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <AiSafetyNotice />
        </aside>
      </div>
    </PatientPage>
  );
}
