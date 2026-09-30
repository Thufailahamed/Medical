"use client";

import { useState } from "react";
import { AlertCircle, FileText, Loader2, Sparkles, Stethoscope } from "lucide-react";

import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { AiToolHero } from "@/patient/components/ai/AiToolHero";
import { AiSafetyNotice } from "@/patient/components/ai/AiSafetyNotice";
import {
  EmptyBlock,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  PANEL,
  PanelHeader,
  PatientPage,
} from "@/patient/components/workspace";

interface NoteSummary {
  summary: string;
  keyTerms: string[];
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

const SOAP = [
  { key: "subjective", letter: "S", label: "Subjective", hint: "What you reported", tone: "bg-sky-50 text-sky-700" },
  { key: "objective", letter: "O", label: "Objective", hint: "What was measured", tone: "bg-violet-50 text-violet-700" },
  { key: "assessment", letter: "A", label: "Assessment", hint: "The doctor's view", tone: "bg-amber-50 text-amber-700" },
  { key: "plan", letter: "P", label: "Plan", hint: "What happens next", tone: "bg-emerald-50 text-emerald-700" },
] as const;

export default function AiClinicalNotePage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NoteSummary | null>(null);

  async function run() {
    if (!note.trim() || !patientId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<NoteSummary>("/ai/clinical-note-summary", {
        method: "POST",
        json: { noteText: note, patientId },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't summarize the note. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const words = note.trim() ? note.trim().split(/\s+/).length : 0;

  return (
    <PatientPage>
      <AiToolHero
        icon={<FileText size={13} aria-hidden />}
        badge="Clinical note"
        title="Summarize a clinical note"
        description="Paste a long note from your doctor and we'll structure it into Subjective, Objective, Assessment and Plan — in plain language."
        trust={["Never stored or trained on", "Plain English"]}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="cn-input">
            <PanelHeader
              id="cn-input"
              icon={<FileText size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Paste the note"
              caption="Doctor's notes, discharge summaries and consult letters work best"
            />
            <label htmlFor="cn-text" className="sr-only">Clinical note</label>
            <textarea
              id="cn-text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={10}
              placeholder="Patient presented with…"
              className={cn(FIELD_TEXTAREA, "mt-5 font-mono text-[13px] leading-relaxed")}
            />
            {error ? (
              <div role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={14} className="shrink-0" aria-hidden />
                {error}
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-[11px] tabular-nums text-slate-400">{words} word{words === 1 ? "" : "s"}</span>
              <button
                type="button"
                onClick={run}
                disabled={!note.trim() || busy || !patientId}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-px hover:bg-sky-700 disabled:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
              >
                {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
                {busy ? "Summarizing…" : "Summarize note"}
              </button>
            </div>
          </section>

          {result ? (
            <section className={PANEL} aria-labelledby="cn-soap">
              <PanelHeader id="cn-soap" icon={<Stethoscope size={16} />} tone="bg-sky-50 text-sky-600" title="SOAP breakdown" caption="How clinicians structure a visit" />
              <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SOAP.map((row) => (
                  <div key={row.key} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold", row.tone)} aria-hidden>
                      {row.letter}
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium text-slate-400">
                        {row.label} · {row.hint}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{result.soap?.[row.key] || "—"}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Summary">
          <section className={PANEL} aria-labelledby="cn-summary">
            <PanelHeader id="cn-summary" icon={<Sparkles size={16} />} tone="bg-indigo-50 text-indigo-600" title="Quick summary" caption={result ? "Read this first" : "Appears after you summarize"} />
            {result ? (
              <>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{result.summary}</p>
                {result.keyTerms?.length ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className={GROUP_LABEL}>Key terms</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.keyTerms.map((t) => (
                        <span key={t} className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyBlock icon={<Sparkles size={19} />} title="Nothing yet" body="Paste a note and press Summarize to see a plain-language summary here." />
            )}
          </section>
          <AiSafetyNotice />
        </aside>
      </div>
    </PatientPage>
  );
}
