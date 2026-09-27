"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronLeft,
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
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

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

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<TrendingUp size={13} aria-hidden />}
        kicker="Longitudinal Biomarker Intelligence"
        title="Lab Trend Narrative"
        description="See how a biomarker value has moved over time across your medical history and what the clinical trajectory means for your health."
        actions={
          <>
            <Link href="/patient/ai" className={heroSecondaryAction}>
              <ChevronLeft size={13} aria-hidden />
              AI Workspace
            </Link>
            <Link href="/patient/ai/lab-explain" className={heroPrimaryAction}>
              <FlaskConical size={14} aria-hidden />
              Lab Explainer
            </Link>
          </>
        }
        footer={
          <>
            <span>Biomarker Scope · Longitudinal EHR</span>
            <span>Data Security · HIPAA Zero-Log</span>
            <span>Trajectory AI · Clinical Bio-LLM</span>
            <span>Physician Oversight · Target Baselines</span>
          </>
        }
      />

      {/* ── 2. Biomarker Selection & Input Stage ────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-card flex flex-col gap-6">
        <div className="border-b border-border pb-3.5">
          <h2 className="t-card-title text-text flex items-center gap-2">
            <FlaskConical size={18} className="text-brand" aria-hidden />
            <span>Select or Search Laboratory Biomarker</span>
          </h2>
          <p className="text-xs text-text-soft mt-0.5">
            Choose from common diagnostic tests or enter any biomarker from your clinical records.
          </p>
        </div>

        {/* Categorized Test Selection Chips */}
        <div className="flex flex-col gap-4">
          {TEST_CATEGORIES.map((cat) => (
            <div key={cat.category} className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                {cat.category}
              </span>
              <div className="flex flex-wrap gap-2">
                {cat.tests.map((t) => {
                  const isSelected = selectedTest === t && !customInput;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTest(t);
                        setCustomInput("");
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5",
                        isSelected
                          ? "bg-ink text-white border-ink shadow-xs font-bold"
                          : "bg-surface border-border text-text-soft hover:text-text hover:border-border-strong",
                      )}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} aria-hidden />}
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Custom Test Name Input */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
          <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
            Or Type Any Specific Biomarker Name
          </label>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={customInput || (test && !TEST_CATEGORIES.flatMap((c) => c.tests).includes(test) ? test : "")}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setTest(e.target.value);
              }}
              placeholder="e.g. Uric Acid, Bilirubin, Vitamin B12, Platelet Count…"
              className="pt-input pl-10 text-xs sm:text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={run}
            disabled={!selectedTest.trim() || busy}
            className="pt-btn pt-btn-primary h-11 px-6 text-xs sm:text-sm disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden />
                Synthesizing Longitudinal Trend…
              </>
            ) : (
              <>
                <TrendingUp size={15} aria-hidden />
                Show Trend Narrative for {selectedTest}
              </>
            )}
          </button>

          <span className="text-xs text-text-muted font-medium hidden sm:inline">
            Analyzed against clinical target reference ranges
          </span>
        </div>
      </section>

      {/* ── 3. Generated Trend Narrative Card ──────────────────────────────── */}
      {trend && (
        <section className="rounded-xl border border-brand/25 bg-surface p-6 sm:p-7 shadow-card flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-brand" aria-hidden>
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="t-card-title text-text">
                  {trend.type} — Clinical Trajectory Analysis
                </h3>
                <p className="text-xs text-text-soft">
                  AI-synthesized longitudinal interpretation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {trend.overdue === true ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn">
                  Overdue — schedule soon
                </span>
              ) : null}
              <button
                type="button"
                onClick={handleCopy}
                className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-success" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden />
                    Copy Narrative
                  </>
                )}
              </button>

              <Link
                href={`/patient/ai/chat?prompt=${encodeURIComponent(
                  `Help me understand my ${trend.type} trend over time: ` +
                    trend.narrative.slice(0, 150),
                )}`}
                className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
              >
                <MessageSquare size={12} aria-hidden />
                Discuss in AI Chat
              </Link>
            </div>
          </div>

          {/* Real report stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                Reports on file
              </p>
              <p className="mt-0.5 pt-metric text-lg text-text">
                {trend.count}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                Last done
              </p>
              <p className="mt-0.5 pt-metric text-lg text-text">
                {trend.lastDate ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                Usual interval
              </p>
              <p className="mt-0.5 pt-metric text-lg text-text">
                {trend.intervalMonths ? `~${trend.intervalMonths} mo` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                Next suggested
              </p>
              <p className="mt-0.5 pt-metric text-lg text-text">
                {trend.nextSuggestedDate ?? "—"}
              </p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-text text-xs sm:text-sm leading-relaxed p-4 rounded-lg bg-surface-2 font-normal">
            <div className="whitespace-pre-wrap">{trend.narrative}</div>
          </div>

          {trend.series.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                Report history — last 24 months
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {trend.series.map((s, i) => (
                  <li
                    key={`${s.date}-${i}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
                      s.status === "completed"
                        ? "border-success/25 bg-success-soft text-success"
                        : "border-warn/25 bg-warn-soft text-warn",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        s.status === "completed" ? "bg-success" : "bg-warn",
                      )}
                    />
                    {s.date}
                    <span className="font-normal opacity-70">· {s.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-start gap-2.5 text-[11px] text-text-soft">
            <Info size={14} className="text-text-muted shrink-0 mt-0.5" aria-hidden />
            <span>
              Longitudinal analysis highlights trends and shifts across historical lab encounters. It is intended to assist medical discussions with your physician, not to replace formal diagnostic consultation.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
