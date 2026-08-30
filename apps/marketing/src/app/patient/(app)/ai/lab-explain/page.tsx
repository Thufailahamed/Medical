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
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  Upload,
  Zap,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

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
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
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

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <FlaskConical size={12} className="text-sky-300" />
                Pathology Language Translation
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Explain a Lab Report
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Translate medical lab values, blood panels, and reference intervals into simple, understandable plain English.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/ai/chat"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <Bot size={13} />
                <span>AI Chat Assistant</span>
              </Link>
              <Link
                href="/patient/records/new"
                className="hero-action-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
                style={{ color: "#0c4a6e" }}
              >
                <Plus size={14} className="text-sky-700" style={{ color: "#0284c7" }} />
                <span style={{ color: "#0c4a6e" }}>Upload Lab Report</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <TestTube2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Pathology AI
                </p>
                <p className="text-base font-extrabold text-white">Plain English</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Data Security
                </p>
                <p className="text-base font-extrabold text-white">HIPAA Zero-Log</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-200 shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-amber-200 truncate">
                  Analysis Speed
                </p>
                <p className="text-base font-extrabold text-white">Cached 24h</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <Stethoscope size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Physician Oversight
                </p>
                <p className="text-base font-extrabold text-white">Non-Diagnostic</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Select Lab Report Stage ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical size={18} className="text-sky-600" />
              <span>Choose a Lab Report to Analyze</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an existing pathology file from your electronic health record.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/patient/records/new"
              className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200/60 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Upload size={12} />
              <span>Upload New PDF</span>
            </Link>
            <Link
              href="/patient/records/scan"
              className="text-xs font-bold text-slate-700 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Camera size={12} />
              <span>Scan Paper</span>
            </Link>
          </div>
        </div>

        {records.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
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
                    "p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer group shadow-2xs",
                    isSelected
                      ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-xs"
                      : "bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50/80",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                        isSelected
                          ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                          : "bg-slate-100 text-slate-500 border-slate-200",
                      )}
                    >
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate group-hover:text-sky-700 transition-colors">
                        {r.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={11} />
                        <span>{r.date}</span>
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-1",
                      isSelected
                        ? "bg-sky-600 border-sky-600 text-white"
                        : "border-slate-300 bg-white",
                    )}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Zero-State when no lab reports are in EHR ──────────────────── */
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 text-sky-600 flex items-center justify-center shadow-xs">
              <FlaskConical size={24} />
            </div>

            <div className="max-w-md">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                No Lab Reports Uploaded Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You can upload a digital laboratory PDF from your hospital patient portal, photograph a physical paper report, or try our sample panel below.
              </p>
            </div>

            {/* 3 Quick Action Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-2 text-left">
              <Link
                href="/patient/records/new"
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all flex flex-col gap-2 group cursor-pointer"
              >
                <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
                  <Upload size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-sky-700 transition-colors">
                    Upload Lab PDF
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Direct hospital e-results
                  </p>
                </div>
              </Link>

              <Link
                href="/patient/records/scan"
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col gap-2 group cursor-pointer"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Scan size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Scan Paper Copy
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
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
                className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 hover:border-sky-400 hover:bg-sky-50 hover:shadow-xs transition-all flex flex-col gap-2 group cursor-pointer"
              >
                <div className="h-8 w-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                  <Sparkles size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-sky-900">
                    Try Sample Panel
                  </h4>
                  <p className="text-[11px] text-sky-600 mt-0.5">
                    Metabolic &amp; Lipid demo
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Explain Button */}
        {labRecords.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={explain}
              disabled={!selectedRecordId || busy}
              className="px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Synthesizing Plain English Analysis…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate Plain-English Explanation</span>
                </>
              )}
            </button>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Cached 24h for instant retrieval
            </span>
          </div>
        )}
      </section>

      {/* ── 3. Generated Plain-English Explanation Card ────────────────────── */}
      {explanation && (
        <section className="rounded-2xl border border-sky-200 bg-white p-6 sm:p-7 shadow-md flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Plain-English Lab Summary
                </h3>
                <p className="text-xs text-slate-500">
                  AI-translated clinical pathology readout
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>

              <Link
                href={`/patient/ai/chat?prompt=${encodeURIComponent(
                  "Help me understand my lab results in more detail: " +
                    explanation.slice(0, 150),
                )}`}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare size={12} />
                <span>Ask AI Follow-Up</span>
              </Link>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-slate-800 text-xs sm:text-sm leading-relaxed p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 font-normal">
            <div className="whitespace-pre-wrap">{explanation}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-[11px] text-slate-500">
            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <span>
              This explanation is generated by clinical language models for patient educational understanding. It does not constitute a diagnostic prescription. Always discuss anomalous numbers with your primary care doctor.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
