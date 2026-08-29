"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Sparkles, Loader2, AlertCircle } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { useQuery } from "@tanstack/react-query";

interface LabResultRow {
  id: string;
  test: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "normal" | "high" | "critical" | null;
  collectedAt: string;
}

export default function AiLabExplainPage() {
  const router = useRouter();
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const records = useQuery<{ records: Array<{ id: string; title: string; date: string; recordType: string }> }>({
    queryKey: ["patient", "ai", "lab-explain-records"],
    queryFn: () =>
      api<{ records: Array<{ id: string; title: string; date: string; recordType: string }> }>(
        "/medical-records/me?type=lab&limit=20"
      ),
  });

  async function explain() {
    if (!selectedRecordId) {
      setError("Select a record first.");
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
          : "Couldn't generate an explanation. Try again later."
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
        title="Explain a lab report"
        description="Pick a lab report and we'll turn the medical jargon into plain English you can use."
      />

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-text">Choose a lab report</h2>
          <p className="text-xs text-text-soft">
            We use the report you already uploaded. The explanation is generated
            once and cached for 24 hours.
          </p>

          {records.isLoading ? (
            <p className="text-sm text-text-soft">Loading…</p>
          ) : records.data?.records && records.data.records.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {records.data.records.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRecordId(r.id)}
                    className={`flex w-full items-center gap-3 rounded-inner border p-3 text-left transition-colors ${
                      selectedRecordId === r.id
                        ? "border-brand bg-brand-soft"
                        : "border-[color:var(--color-border)] bg-surface-1 hover:border-brand"
                    }`}
                  >
                    <FileText size={16} aria-hidden className="text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {r.title}
                      </p>
                      <p className="text-xs text-text-soft">{r.date}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-inner bg-surface-2 p-3 text-sm text-text-soft">
              No lab reports yet.{" "}
              <Link
                href="/patient/records/new"
                className="font-semibold text-brand hover:underline"
              >
                Add one
              </Link>{" "}
              or{" "}
              <Link
                href="/patient/records/scan"
                className="font-semibold text-brand hover:underline"
              >
                scan a paper copy
              </Link>
              .
            </div>
          )}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={explain}
            disabled={!selectedRecordId || busy}
            className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden /> Explain report
              </>
            )}
          </button>
        </div>
      </Card>

      {explanation ? (
        <Card accent="brand">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} aria-hidden className="text-brand" />
              <h2 className="text-sm font-bold text-text">Plain English summary</h2>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {explanation}
            </p>
            <p className="border-t border-surface-3 pt-3 text-[11px] text-text-muted">
              Generated by AI. For medical decisions, always talk to your care
              team.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
