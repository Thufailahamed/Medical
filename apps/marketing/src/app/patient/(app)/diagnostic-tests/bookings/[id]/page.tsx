"use client";

import { use } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  FlaskConical,
  FileText,
  Star,
  ExternalLink,
  CreditCard,
  StickyNote,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useTestBooking } from "@/patient/hooks/diagnostic";
import { formatDayLabel, humanize } from "@/patient/lib/format";

export default function TestBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useTestBooking(id);

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/diagnostic-tests/bookings"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to bookings
      </Link>

      <QueryBoundary
        query={query}
        loadingCount={3}
        emptyTitle="Booking not found"
      >
        {(data) => {
          const b = data.booking;
          return (
            <>
              <SectionHeader
                label="Diagnostics"
                title={b.packageName}
                description={`Scheduled ${formatDayLabel(b.scheduledAt)}`}
                action={
                  <StatusPill tone={statusTone(b.status)}>
                    {humanize(b.status)}
                  </StatusPill>
                }
              />

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="flex flex-col gap-5 lg:col-span-7">
                  <Card>
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} aria-hidden className="text-text-muted" />
                        {formatDayLabel(b.scheduledAt)}
                      </div>
                      {b.labName ? (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} aria-hidden className="text-text-muted" />
                          {b.labName}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} aria-hidden className="text-text-muted" />
                        LKR {b.totalAmount.toLocaleString()} · {humanize(b.paymentStatus)}
                      </div>
                      {b.notes ? (
                        <div className="flex items-start gap-2 rounded-inner bg-surface-2 p-3">
                          <StickyNote size={14} aria-hidden className="text-text-muted" />
                          <span>{b.notes}</span>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  {b.status === "completed" ? (
                    <Card accent="brand">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} aria-hidden className="text-brand" />
                          <h3 className="text-sm font-bold text-text">Your report</h3>
                        </div>
                        {b.resultSummary ? (
                          <p className="text-sm text-text-soft">{b.resultSummary}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {b.resultUrl ? (
                            <a
                              href={b.resultUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                            >
                              <ExternalLink size={14} aria-hidden /> Open full report
                            </a>
                          ) : null}
                          <Link
                            href={`/patient/diagnostic-tests/bookings/${b.id}/result`}
                            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-soft"
                          >
                            Explain with AI
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                </div>

                <div className="flex flex-col gap-5 lg:col-span-5">
                  <Card>
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">Timeline</h3>
                      <ol className="flex flex-col gap-2 text-sm text-text-soft">
                        <Step done label="Booked" />
                        <Step
                          done={["sample_collected", "processing", "completed"].includes(b.status)}
                          label="Sample collected"
                        />
                        <Step
                          done={["processing", "completed"].includes(b.status)}
                          label="Processing"
                        />
                        <Step done={b.status === "completed"} label="Report ready" />
                      </ol>
                    </div>
                  </Card>

                  {b.status === "completed" ? (
                    <Card accent="amber">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-text">
                          Rate this experience
                        </h3>
                        <p className="text-xs text-text-soft">
                          Your feedback helps other patients choose the right
                          lab.
                        </p>
                        <Link
                          href={`/patient/diagnostic-tests/bookings/${b.id}/rate`}
                          className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                        >
                          <Star size={14} aria-hidden /> Rate
                        </Link>
                      </div>
                    </Card>
                  ) : null}
                </div>
              </div>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full ${
          done ? "bg-success text-white" : "bg-surface-3 text-text-muted"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <span className={done ? "text-text" : "text-text-muted"}>{label}</span>
    </li>
  );
}

function statusTone(
  status: string
): "success" | "warn" | "danger" | "neutral" | "info" {
  if (status === "completed") return "success";
  if (status === "sample_collected" || status === "processing") return "warn";
  if (status === "cancelled") return "danger";
  return "info";
}
