"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Stethoscope, Sparkles, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";

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
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't summarize the note. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/ai"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to AI tools
      </Link>

      <SectionHeader
        label="Care assistant"
        title="Summarize a clinical note"
        description="Paste a long note from your doctor and we'll structure it into Subjective, Objective, Assessment, and Plan."
      />

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Paste the note</h2>
          <p className="text-xs text-text-soft">
            Tip: doctor's notes, discharge summaries, and consult letters work
            best. We never store or train on your text.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={8}
            placeholder="Patient presented with..."
            className="w-full rounded-inner border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-brand"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={run}
            disabled={!note.trim() || busy || !patientId}
            className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Summarizing…
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden /> Summarize note
              </>
            )}
          </button>
        </div>
      </Card>

      {result ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card accent="brand">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Stethoscope size={16} aria-hidden className="text-brand" />
                <h2 className="text-sm font-bold text-text">Quick summary</h2>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {result.summary}
              </p>
              {result.keyTerms?.length ? (
                <div>
                  <p className="t-label">Key terms</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.keyTerms.map((t) => (
                      <span
                        key={t}
                        className="rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-text">SOAP</h2>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <SoapRow label="S — Subjective" value={result.soap?.subjective} />
                <SoapRow label="O — Objective" value={result.soap?.objective} />
                <SoapRow label="A — Assessment" value={result.soap?.assessment} />
                <SoapRow label="P — Plan" value={result.soap?.plan} />
              </dl>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function SoapRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="rounded-inner bg-surface-2 p-3">
      <p className="t-label">{label}</p>
      <p className="mt-1 text-sm text-text">{value || "—"}</p>
    </div>
  );
}
