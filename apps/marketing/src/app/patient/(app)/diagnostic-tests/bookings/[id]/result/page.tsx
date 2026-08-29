"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, Sparkles, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useTestBooking } from "@/patient/hooks/diagnostic";
import { usePatientProfile } from "@/patient/hooks";
import { api, ApiError } from "@/portal/lib/api";

export default function TestResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const booking = useTestBooking(id);
  const profile = usePatientProfile();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explain() {
    if (!booking.data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ explanation: string }>("/ai/explain/lab-report", {
        method: "POST",
        json: {
          reportId: booking.data.booking.packageId,
          patientId: profile.data?.patient.patients.id,
        },
      });
      setExplanation(res.explanation);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't explain the report. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href={`/patient/diagnostic-tests/bookings/${id}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to booking
      </Link>

      <SectionHeader
        label="Diagnostics"
        title="Result & explanation"
        description="View the report and ask the AI assistant to explain it in plain English."
      />

      {booking.data?.booking.resultSummary ? (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileText size={16} aria-hidden className="text-brand" />
              <h2 className="text-sm font-bold text-text">Report summary</h2>
            </div>
            <p className="whitespace-pre-wrap text-sm text-text">
              {booking.data.booking.resultSummary}
            </p>
          </div>
        </Card>
      ) : null}

      <Card accent="brand">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} aria-hidden className="text-brand" />
            <h2 className="text-sm font-bold text-text">Explain in plain English</h2>
          </div>
          <p className="text-xs text-text-soft">
            The AI assistant reads your full report and turns the medical terms
            into language you can use. Always confirm with your doctor.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {explanation ? (
            <p className="whitespace-pre-wrap rounded-inner bg-surface-2 p-3 text-sm text-text">
              {explanation}
            </p>
          ) : null}
          <button
            type="button"
            onClick={explain}
            disabled={busy}
            className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : explanation ? (
              "Regenerate"
            ) : (
              "Explain report"
            )}
          </button>
        </div>
      </Card>
    </div>
  );
}
