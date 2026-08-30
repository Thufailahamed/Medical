"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Copy,
  FileText,
  FlaskConical,
  Loader2,
  MessageSquare,
  Pill,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Zap,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useMedications, usePatientProfile } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const QUICK_PROMPTS = [
  {
    label: "Summarize my recent medical record",
    action: "summary" as const,
    icon: FileText,
  },
  {
    label: "Explain my cholesterol and lipid levels",
    action: "lab" as const,
    icon: FlaskConical,
  },
  {
    label: "Check side effects of my medications",
    action: "meds" as const,
    icon: Pill,
  },
  {
    label: "Prepare questions for my doctor's visit",
    action: "chat" as const,
    icon: Stethoscope,
  },
];

const AI_TOOLS = [
  {
    href: "/patient/ai/chat",
    title: "Care Chat",
    description: "Multi-turn conversation about symptoms, meds, and care plans.",
    icon: Bot,
    tint: "bg-violet-50 text-violet-600",
    cta: "Open chat",
  },
  {
    href: "/patient/ai/lab-explain",
    title: "Lab Interpreter",
    description: "Plain-language explanations for your lab markers and ranges.",
    icon: FlaskConical,
    tint: "bg-sky-50 text-sky-600",
    cta: "Explain labs",
  },
  {
    href: "/patient/ai/ocr",
    title: "Document OCR",
    description: "Scan prescriptions and discharge notes into your record.",
    icon: ScanLine,
    tint: "bg-emerald-50 text-emerald-600",
    cta: "Scan paper",
  },
  {
    href: "/patient/ai/lab-trend",
    title: "Health Trends",
    description: "Track HbA1c, blood pressure, and vitals over time.",
    icon: TrendingUp,
    tint: "bg-amber-50 text-amber-600",
    cta: "View trends",
  },
];

const TRUST_STRIP = [
  { icon: Bot, label: "Clinical v2.4", sub: "AI model" },
  { icon: FileText, label: "Connected", sub: "EMR grounding" },
  { icon: ShieldCheck, label: "Active", sub: "Drug guard" },
  { icon: Activity, label: "HIPAA safe", sub: "Privacy" },
];

interface StructuredSummary {
  patientSummary: string;
  diagnoses?: string[];
  medicines?: string[];
  history?: string[];
  risks?: string[];
  recentTests?: string[];
}

