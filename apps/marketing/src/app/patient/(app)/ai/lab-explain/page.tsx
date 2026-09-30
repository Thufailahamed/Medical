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
  Copy,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import { formatDayLabel } from "@/patient/lib/format";
import { AiToolHero } from "@/patient/components/ai/AiToolHero";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  EmptyBlock,
  HERO_PRIMARY,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientPage,
  PRIMARY_BTN,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

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

  async function explain(id: string = selectedRecordId) {
    if (!id) {
      setError("Please select a lab report to analyze.");
      return;
    }

    if (id === "sample-report") {
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
        json: { reportId: id },
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

  const actionTiles = [
    { href: "/patient/records/new", label: "Upload PDF", hint: "Hospital e-results", icon: Upload, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
    { href: "/patient/records/scan", label: "Scan paper", hint: "Camera capture", icon: Camera, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
  ];

  return (
    <PatientPage>
      <AiToolHero
        icon={<FlaskConical size={13} aria-hidden />}
        badge="Lab interpreter"
        title="Explain a lab report"
        description="Turn lab values, blood panels and reference ranges into plain English you can actually use."
        trust={["Plain English", "Non-diagnostic", "Cached 24h"]}
        actions={
          <Link href="/patient/records/new" className={HERO_PRIMARY}>
            <Plus size={15} className="text-sky-600" aria-hidden />
            Upload lab report
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="le-pick">
            <PanelHeader
              id="le-pick"
              icon={<FlaskConical size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Choose a lab report"
              caption={records.isLoading ? "Loading your reports…" : `${labRecords.length} lab report${labRecords.length === 1 ? "" : "s"} on file`}
              href="/patient/records"
              linkLabel="All records"
            />

            {records.isLoading ? (
              <PanelSkeleton rows={2} />
            ) : labRecords.length > 0 ? (
              <div role="radiogroup" aria-label="Lab reports" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {labRecords.map((r) => {
                  const on = selectedRecordId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSelectedRecordId(r.id)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl bg-white p-3.5 text-left transition-all hover:-translate-y-px",
                        on
                          ? "shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1.5px_#0284c7]"
                          : "shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-[10px]",
                          on ? "bg-sky-600 text-white" : "bg-emerald-50 text-emerald-600",
                        )}
                        aria-hidden
                      >
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-sky-700">{r.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <Calendar size={11} aria-hidden />
                          {formatDayLabel(r.date)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                          on ? "bg-sky-600 text-white" : "shadow-[inset_0_0_0_1.5px_rgba(15,23,42,0.15)]",
                        )}
                        aria-hidden
                      >
                        {on ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyBlock
                icon={<FlaskConical size={19} />}
                title="No lab reports yet"
                body="Upload a lab PDF from your hospital, photograph a paper report, or try the sample panel to see how it works."
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecordId("sample-report");
                      void explain("sample-report");
                    }}
                    className={PRIMARY_BTN}
                  >
                    <Sparkles size={13} aria-hidden />
                    Try sample panel
                  </button>
                }
              />
            )}

            {error ? (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={14} className="shrink-0" aria-hidden />
                {error}
              </div>
            ) : null}

            {labRecords.length > 0 ? (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="hidden text-[11px] text-slate-400 sm:inline">Results are cached for 24 hours</span>
                <button
                  type="button"
                  onClick={() => void explain()}
                  disabled={!selectedRecordId || busy}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
                  {busy ? "Explaining…" : "Explain in plain English"}
                </button>
              </div>
            ) : null}
          </section>

          {busy && !explanation ? (
            <section className={PANEL} aria-busy>
              <PanelSkeleton rows={4} className="mt-0" />
            </section>
          ) : null}

          {explanation ? (
            <section className={PANEL} aria-labelledby="le-result">
              <PanelHeader
                id="le-result"
                icon={<CheckCircle2 size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Plain-English summary"
                caption="AI-translated lab readout"
                action={
                  <button type="button" onClick={handleCopy} className={cn(SECONDARY_BTN, "h-8 px-3")}>
                    {copied ? <Check size={12} className="text-emerald-600" aria-hidden /> : <Copy size={12} aria-hidden />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                }
              />
              <div className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                {explanation}
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                  For understanding only — not a diagnosis. Discuss anything unusual with your doctor.
                </p>
                <Link
                  href={`/patient/ai/chat?prompt=${encodeURIComponent("Help me understand my lab results in more detail: " + explanation.slice(0, 150))}`}
                  className={cn(PRIMARY_BTN, "shrink-0")}
                >
                  <MessageSquare size={13} aria-hidden />
                  Ask a follow-up
                </Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Add a report">
          <section className={PANEL} aria-labelledby="le-add">
            <div className="flex items-center justify-between gap-3">
              <h2 id="le-add" className="text-[15.5px] font-semibold tracking-[-0.01em] text-slate-900">
                Add a report
              </h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">One click</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {actionTiles.map((t) => {
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105", t.tone)}>
                      <Icon size={19} aria-hidden />
                    </span>
                    <span className="w-full min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">{t.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{t.hint}</span>
                    </span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSelectedRecordId("sample-report");
                  void explain("sample-report");
                }}
                className="group flex flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105">
                  <Sparkles size={19} aria-hidden />
                </span>
                <span className="w-full min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-slate-900">Sample</span>
                  <span className="block truncate text-[11px] text-slate-400">Demo panel</span>
                </span>
              </button>
            </div>
          </section>

          <Link
            href="/patient/ai/lab-trend"
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white transition-all hover:-translate-y-0.5"
            style={{
              background:
                "radial-gradient(420px 200px at 100% 0%, rgba(45,212,191,0.30), transparent 60%), linear-gradient(135deg, #07233a 0%, #0c4a6e 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px -18px rgba(7,35,58,0.6)",
            }}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-teal-200 ring-1 ring-inset ring-white/15">
              <Bot size={21} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-teal-200/80">Next</span>
              <span className="mt-1 block text-base font-semibold">See trends over time</span>
              <span className="block text-xs text-white/60">HbA1c, cholesterol, kidney markers</span>
            </span>
          </Link>

          <AiSafetyNotice />
        </aside>
      </div>
    </PatientPage>
  );
}
