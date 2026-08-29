"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, Send, Check, Loader2 } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useRateTest } from "@/patient/hooks/diagnostic";

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
      await rate.mutateAsync({ id, rating, review: review || undefined });
      setSubmitted(true);
      setTimeout(() => router.push(`/patient/diagnostic-tests/bookings/${id}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <Check size={28} aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-text">Thanks for your feedback!</h2>
        <p className="text-sm text-text-soft">Redirecting…</p>
      </div>
    );
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
        title="Rate this test"
        description="Help other patients pick the right lab by sharing your experience."
      />

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <p className="t-label">Your rating</p>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  className="rounded-pill p-1 transition-transform hover:scale-110"
                  aria-label={`${i} star${i === 1 ? "" : "s"}`}
                >
                  <Star
                    size={32}
                    aria-hidden
                    strokeWidth={1.5}
                    className={
                      i <= (hovered || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-text-muted"
                    }
                  />
                </button>
              ))}
            </div>
            {rating > 0 ? (
              <p className="mt-2 text-sm font-semibold text-amber-600">
                {labels[rating]}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="review" className="t-label block">
              Review <span className="text-text-muted">(optional)</span>
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-brand"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={rate.isPending || rating === 0}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {rate.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={14} aria-hidden />
                  Submit rating
                </>
              )}
            </button>
            <Link
              href={`/patient/diagnostic-tests/bookings/${id}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border px-5 py-2.5 text-sm font-semibold text-text-soft"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