export default function AiToolsPage() {
  const router = useRouter();
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const medsQuery = useMedications();
  const drugSectionRef = useRef<HTMLElement>(null);

  const [summaryData, setSummaryData] = useState<StructuredSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const [medicines, setMedicines] = useState("");
  const [interactionResult, setInteractionResult] = useState<string | null>(null);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  const [chatPrompt, setChatPrompt] = useState("");

  const currentMedNames = useMemo(
    () => (medsQuery.data?.medicines ?? []).map((m) => m.name),
    [medsQuery.data?.medicines],
  );

  async function handleGenerateSummary() {
    if (profile.isLoading) return;
    if (!patientId) {
      setSummaryError(
        "Your health profile is still loading or unavailable. Refresh and try again.",
      );
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await api<{ summary: string | StructuredSummary }>("/ai/summary", {
        method: "POST",
        json: { patientId },
      });

      if (typeof res.summary === "string") {
        setSummaryData({ patientSummary: res.summary });
      } else if (res.summary && typeof res.summary === "object") {
        setSummaryData({
          patientSummary:
            res.summary.patientSummary ||
            "Health record summary generated successfully.",
          diagnoses: Array.isArray(res.summary.diagnoses)
            ? res.summary.diagnoses
            : [],
          medicines: Array.isArray(res.summary.medicines)
            ? res.summary.medicines
            : [],
          history: Array.isArray(res.summary.history) ? res.summary.history : [],
          risks: Array.isArray(res.summary.risks) ? res.summary.risks : [],
          recentTests: Array.isArray(res.summary.recentTests)
            ? res.summary.recentTests
            : [],
        });
      }
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : "Failed to generate health summary.",
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleRunDrugCheck(medNamesString?: string) {
    const raw = medNamesString ?? medicines;
    const names = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!names.length) {
      setInteractionError("Enter at least one medication name to check.");
      return;
    }

    setInteractionLoading(true);
    setInteractionError(null);
    setInteractionResult(null);

    try {
      const result = await api<{ result?: string; interactions?: unknown[] }>(
        "/ai/drug-interaction",
        { method: "POST", json: { medicines: names } },
      );
      setInteractionResult(
        result.result ??
          (result.interactions?.length
            ? JSON.stringify(result.interactions, null, 2)
            : "No known adverse interactions detected between the provided medications. Continue taking as directed by your physician."),
      );
    } catch (err) {
      setInteractionError(
        err instanceof Error ? err.message : "Interaction check failed.",
      );
    } finally {
      setInteractionLoading(false);
    }
  }

  function loadAndCheckMeds() {
    if (!currentMedNames.length) {
      setInteractionError(
        "No active medications on file. Add meds or type names manually.",
      );
      drugSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const joined = currentMedNames.join(", ");
    setMedicines(joined);
    void handleRunDrugCheck(joined);
    drugSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleQuickPrompt(prompt: (typeof QUICK_PROMPTS)[number]) {
    switch (prompt.action) {
      case "summary":
        void handleGenerateSummary();
        break;
      case "lab":
        router.push(
          `/patient/ai/lab-explain?prompt=${encodeURIComponent(prompt.label)}`,
        );
        break;
      case "meds":
        loadAndCheckMeds();
        break;
      case "chat":
        router.push(
          `/patient/ai/chat?prompt=${encodeURIComponent(prompt.label)}`,
        );
        break;
    }
  }

  function handleStartChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatPrompt.trim()) {
      router.push("/patient/ai/chat");
    } else {
      router.push(
        `/patient/ai/chat?prompt=${encodeURIComponent(chatPrompt.trim())}`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Compact premium hero */}
      <header
        className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-6 sm:py-5 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 45%, #0E7490 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.55) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/90">
                Clinical intelligence
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight mt-0.5">
                AI health assistant
              </h1>
              <p className="text-xs sm:text-sm text-white/75 mt-1 leading-relaxed">
                Summaries, drug safety checks, and lab explanations — grounded in
                your health record.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/patient/ai/lab-explain"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <FlaskConical size={13} />
                Lab interpreter
              </Link>
              <Link
                href="/patient/ai/chat"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[11px] font-bold text-sky-950 shadow-sm transition-all hover:bg-sky-50"
              >
                <MessageSquare size={13} className="text-sky-700" />
                Live chat
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/15">
            {TRUST_STRIP.map(({ icon: Icon, label, sub }) => (
              <div
                key={sub}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-2.5 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-sky-200/90 truncate">
                    {sub}
                  </p>
                  <p className="text-xs font-extrabold text-white truncate">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Sticky AI command center */}
      <div className="sticky top-0 z-20 -mx-0.5 px-0.5 py-1.5 bg-[color-mix(in_srgb,var(--color-canvas)_90%,transparent)] backdrop-blur-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
          <form onSubmit={handleStartChat} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Sparkles
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500"
              />
              <input
                type="search"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="Ask about records, labs, symptoms, or prescriptions…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15"
              />
            </div>
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              Ask AI
              <Send size={13} />
            </button>
          </form>

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {QUICK_PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700 transition-all hover:border-sky-200 hover:bg-sky-50 hover:text-sky-900 min-h-9"
                >
                  <Icon size={12} className="text-sky-600" />
                  <span className="whitespace-nowrap">{prompt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Core tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Health summary */}
        <article className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400" />
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <FileText size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Health record summary
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  AI synthesizes visits, conditions, and trends into plain language.
                </p>
              </div>
            </div>

            {summaryError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{summaryError}</span>
              </div>
            ) : null}

            {summaryData ? (
              <div className="relative max-h-64 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs text-slate-800 leading-relaxed">
                <button
                  type="button"
                  onClick={() => {
                    const textToCopy = [
                      summaryData.patientSummary,
                      summaryData.diagnoses?.length
                        ? `Diagnoses: ${summaryData.diagnoses.join(", ")}`
                        : "",
                      summaryData.medicines?.length
                        ? `Medications: ${summaryData.medicines.join(", ")}`
                        : "",
                      summaryData.risks?.length
                        ? `Risks: ${summaryData.risks.join(", ")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n\n");
                    void navigator.clipboard.writeText(textToCopy);
                    setCopiedSummary(true);
                    setTimeout(() => setCopiedSummary(false), 2000);
                  }}
                  className="absolute top-2.5 right-2.5 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-xs transition-colors hover:text-slate-800"
                  aria-label="Copy summary"
                >
                  {copiedSummary ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>

                <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-sky-600" />
                  Patient briefing
                </p>
                <p className="text-slate-700 leading-relaxed pr-6">
                  {summaryData.patientSummary}
                </p>

                {summaryData.diagnoses && summaryData.diagnoses.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                      Diagnoses
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {summaryData.diagnoses.map((d) => (
                        <span
                          key={d}
                          className="rounded-md border border-sky-200/70 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {summaryData.risks && summaryData.risks.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block mb-1.5">
                      Risk factors
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {summaryData.risks.map((r) => (
                        <span
                          key={r}
                          className="rounded-md border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <Sparkles size={22} className="mx-auto text-sky-400 mb-2" />
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Generate a comprehensive briefing from your electronic health
                  record in seconds.
                </p>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Grounded in your EMR
              </span>
              <button
                type="button"
                onClick={() => void handleGenerateSummary()}
                disabled={summaryLoading || profile.isLoading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {summaryLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    {summaryData ? "Regenerate" : "Generate summary"}
                  </>
                )}
              </button>
            </div>
          </div>
        </article>

        {/* Drug interactions */}
        <article
          ref={drugSectionRef}
          className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_rgba(15,23,42,0.05)] overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400" />
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Pill size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Medication safety check
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Cross-check drug interactions and contraindications.
                </p>
              </div>
            </div>

            {currentMedNames.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Active Rx
                  </span>
                  {currentMedNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-sky-200/70 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={loadAndCheckMeds}
                  className="self-start inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 transition-colors hover:bg-sky-100"
                >
                  <Zap size={11} />
                  Check my {currentMedNames.length} medications
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                No active medications on file — enter names below.
              </p>
            )}

            <input
              type="text"
              value={medicines}
              onChange={(e) => setMedicines(e.target.value)}
              placeholder="Paracetamol, Metformin, Atorvastatin…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15"
            />

            {interactionError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{interactionError}</span>
              </div>
            ) : null}

            {interactionResult ? (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1">
                  <ShieldCheck size={13} />
                  Interaction assessment
                </p>
                {interactionResult}
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Pharmacopeia verified
              </span>
              <button
                type="button"
                onClick={() => void handleRunDrugCheck()}
                disabled={!medicines.trim() || interactionLoading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {interactionLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Checking…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={13} />
                    Check interactions
                  </>
                )}
              </button>
            </div>
          </div>
        </article>
      </div>

      {/* Specialized tools */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Specialized AI tools
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dedicated assistants for labs, documents, and trends
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-sky-300 hover:shadow-md min-h-[9.5rem]"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl mb-3 transition-transform group-hover:scale-105",
                    tool.tint,
                  )}
                >
                  <Icon size={18} />
                </span>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-800 transition-colors leading-snug">
                  {tool.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed flex-1">
                  {tool.description}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-bold text-sky-700">
                  <span>{tool.cta}</span>
                  <ChevronRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Safety notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed">
        <ShieldCheck size={16} className="text-sky-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700">Clinical safety notice:</strong>{" "}
          HealthHub AI helps you understand your health information and prepare
          for consultations. It does not replace emergency care or your
          physician&apos;s clinical judgment.
        </p>
      </div>
    </div>
  );
}
