"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, MessageSquare, Send, ShieldCheck, Star } from "lucide-react";

import { useRateAppointment } from "@/patient/hooks/doctors";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function RateVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rate = useRateAppointment();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Please choose a rating.");
      return;
    }
    setError(null);
    try {
      await rate.mutateAsync({
        appointmentId: id,
        rating,
        review: review.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        router.push(`/patient/appointments/${id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    }
  }

  const shown = hovered || rating;

  return (
    <PatientPage className="max-w-[960px]">
      <PatientHero
        overlap={false}
        kickerIcon={<Star size={13} aria-hidden />}
        kicker="Visit feedback"
        title={
          <>
            How was your <HeroAccent>visit</HeroAccent>?
          </>
        }
        description="Your feedback helps other patients pick the right doctor and helps clinics improve care."
        chips={
          <span className={HERO_CHIP}>
            <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
            Shared with the clinic anonymously
          </span>
        }
        actions={
          <Link href={`/patient/appointments/${id}`} className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            Back to visit
          </Link>
        }
      />

      {submitted ? (
        <section className={cn(PANEL, "flex flex-col items-center py-12 text-center")}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <Check size={26} strokeWidth={2.75} aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Thanks for your feedback!</h2>
          <p className="mt-1 text-sm text-slate-500">Taking you back to your visit…</p>
        </section>
      ) : (
        <form onSubmit={onSubmit} className={PANEL} aria-labelledby="rate-form">
          <PanelHeader
            id="rate-form"
            icon={<Star size={16} />}
            tone="bg-amber-50 text-amber-600"
            title="Your rating"
            caption="Tap a star — 5 is excellent"
          />

          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl bg-slate-50 px-4 py-6">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  className="rounded-xl p-1.5 transition-transform hover:scale-110"
                  aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
                  aria-pressed={rating === i}
                >
                  <Star
                    size={36}
                    aria-hidden
                    strokeWidth={1.5}
                    className={i <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                  />
                </button>
              ))}
            </div>
            <p className={cn("h-5 text-sm font-semibold", shown ? "text-amber-600" : "text-slate-400")}>
              {shown ? LABELS[shown] : "No rating yet"}
            </p>
          </div>

          <div className="mt-5">
            <label htmlFor="review" className={FIELD_LABEL}>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={13} className="text-slate-400" aria-hidden />
                Tell us more <span className="font-normal text-slate-400">(optional)</span>
              </span>
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={5}
              placeholder="What did you like? What could be better?"
              className={FIELD_TEXTAREA}
            />
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Link href={`/patient/appointments/${id}`} className={cn(SECONDARY_BTN, "h-10")}>
              Skip for now
            </Link>
            <button
              type="submit"
              disabled={rate.isPending || rating === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              <Send size={14} aria-hidden />
              {rate.isPending ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        </form>
      )}
    </PatientPage>
  );
}
