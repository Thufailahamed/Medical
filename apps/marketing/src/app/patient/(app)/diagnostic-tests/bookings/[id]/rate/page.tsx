"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, Send, CheckCircle2, Loader2, StarHalf } from "lucide-react";

import { useRateTest } from "@/patient/hooks/diagnostic";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

export default function RateTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const rate = useRateTest();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Please choose a rating.");
      return;
    }
    setError(null);
    try {
      // Real path: POST /diagnostic-tests/bookings/:id/rating {score, comment}.
      await rate.mutateAsync({ id, score: rating, comment: review || undefined });
      setSubmitted(true);
      setTimeout(() => router.push(`/patient/diagnostic-tests/bookings/${id}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    }
  }

  if (submitted) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<Star size={13} aria-hidden />}
          kicker="Lab bookings"
          title={
            <>
              Thanks for your <HeroAccent>feedback</HeroAccent>
            </>
          }
          description="Your rating helps other patients pick the right lab. Redirecting back to your booking…"
          actions={
            <Link href={`/patient/diagnostic-tests/bookings/${id}`} className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Back to booking
            </Link>
          }
        />
        <section className={PANEL}>
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={26} aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">Rating submitted</p>
            <p className="mt-1 text-xs text-slate-500">Taking you back to the booking details…</p>
          </div>
        </section>
      </PatientPage>
    );
  }

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<Star size={13} aria-hidden />}
        kicker="Lab bookings"
        kickerMeta={`Booking ${id.slice(0, 8)}…`}
        title={
          <>
            Rate this <HeroAccent>test</HeroAccent>
          </>
        }
        description="Help other patients pick the right lab by sharing your experience."
        actions={
          <Link href={`/patient/diagnostic-tests/bookings/${id}`} className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            Back to booking
          </Link>
        }
      />

      <section className={cn(PANEL, "mx-auto w-full max-w-2xl")} aria-labelledby="rate-form">
        <PanelHeader
          id="rate-form"
          icon={<StarHalf size={16} />}
          tone="bg-amber-50 text-amber-600"
          title="Your rating"
          caption="A score and a few words go a long way"
        />

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  className="rounded-full p-1 transition-transform hover:scale-110"
                  aria-label={`${i} star${i === 1 ? "" : "s"}`}
                >
                  <Star
                    size={32}
                    aria-hidden
                    strokeWidth={1.5}
                    className={
                      i <= (hovered || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }
                  />
                </button>
              ))}
            </div>
            {rating > 0 ? (
              <p className="mt-2 text-sm font-semibold text-amber-600">{labels[rating]}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="review" className={FIELD_LABEL}>
              Review <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={5}
              placeholder="How was the collection, the lab, the report turnaround?"
              className={FIELD_TEXTAREA}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={rate.isPending || rating === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {rate.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={14} aria-hidden />
                  Submit rating
                </>
              )}
            </button>
            <Link href={`/patient/diagnostic-tests/bookings/${id}`} className={SECONDARY_BTN}>
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </PatientPage>
  );
}
