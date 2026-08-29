"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FlaskConical,
  ListChecks,
  Clock,
  Tag,
  Calendar,
  Check,
  Loader2,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useBookTestPackage, useTestPackage } from "@/patient/hooks/diagnostic";

export default function TestPackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const query = useTestPackage(slug);
  const book = useBookTestPackage();
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onBook() {
    if (!scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    setError(null);
    try {
      const result = await book.mutateAsync({ slug, scheduledAt, notes: notes || undefined });
      router.push(`/patient/diagnostic-tests/bookings/${result.booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book this test.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/diagnostic-tests/packages"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to packages
      </Link>

      <QueryBoundary
        query={query}
        loadingCount={3}
        emptyTitle="Package not found"
      >
        {(data) => {
          const p = data.package;
          return (
            <>
              <SectionHeader
                label="Diagnostics"
                title={p.name}
                description={p.description || "Pick a slot and we'll handle the rest."}
                action={
                  <div className="flex flex-col items-end">
                    <p className="text-2xl font-extrabold text-text">
                      LKR {p.price.toLocaleString()}
                    </p>
                    {p.originalPrice && p.originalPrice > p.price ? (
                      <p className="text-xs text-text-muted line-through">
                        LKR {p.originalPrice.toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                }
              />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="flex flex-col gap-5 lg:col-span-7">
                  <Card>
                    <div className="flex flex-col gap-3">
                      <h2 className="text-sm font-bold text-text">
                        What's included ({p.tests.length})
                      </h2>
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {p.tests.map((t) => (
                          <li
                            key={t}
                            className="flex items-center gap-2 rounded-inner bg-surface-2 p-2 text-sm text-text"
                          >
                            <Check size={12} aria-hidden className="text-success" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>

                  {p.preparation ? (
                    <Card accent="amber">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-text">
                          How to prepare
                        </h3>
                        <p className="text-sm text-text-soft">{p.preparation}</p>
                      </div>
                    </Card>
                  ) : null}

                  <Card>
                    <div className="flex flex-col gap-3 text-sm text-text-soft">
                      <div className="flex items-center gap-2">
                        <Clock size={14} aria-hidden className="text-text-muted" />
                        {p.reportTimeHours
                          ? `Report in ${p.reportTimeHours} hours`
                          : "Report time varies by lab"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag size={14} aria-hidden className="text-text-muted" />
                        NABL-accredited labs only
                      </div>
                      <div className="flex items-center gap-2">
                        <FlaskConical size={14} aria-hidden className="text-text-muted" />
                        Home sample collection available
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="flex flex-col gap-5 lg:col-span-5">
                  <Card accent="brand">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">Book this package</h3>
                      <div>
                        <label className="t-label block">When?</label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                        />
                      </div>
                      <div>
                        <label className="t-label block">
                          Notes <span className="text-text-muted">(optional)</span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                        />
                      </div>
                      {error ? (
                        <p role="alert" className="text-sm text-danger">
                          {error}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={onBook}
                        disabled={book.isPending || !scheduledAt}
                        className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {book.isPending ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Booking…
                          </>
                        ) : (
                          <>
                            <Calendar size={14} aria-hidden /> Book now
                          </>
                        )}
                      </button>
                    </div>
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
