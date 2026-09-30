"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, FileText, FlaskConical, Loader2, Sparkles } from "lucide-react";

import { useTestBooking } from "@/patient/hooks/diagnostic";
import { usePatientProfile } from "@/patient/hooks";
import { api, ApiError } from "@/portal/lib/api";
import {
  EmptyBlock,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
} from "@/patient/components/workspace";

export default function TestResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
      // Real path: explain by bookingId (not packageId — packageId is the
      // catalog package, not the result report).
      const res = await api<{ explanation: string }>("/ai/explain/lab-report", {
        method: "POST",
        json: {
          reportId: id,
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

  const summary = booking.data?.booking.resultSummary;

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<FileText size={13} aria-hidden />}
        kicker="Lab bookings"
        kickerMeta={`Booking ${id.slice(0, 8)}…`}
        title={
          <>
            Result &amp; <HeroAccent>explanation</HeroAccent>
          </>
        }
        description="View the report and ask the AI assistant to explain it in plain English."
        actions={
          <Link href={`/patient/diagnostic-tests/bookings/${id}`} className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            Back to booking
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="rs-summary">
            <PanelHeader
              id="rs-summary"
              icon={<FileText size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Report summary"
              caption="What the lab found"
            />
            {booking.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : summary ? (
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {summary}
              </p>
            ) : (
              <EmptyBlock
                icon={<FileText size={19} />}
                title="No report summary yet"
                body="The lab hasn't uploaded a written summary for this booking. It will appear here when it does."
              />
            )}
          </section>

          <section className={PANEL} aria-labelledby="rs-ai">
            <PanelHeader
              id="rs-ai"
              icon={<Sparkles size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Explain in plain English"
              caption="AI reads your report — always confirm with your doctor"
            />
            <div className="mt-4 flex flex-col gap-4">
              {error ? (
                <p role="alert" className="text-sm font-medium text-rose-600">
                  {error}
                </p>
              ) : null}
              {explanation ? (
                <p className="whitespace-pre-wrap rounded-xl bg-violet-50/60 p-4 text-sm leading-relaxed text-slate-700 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.15)]">
                  {explanation}
                </p>
              ) : null}
              <button
                type="button"
                onClick={explain}
                disabled={busy || booking.isLoading}
                className="inline-flex h-10 items-center gap-2 self-start rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} aria-hidden />
                    {explanation ? "Regenerate" : "Explain report"}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Result tools">
          <QuickToolsPanel
            id="rs-tools"
            tools={[
              { href: `/patient/diagnostic-tests/bookings/${id}`, label: "Booking", hint: "Full details", icon: CalendarDays, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/diagnostic-tests/bookings", label: "All bookings", hint: "Track orders", icon: FlaskConical, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
            ]}
          />
          <PromoCard
            href="/patient/ai"
            kicker="AI assistant"
            icon={<Sparkles size={21} aria-hidden />}
            title="Questions about your results?"
            body="Chat with the assistant about what they mean"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
