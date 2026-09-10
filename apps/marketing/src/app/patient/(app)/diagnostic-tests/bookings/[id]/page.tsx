"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  FileText,
  Star,
  ExternalLink,
  CreditCard,
  StickyNote,
  Ban,
  RefreshCw,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useTestBooking,
  useCancelTestBooking,
  useRescheduleTestBooking,
  useInitiateTestPayment,
} from "@/patient/hooks/diagnostic";
import { formatDayLabel, humanize } from "@/patient/lib/format";

const TIMELINE = [
  { key: "pending", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Phlebotomist assigned" },
  { key: "sample_collection_en_route", label: "En route" },
  { key: "sample_collected", label: "Sample collected" },
  { key: "in_progress", label: "Processing" },
  { key: "completed", label: "Report ready" },
];

const CANCELLABLE = ["pending", "confirmed", "phlebotomist_assigned", "sample_collection_en_route"];
const RESCHEDULABLE = ["pending", "confirmed", "phlebotomist_assigned"];

export default function TestBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useTestBooking(id);
  const cancel = useCancelTestBooking();
  const reschedule = useRescheduleTestBooking();
  const pay = useInitiateTestPayment();
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newSlot, setNewSlot] = useState("morning");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doCancel() {
    setErr(null);
    setMsg(null);
    try {
      const res = await cancel.mutateAsync({ id, reason: reason || undefined });
      const refunded = (res.booking as any)?.paymentStatus === "refunded";
      setMsg(refunded ? "Booking cancelled. Your payment will be refunded." : "Booking cancelled.");
      query.refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not cancel booking.");
    }
  }

  async function doReschedule() {
    if (!newDate || !newSlot) return;
    setErr(null);
    setMsg(null);
    try {
      await reschedule.mutateAsync({ id, date: newDate, slot: newSlot });
      setMsg(`Rescheduled to ${newDate}. The lab will re-confirm.`);
      query.refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reschedule booking.");
    }
  }

  async function doPayNow() {
    setErr(null);
    try {
      const res = await pay.mutateAsync({ bookingId: id });
      if (res.checkoutUrl) {
        const url = `${res.checkoutUrl}?${new URLSearchParams(res.fields as Record<string, string>).toString()}`;
        window.open(url, "_blank", "noopener");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start payment.");
    }
  }

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
          const b: any = data.booking;
          const title = b.itemName || b.packageName || "Test booking";
          const when = b.scheduledDate
            ? `${formatDayLabel(`${b.scheduledDate}T00:00:00`)} · ${b.scheduledTimeSlot}`
            : formatDayLabel(b.scheduledAt);
          const amount = b.totalPrice ?? b.totalAmount ?? 0;
          const resultUrl = b.resultPdfUrl ?? b.resultUrl ?? null;
          const stepIdx = TIMELINE.findIndex((s) => s.key === b.status);
          const showPayRetry =
            (b.paymentStatus === "pending" || b.paymentStatus === "failed") &&
            b.paymentMethod !== "cash" &&
            !["cancelled", "completed", "rescheduled"].includes(b.status);
          return (
            <>
              <SectionHeader
                label="Diagnostics"
                title={title}
                description={`Scheduled ${when}`}
                action={
                  <StatusPill tone={statusTone(b.status)}>
                    {humanize(b.status)}
                  </StatusPill>
                }
              />

              {msg ? <p role="status" className="text-sm font-semibold text-success">{msg}</p> : null}
              {err ? <p role="alert" className="text-sm text-danger">{err}</p> : null}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="flex flex-col gap-5 lg:col-span-7">
                  <Card>
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} aria-hidden className="text-text-muted" />
                        {when}
                      </div>
                      {b.labName ? (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} aria-hidden className="text-text-muted" />
                          {b.labName}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} aria-hidden className="text-text-muted" />
                        LKR {Number(amount).toLocaleString()} · {humanize(b.paymentStatus ?? "pending")} · {humanize(b.paymentMethod ?? "cash")}
                      </div>
                      {showPayRetry ? (
                        <button
                          type="button"
                          onClick={doPayNow}
                          disabled={pay.isPending}
                          className="self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {pay.isPending ? "Starting payment…" : "Pay now"}
                        </button>
                      ) : null}
                      {b.cancellationReason ? (
                        <div className="flex items-start gap-2 rounded-inner bg-surface-2 p-3">
                          <Ban size={14} aria-hidden className="text-text-muted" />
                          <span>Cancelled: {b.cancellationReason}</span>
                        </div>
                      ) : null}
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
                          {resultUrl ? (
                            <a
                              href={resultUrl}
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

                  {CANCELLABLE.includes(b.status) ? (
                    <Card>
                      <h3 className="text-sm font-bold text-text">Cancel booking</h3>
                      <p className="mt-1 text-xs text-text-soft">
                        {b.paymentStatus === "paid"
                          ? "Paid bookings are auto-flagged for refund to the original method."
                          : "The lab will be notified so the visit can be stood down."}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="h-10 flex-1 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text"
                        />
                        <button
                          type="button"
                          onClick={doCancel}
                          disabled={cancel.isPending}
                          className="rounded-pill bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {cancel.isPending ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    </Card>
                  ) : null}

                  {RESCHEDULABLE.includes(b.status) ? (
                    <Card>
                      <h3 className="text-sm font-bold text-text">Reschedule</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text"
                        />
                        <input
                          value={newSlot}
                          onChange={(e) => setNewSlot(e.target.value)}
                          placeholder="e.g. morning"
                          className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text"
                        />
                        <button
                          type="button"
                          onClick={doReschedule}
                          disabled={reschedule.isPending || !newDate || !newSlot}
                          className="inline-flex items-center justify-center gap-1 rounded-pill border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-60"
                        >
                          <RefreshCw size={14} aria-hidden /> Reschedule
                        </button>
                      </div>
                    </Card>
                  ) : null}
                </div>

                <div className="flex flex-col gap-5 lg:col-span-5">
                  <Card>
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">Timeline</h3>
                      <ol className="flex flex-col gap-2 text-sm text-text-soft">
                        {TIMELINE.map((s) => (
                          <Step key={s.key} done={stepIdx >= 0 && TIMELINE.findIndex((x) => x.key === s.key) <= stepIdx} label={s.label} />
                        ))}
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
  if (status === "sample_collected" || status === "processing" || status === "in_progress") return "warn";
  if (status === "cancelled") return "danger";
  return "info";
}
