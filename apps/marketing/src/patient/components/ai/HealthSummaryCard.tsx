"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { useGenerateSummary, type StructuredSummary } from "@/patient/hooks";

export interface HealthSummaryHandle {
  generate: () => void;
}

function summaryToText(summary: StructuredSummary) {
  return [
    summary.patientSummary,
    summary.diagnoses?.length ? `Diagnoses: ${summary.diagnoses.join(", ")}` : "",
    summary.medicines?.length ? `Medications: ${summary.medicines.join(", ")}` : "",
    summary.risks?.length ? `Risks: ${summary.risks.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const HealthSummaryCard = forwardRef<
  HealthSummaryHandle,
  { patientId: string; profileLoading?: boolean }
>(function HealthSummaryCard({ patientId, profileLoading = false }, ref) {
  const generateSummary = useGenerateSummary();
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (profileLoading) return;
    if (!patientId) {
      setError("Your health profile is still loading or unavailable. Refresh and try again.");
      return;
    }
    setError(null);
    try {
      setSummary(await generateSummary.mutateAsync(patientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate health summary.");
    }
  }

  useImperativeHandle(ref, () => ({ generate: () => void run() }));

  async function copySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summaryToText(summary));
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card accent="brand" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="t-card-title text-text">Health record summary</h2>
            <Pill tone="brand">EMR</Pill>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-text-soft">
            AI synthesizes visits, conditions and trends into plain language you
            can read in 30 seconds.
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex-1"
        aria-live="polite"
        aria-busy={generateSummary.isPending}
      >
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger"
          >
            <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void run()}
                className="mt-2 rounded-pill border border-danger/30 bg-white px-2.5 py-1 text-[11px] font-bold text-danger hover:bg-danger-soft"
              >
                Retry
              </button>
            </div>
          </div>
        ) : generateSummary.isPending ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-7/12" />
          </div>
        ) : summary ? (
          <div className="relative rounded-xl border border-border bg-surface-2 p-3.5">
            <button
              type="button"
              onClick={() => void copySummary()}
              aria-label="Copy summary"
              className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-white text-text-muted transition-colors hover:text-text"
            >
              {copied ? (
                <Check size={12} aria-hidden className="text-success" />
              ) : (
                <Copy size={12} aria-hidden />
              )}
            </button>
            <p className="pr-7 text-xs leading-relaxed text-text">
              {summary.patientSummary}
            </p>
            {summary.diagnoses?.length ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="t-label">Diagnoses</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.diagnoses.map((d) => (
                    <Pill key={d} tone="brand">
                      {d}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
            {summary.risks?.length ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="t-label">Risk factors</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.risks.map((r) => (
                    <Pill key={r} tone="warn">
                      {r}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/60 p-6 text-center">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white text-brand">
              <Sparkles size={16} aria-hidden />
            </span>
            <p className="mt-2.5 text-xs font-bold text-text">
              Generate your briefing
            </p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-text-soft">
              A comprehensive briefing from your electronic health record, in
              seconds.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
          <ShieldCheck size={12} aria-hidden className="text-success" />
          Grounded in your EMR
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={generateSummary.isPending || profileLoading}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand px-3.5 text-xs font-bold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
        >
          {generateSummary.isPending ? (
            <>
              <Loader2 size={13} aria-hidden className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles size={13} aria-hidden />
              {summary ? "Regenerate" : "Generate summary"}
            </>
          )}
        </button>
      </div>
    </Card>
  );
});
