"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  MessageSquare,
  Plus,
  Scan,
  Sparkles,
  Upload,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { PageHero, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const SAMPLE_EXPLANATION = `**Comprehensive Metabolic & Lipid Panel (Sample Analysis)**

1. **Fasting Blood Glucose: 92 mg/dL**
   • **Clinical Status:** Normal & Healthy (Reference range: 70–99 mg/dL).
   • **What it means:** Your body is managing blood sugar effectively. No signs of insulin resistance or prediabetes.

2. **Total Cholesterol: 185 mg/dL**
   • **Clinical Status:** Desirable (Reference range: < 200 mg/dL).
   • **What it means:** Your overall circulating cholesterol is within a heart-healthy range.

3. **HDL ("Good" Cholesterol): 54 mg/dL**
   • **Clinical Status:** Optimal (Reference range: > 40 mg/dL for men, > 50 mg/dL for women).
   • **What it means:** HDL removes excess cholesterol from arterial walls, reducing cardiovascular risk.

4. **LDL ("Bad" Cholesterol): 108 mg/dL**
   • **Clinical Status:** Near Optimal (Reference range: < 100 mg/dL optimal, 100–129 near optimal).
   • **What it means:** Slightly above strictly optimal targets. Continue with a balanced Mediterranean-style diet.

5. **Kidney Function (eGFR: > 90 mL/min & Creatinine: 0.9 mg/dL)**
   • **Clinical Status:** Excellent kidney filtration.`;

export default function AiLabExplainPage() {
  const router = useRouter();
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const records = useQuery<{
    records: Array<{ id: string; title: string; date: string; recordType: string }>;
  }>({
    queryKey: ["patient", "ai", "lab-explain-records"],
    queryFn: () =>
      api<{
        records: Array<{ id: string; title: string; date: string; recordType: string }>;
      }>("/medical-records/me?type=lab&limit=20"),
  });

  const labRecords = records.data?.records ?? [];

  async function explain() {
    if (!selectedRecordId) {
      setError("Please select a lab report to analyze.");
      return;
    }

    if (selectedRecordId === "sample-report") {
      setBusy(true);
      setError(null);
      setTimeout(() => {
        setExplanation(SAMPLE_EXPLANATION);
        setBusy(false);
      }, 700);
      return;
    }

    setError(null);
    setBusy(true);
    setExplanation(null);
    try {
      const res = await api<{ explanation: string }>("/ai/explain/lab-report", {
        method: "POST",
        json: { reportId: selectedRecordId },
      });
      setExplanation(res.explanation);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't generate a clinical explanation. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!explanation) return;
    void navigator.clipboard.writeText(explanation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<FlaskConical size={13} aria-hidden />}
        kicker="Pathology Language Translation"
        title="Explain a Lab Report"
        description="Translate medical lab values, blood panels, and reference intervals into simple, understandable plain English."
        actions={
          <>
            <Link href="/patient/ai/chat" className={heroSecondaryAction}>
              <Bot size={13} aria-hidden />
              AI Chat Assistant
            </Link>
            <Link href="/patient/records/new" className={heroPrimaryAction}>
              <Plus size={14} aria-hidden />
              Upload Lab Report
            </Link>
          </>
        }
        footer={
          <>
            <span>Pathology AI · Plain English</span>
            <span>Data Security · HIPAA Zero-Log</span>
            <span>Analysis Speed · Cached 24h</span>
            <span>Physician Oversight · Non-Diagnostic</span>
          </>
        }
      />

      {/* ── 2. Select Lab Report Stage ─────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-7 shadow-card flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="t-card-title text-text flex items-center gap-2">
              <FlaskConical size={18} className="text-brand" aria-hidden />
              <span>Choose a Lab Report to Analyze</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Select an existing pathology file from your electronic health record.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/patient/records/new"
              className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
            >
              <Upload size={12} aria-hidden />
              Upload New PDF
            </Link>
            <Link
              href="/patient/records/scan"
              className="pt-btn pt-btn-ghost h-8 px-3 text-xs"
            >
              <Camera size={12} aria-hidden />
              Scan Paper
            </Link>
          </div>
        </div>

        {records.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : labRecords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {labRecords.map((r) => {
              const isSelected = selectedRecordId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRecordId(r.id)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer group shadow-2xs",
                    isSelected
                      ? "bg-brand-soft/40 border-brand shadow-card"
                      : "bg-surface border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-md shrink-0 shadow-2xs",
                        isSelected
                          ? "bg-ink text-white"
                          : "bg-surface-2 text-text-muted",
                      )}
                      aria-hidden
                    >
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-text truncate group-hover:text-brand transition-colors">
                        {r.title}
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                        <Calendar size={11} aria-hidden />
                        <span>{r.date}</span>
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border shrink-0 mt-1",
                      isSelected
                        ? "bg-brand border-brand text-white"
                        : "border-border bg-surface",
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Zero-State when no lab reports are in EHR ──────────────────── */
          <div className="rounded-xl border border-border bg-surface-2/50 p-6 sm:p-8 flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-surface text-brand shadow-xs" aria-hidden>
              <FlaskConical size={24} />
            </div>

            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                No Lab Reports Uploaded Yet
              </h3>
              <p className="text-xs text-text-soft mt-1 leading-relaxed">
                You can upload a digital laboratory PDF from your hospital patient portal, photograph a physical paper report, or try our sample panel below.
              </p>
            </div>

            {/* 3 Quick Action Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-2 text-left">
              <Link
                href="/patient/records/new"
                className="p-4 rounded-xl bg-surface border border-border hover:border-border-strong hover:shadow-card transition-all flex flex-col gap-2 group cursor-pointer"
              >
                <div className="grid h-8 w-8 place-items-center rounded-md bg-brand-soft text-brand" aria-hidden>
                  <Upload size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text group-hover:text-brand transition-colors">
                    Upload Lab PDF
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Direct hospital e-results
                  </p>
                </div>
              </Link>

              <Link
                href="/patient/records/scan"
                className="p-4 rounded-xl bg-surface border border-border hover:border-border-strong hover:shadow-card transition-all flex flex-col gap-2 group cursor-pointer"
              >
                <div className="grid h-8 w-8 place-items-center rounded-md bg-success-soft text-success" aria-hidden>
                  <Scan size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text group-hover:text-success transition-colors">
                    Scan Paper Copy
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Camera OCR recognition
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSelectedRecordId("sample-report");
                  void explain();
                }}
                className="p-4 rounded-xl bg-ink text-white hover:brightness-110 transition-all flex flex-col gap-2 group cursor-pointer text-left"
              >
                <div className="grid h-8 w-8 place-items-center rounded-md bg-white/10 text-white" aria-hidden>
                  <Sparkles size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs">
                    Try Sample Panel
                  </h4>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    Metabolic &amp; Lipid demo
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-lg bg-danger-soft border border-danger/25 text-xs font-semibold text-danger flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {/* Explain Button */}
        {labRecords.length > 0 && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={explain}
              disabled={!selectedRecordId || busy}
              className="pt-btn pt-btn-primary h-11 px-6 text-xs disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Synthesizing Plain English Analysis…
                </>
              ) : (
                <>
                  <Sparkles size={14} aria-hidden />
                  Generate Plain-English Explanation
                </>
              )}
            </button>

            <span className="text-xs text-text-muted font-medium hidden sm:inline">
              Cached 24h for instant retrieval
            </span>
          </div>
        )}
      </section>

      {/* ── 3. Generated Plain-English Explanation Card ────────────────────── */}
      {explanation && (
        <section className="rounded-xl border border-brand/25 bg-surface p-6 sm:p-7 shadow-card flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-success-soft text-success" aria-hidden>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="t-card-title text-text">
                  Plain-English Lab Summary
                </h3>
                <p className="text-xs text-text-soft">
                  AI-translated clinical pathology readout
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                    Copy Summary
                  </>
                )}
              </button>

              <Link
                href={`/patient/ai/chat?prompt=${encodeURIComponent(
                  "Help me understand my lab results in more detail: " +
                    explanation.slice(0, 150),
                )}`}
                className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
              >
                <MessageSquare size={12} aria-hidden />
                Ask AI Follow-Up
              </Link>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-text text-xs sm:text-sm leading-relaxed p-4 rounded-lg bg-surface-2 font-normal">
            <div className="whitespace-pre-wrap">{explanation}</div>
          </div>

          <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-start gap-2.5 text-[11px] text-text-soft">
            <Info size={14} className="text-text-muted shrink-0 mt-0.5" aria-hidden />
            <span>
              This explanation is generated by clinical language models for patient educational understanding. It does not constitute a diagnostic prescription. Always discuss anomalous numbers with your primary care doctor.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
