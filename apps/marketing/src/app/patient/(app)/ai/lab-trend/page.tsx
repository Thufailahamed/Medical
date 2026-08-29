"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp, Sparkles, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { usePatientProfile } from "@/patient/hooks";

const COMMON_TESTS = [
  "HbA1c",
  "Total Cholesterol",
  "LDL",
  "HDL",
  "Triglycerides",
  "Fasting Glucose",
  "TSH",
  "Vitamin D",
  "Hemoglobin",
  "Creatinine",
];

export default function AiLabTrendPage() {
  const profile = usePatientProfile();
  const patientId = profile.data?.patient.patients.id ?? "";
  const [test, setTest] = useState("HbA1c");
  const [busy, setBusy] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!test.trim() || !patientId) return;
    setBusy(true);
    setError(null);
    setNarrative(null);
    try {
      const res = await api<{ narrative: string }>(
        `/ai/lab-trend/${patientId}`,
        {
          method: "GET",
        }
      );
      setNarrative(res.narrative);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't load the trend. Try a different test."
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
        title="Lab trend narrative"
        description="See how a lab value has moved over time and what the trend means for you."
      />

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-text">Pick a test</h2>

          <div className="flex flex-wrap gap-2">
            {COMMON_TESTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTest(t)}
                className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  test === t
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-1 text-text hover:border-brand"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="test" className="t-label block">
              Or type your own
            </label>
            <input
              id="test"
              type="text"
              value={test}
              onChange={(e) => setTest(e.target.value)}
              placeholder="e.g. HbA1c"
              className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={run}
            disabled={!test.trim() || busy || !patientId}
            className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Reading chart…
              </>
            ) : (
              <>
                <TrendingUp size={14} aria-hidden /> Show trend
              </>
            )}
          </button>
        </div>
      </Card>

      {narrative ? (
        <Card accent="brand">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} aria-hidden className="text-brand" />
              <h2 className="text-sm font-bold text-text">
                {test} — what the trend means
              </h2>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {narrative}
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
