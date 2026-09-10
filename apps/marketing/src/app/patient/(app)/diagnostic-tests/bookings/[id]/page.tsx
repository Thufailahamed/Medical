"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  FlaskConical,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  MapPin,
  Microscope,
  Phone,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Star,
  StickyNote,
  TestTube2,
  Timer,
  X,
  XCircle,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { StatTile } from "@/patient/components/primitives/StatTile";
import {
  useTestBooking,
  useCancelTestBooking,
  useRescheduleTestBooking,
  useInitiateTestPayment,
} from "@/patient/hooks/diagnostic";
import {
  formatDayLabel,
  humanize,
  formatRelative,
} from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

/* ── Pipeline (kept aligned with the list page) ───────────────────── */
const PIPELINE: {
  key: string;
  label: string;
  description: string;
  icon: typeof Activity;
}[] = [
  {
    key: "pending",
    label: "Booked",
    description: "Your request was submitted to the lab",
    icon: CalendarDays,
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Lab accepted and scheduled the visit",
    icon: CheckCircle2,
  },
  {
    key: "phlebotomist_assigned",
    label: "Phlebotomist assigned",
    description: "A phlebotomist has been routed to you",
    icon: Microscope,
  },
  {
    key: "sample_collection_en_route",
    label: "En route",
    description: "Phlebotomist is on the way to your address",
    icon: MapPin,
  },
  {
    key: "sample_collected",
    label: "Sample collected",
    description: "Specimen received at the lab",
    icon: TestTube2,
  },
  {
    key: "in_progress",
    label: "Processing",
    description: "Sample is being analysed",
    icon: FlaskConical,
  },
  {
    key: "completed",
    label: "Report ready",
    description: "Your report is signed and available",
    icon: FileText,
  },
];

const CANCELLABLE = [
  "pending",
  "confirmed",
  "phlebotomist_assigned",
  "sample_collection_en_route",
];
const RESCHEDULABLE = ["pending", "confirmed", "phlebotomist_assigned"];

function pipelineIndex(status: string): number {
  if (status === "cancelled") return -1;
  return PIPELINE.findIndex((s) => s.key === status);
}

function statusTone(
  status: string
): "success" | "warn" | "danger" | "neutral" | "info" | "brand" {
  if (status === "completed") return "success";
  if (
    status === "sample_collected" ||
    status === "processing" ||
    status === "in_progress"
  )
    return "warn";
  if (status === "cancelled") return "danger";
  if (status === "confirmed") return "brand";
  return "info";
}

function paymentTone(
  p?: string
): "success" | "warn" | "danger" | "neutral" {
  switch (p) {
    case "paid":
      return "success";
    case "cash_on_collection":
    case "pending":
      return "warn";
    case "failed":
    case "refunded":
      return "danger";
    default:
      return "neutral";
  }
}

function paymentAccent(
  p?: string
): "brand" | "sky" | "violet" | "amber" | "green" | "rose" | "none" {
  switch (p) {
    case "paid":
      return "green";
    case "cash_on_collection":
    case "pending":
      return "amber";
    case "failed":
    case "refunded":
      return "rose";
    default:
      return "none";
  }
}

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReschedule, setConfirmReschedule] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(
    null,
  );

  async function doCancel() {
    setMsg(null);
    try {
      const res = await cancel.mutateAsync({ id, reason: reason || undefined });
      const refunded = (res.booking as any)?.paymentStatus === "refunded";
      setMsg({
        tone: "success",
        text: refunded
          ? "Booking cancelled. Your payment will be refunded to the original method."
          : "Booking cancelled. The lab has been notified.",
      });
      setReason("");
      setConfirmCancel(false);
      query.refetch();
    } catch (e) {
      setMsg({
        tone: "danger",
        text: e instanceof Error ? e.message : "Could not cancel booking.",
      });
    }
  }

  async function doReschedule() {
    if (!newDate || !newSlot) return;
    setMsg(null);
    try {
      await reschedule.mutateAsync({ id, date: newDate, slot: newSlot });
      setMsg({
        tone: "success",
        text: `Rescheduled to ${formatDayLabel(`${newDate}T00:00:00`)} (${newSlot}). The lab will re-confirm.`,
      });
      setNewDate("");
      setNewSlot("morning");
      setConfirmReschedule(false);
      query.refetch();
    } catch (e) {
      setMsg({
        tone: "danger",
        text:
          e instanceof Error ? e.message : "Could not reschedule booking.",
      });
    }
  }

  async function doPayNow() {
    setMsg(null);
    try {
      const res = await pay.mutateAsync({ bookingId: id });
      if (res.checkoutUrl) {
        const url = `${res.checkoutUrl}?${new URLSearchParams(
          res.fields as Record<string, string>,
        ).toString()}`;
        window.open(url, "_blank", "noopener");
      }
    } catch (e) {
      setMsg({
        tone: "danger",
        text: e instanceof Error ? e.message : "Could not start payment.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* ── Back link ─────────────────────────────────────────────── */}
      <Link
        href="/patient/diagnostic-tests/bookings"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-text-soft transition-colors hover:text-brand self-start"
      >
        <ChevronLeft size={14} aria-hidden /> Back to bookings
      </Link>

      <QueryBoundary
        query={query}
        loadingCount={3}
        emptyTitle="Booking not found"
        emptyDescription="This booking may have been deleted or the link is incorrect."
      >
        {(data) => {
          const b: any = data.booking;
          const title = b.itemName || b.packageName || "Test booking";
          const when = b.scheduledDate
            ? `${formatDayLabel(`${b.scheduledDate}T00:00:00`)} · ${b.scheduledTimeSlot}`
            : formatDayLabel(b.scheduledAt);
          const amount = b.totalPrice ?? b.totalAmount ?? 0;
          const resultUrl = b.resultPdfUrl ?? b.resultUrl ?? null;
          const showPayRetry =
            (b.paymentStatus === "pending" || b.paymentStatus === "failed") &&
            b.paymentMethod !== "cash" &&
            !["cancelled", "completed", "rescheduled"].includes(b.status);

          return (
            <>
              {/* ── 1. Premium hero ─────────────────────────────── */}
              <BookingHero
                title={title}
                status={b.status}
                when={when}
                amount={amount}
                paymentStatus={b.paymentStatus}
                paymentMethod={b.paymentMethod}
                bookingId={b.id}
                scheduledDate={b.scheduledDate}
                scheduledAt={b.scheduledAt}
                onReschedule={
                  RESCHEDULABLE.includes(b.status)
                    ? () => setConfirmReschedule(true)
                    : null
                }
                onCancel={
                  CANCELLABLE.includes(b.status) ? () => setConfirmCancel(true) : null
                }
              />

              {/* ── Status banners ───────────────────────────────── */}
              {msg ? (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-md border px-4 py-3 text-[13px] font-medium",
                    msg.tone === "success"
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                      : msg.tone === "danger"
                        ? "border-rose-200 bg-rose-50/80 text-rose-800"
                        : "border-sky-200 bg-sky-50/80 text-sky-800",
                  )}
                  role="status"
                >
                  {msg.tone === "success" ? (
                    <CheckCircle2
                      size={15}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />
                  ) : (
                    <AlertCircle
                      size={15}
                      className="text-rose-600 shrink-0 mt-0.5"
                    />
                  )}
                  <span className="flex-1">{msg.text}</span>
                  <button
                    type="button"
                    onClick={() => setMsg(null)}
                    className="text-text-muted hover:text-text"
                    aria-label="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : null}

              {b.cancellationReason ? (
                <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50/80 px-4 py-3 text-[13px] text-rose-800">
                  <Ban size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Cancellation reason: </span>
                    <span>{b.cancellationReason}</span>
                  </div>
                </div>
              ) : null}

              {/* ── 2. Main grid: left content + sticky right rail ─ */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="flex flex-col gap-5 lg:col-span-8">
                  {/* Summary tiles */}
                  <SummaryTiles
                    when={when}
                    scheduledDate={b.scheduledDate}
                    labName={b.labName}
                    amount={amount}
                    paymentStatus={b.paymentStatus}
                    paymentMethod={b.paymentMethod}
                  />

                  {/* Timeline */}
                  <Card className="!p-0 overflow-hidden">
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[14.5px] font-bold text-text">
                          Status timeline
                        </h3>
                        <p className="text-[11.5px] text-text-soft mt-0.5">
                          Live progress from your request to the report.
                        </p>
                      </div>
                      <StatusPill
                        tone={statusTone(b.status)}
                        icon={statusPillIcon(b.status)}
                      >
                        {humanize(b.status)}
                      </StatusPill>
                    </div>
                    <div className="px-5 pb-5">
                      <VerticalTimeline status={b.status} createdAt={b.createdAt} />
                    </div>
                  </Card>

                  {/* Report (if completed) */}
                  {b.status === "completed" ? (
                    <Card accent="brand" className="!p-0 overflow-hidden">
                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-10 w-10 place-items-center rounded-xl text-white"
                            style={{
                              background:
                                "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)",
                            }}
                            aria-hidden
                          >
                            <FileText size={18} />
                          </span>
                          <div>
                            <h3 className="text-[15px] font-bold text-text">
                              Your report is ready
                            </h3>
                            <p className="text-[12px] text-text-soft">
                              Signed and uploaded by the lab
                            </p>
                          </div>
                        </div>
                        {b.resultSummary ? (
                          <div className="rounded-md border border-border bg-surface-1 p-3.5 text-[13px] text-text-soft leading-relaxed">
                            {b.resultSummary}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {resultUrl ? (
                            <a
                              href={resultUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-brand/90 transition-colors"
                            >
                              <ExternalLink size={13} /> Open full report
                            </a>
                          ) : null}
                          <Link
                            href={`/patient/diagnostic-tests/bookings/${b.id}/result`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
                          >
                            <Sparkles size={13} className="text-brand" />
                            Explain with AI
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ) : null}

                  {/* Patient notes */}
                  {b.notes ? (
                    <Card>
                      <div className="flex items-start gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-700 shrink-0">
                          <StickyNote size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[12.5px] font-bold text-text">
                            Notes for the phlebotomist
                          </h3>
                          <p className="mt-1 text-[13px] text-text-soft leading-relaxed">
                            {b.notes}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                </div>

                {/* ── Right rail (sticky) ──────────────────────── */}
                <aside className="flex flex-col gap-5 lg:col-span-4">
                  <div className="lg:sticky lg:top-[88px] flex flex-col gap-5">
                    {/* Payment summary */}
                    <Card accent={paymentAccent(b.paymentStatus)} className="!p-0 overflow-hidden">
                      <div className="p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-muted">
                            Payment summary
                          </h3>
                          <StatusPill tone={paymentTone(b.paymentStatus)}>
                            {humanize(b.paymentStatus ?? "pending")}
                          </StatusPill>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10.5px] font-semibold text-text-muted">
                            LKR
                          </span>
                          <span className="text-[28px] font-extrabold tabular-nums tracking-tight text-text">
                            {Number(amount).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-text-soft flex items-center gap-1.5">
                          <CreditCard size={12} className="text-text-muted" />
                          {humanize(b.paymentMethod ?? "cash")}
                        </div>
                        {showPayRetry ? (
                          <button
                            type="button"
                            onClick={doPayNow}
                            disabled={pay.isPending}
                            className="mt-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-brand text-[12.5px] font-semibold text-white shadow-sm hover:bg-brand/90 disabled:opacity-60 transition-colors"
                          >
                            {pay.isPending ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                Starting payment…
                              </>
                            ) : (
                              <>
                                <CreditCard size={13} />
                                Pay now
                              </>
                            )}
                          </button>
                        ) : b.paymentStatus === "paid" ? (
                          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-emerald-700 font-semibold">
                            <CheckCircle2 size={13} />
                            Payment received
                          </div>
                        ) : b.paymentStatus === "cash_on_collection" ? (
                          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-700 font-semibold">
                            <Timer size={13} />
                            Pay cash on collection
                          </div>
                        ) : null}
                      </div>
                    </Card>

                    {/* Lab info */}
                    {b.labName ? (
                      <Card>
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald-50 text-emerald-700 shrink-0">
                            <Building2 size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                              Performing lab
                            </h3>
                            <p className="text-[14px] font-bold text-text mt-0.5 truncate">
                              {b.labName}
                            </p>
                            {b.collectionAddress ? (
                              <p className="mt-1 text-[12px] text-text-soft leading-relaxed">
                                {b.collectionAddress.line1}
                                {b.collectionAddress.city
                                  ? `, ${b.collectionAddress.city}`
                                  : ""}
                              </p>
                            ) : null}
                            {b.collectionAddress?.contactPhone ? (
                              <a
                                href={`tel:${b.collectionAddress.contactPhone}`}
                                className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
                              >
                                <Phone size={12} />
                                {b.collectionAddress.contactPhone}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    ) : null}

                    {/* Need help */}
                    <Card>
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-50 text-sky-700 shrink-0">
                          <HelpCircle size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[13px] font-bold text-text">
                            Need help with this booking?
                          </h3>
                          <p className="mt-1 text-[12px] text-text-soft leading-relaxed">
                            Our care team can reschedule, debug a payment, or
                            chase the lab for a delayed report.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href="mailto:care@healthhub.lk"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
                            >
                              <Mail size={12} /> Email
                            </a>
                            <a
                              href="tel:+94112345678"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
                            >
                              <PhoneCall size={12} /> Call
                            </a>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Booking ID + meta */}
                    <div className="rounded-md border border-dashed border-border bg-surface-1/60 p-3.5 text-[11px] text-text-soft">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className="text-text-muted">Booking ID</span>
                        <span className="text-text font-semibold truncate">
                          {b.id}
                        </span>
                      </div>
                      {b.createdAt ? (
                        <div className="mt-1.5 flex items-center justify-between gap-2 font-mono">
                          <span className="text-text-muted">Booked</span>
                          <span className="text-text font-semibold">
                            {formatRelative(b.createdAt)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </aside>
              </div>

              {/* ── 3. Cancel / Reschedule actions row ─────────── */}
              {(CANCELLABLE.includes(b.status) ||
                RESCHEDULABLE.includes(b.status) ||
                b.status === "completed") && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-text-muted mr-2">
                    Manage booking
                  </span>
                  {RESCHEDULABLE.includes(b.status) ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReschedule(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
                    >
                      <RefreshCw size={13} /> Reschedule
                    </button>
                  ) : null}
                  {CANCELLABLE.includes(b.status) ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                    >
                      <XCircle size={13} /> Cancel booking
                    </button>
                  ) : null}
                  {b.status === "completed" ? (
                    <Link
                      href={`/patient/diagnostic-tests/bookings/${b.id}/rate`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/70 px-3 text-[12.5px] font-semibold text-amber-700 hover:bg-amber-50 hover:border-amber-300 transition-colors"
                    >
                      <Star size={13} /> Rate experience
                    </Link>
                  ) : null}
                </div>
              )}
            </>
          );
        }}
      </QueryBoundary>

      {/* ── Reschedule modal ─────────────────────────────── */}
      {confirmReschedule ? (
        <ModalShell
          title="Reschedule booking"
          subtitle="Pick a new date and time slot. The lab will re-confirm."
          onClose={() => setConfirmReschedule(false)}
          tone="brand"
        >
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                New date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Time slot
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["morning", "afternoon", "evening", "night"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewSlot(s)}
                    className={cn(
                      "h-10 rounded-md border text-[12px] font-semibold transition-colors",
                      newSlot === s
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-surface text-text-soft hover:border-brand/40 hover:text-text",
                    )}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ModalFoot
              onCancel={() => setConfirmReschedule(false)}
              onConfirm={doReschedule}
              confirmLabel="Reschedule"
              confirmIcon={<RefreshCw size={13} />}
              busy={reschedule.isPending}
              disabled={!newDate}
            />
          </div>
        </ModalShell>
      ) : null}

      {/* ── Cancel modal ──────────────────────────────────── */}
      {confirmCancel ? (
        <ModalShell
          title="Cancel this booking?"
          subtitle="The lab will be notified so the visit can be stood down."
          onClose={() => setConfirmCancel(false)}
          tone="danger"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-[12.5px] text-amber-900">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                If you paid online, your refund will be initiated to the
                original payment method.
              </span>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Schedule conflict, found another lab, etc."
                className="mt-1.5 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 resize-none"
              />
            </div>
            <ModalFoot
              onCancel={() => setConfirmCancel(false)}
              onConfirm={doCancel}
              confirmLabel="Cancel booking"
              confirmIcon={<XCircle size={13} />}
              busy={cancel.isPending}
              confirmTone="danger"
            />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Hero
 * ──────────────────────────────────────────────────────────────────── */
function BookingHero({
  title,
  status,
  when,
  amount,
  paymentStatus,
  paymentMethod,
  bookingId,
  scheduledDate,
  scheduledAt,
  onReschedule,
  onCancel,
}: {
  title: string;
  status: string;
  when: string;
  amount: number;
  paymentStatus?: string;
  paymentMethod?: string;
  bookingId: string;
  scheduledDate?: string;
  scheduledAt?: string;
  onReschedule: (() => void) | null;
  onCancel: (() => void) | null;
}) {
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isActive = !isCompleted && !isCancelled;
  const shortId = bookingId.length > 10 ? bookingId.slice(-6).toUpperCase() : bookingId;
  return (
    <section
      className="relative overflow-hidden rounded-3xl text-white shadow-xl"
      style={{
        background: isCancelled
          ? "linear-gradient(135deg, #4C0519 0%, #881337 50%, #9F1239 100%)"
          : isCompleted
            ? "linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%)"
            : "linear-gradient(135deg, #082F49 0%, #0369A1 50%, #0284C7 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 75%)",
        }}
      />

      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
            <FlaskConical size={11} />
            Diagnostics
          </span>
          <span className="font-mono text-[10.5px] text-white/70">
            #{shortId}
          </span>
          <StatusPill tone="neutral" className="!bg-white/15 !text-white !border !border-white/20">
            {humanize(status)}
          </StatusPill>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-end">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.1] truncate">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} className="text-white/70" />
                {when}
              </span>
              {paymentStatus ? (
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard size={13} className="text-white/70" />
                  LKR {Number(amount).toLocaleString()} ·{" "}
                  {humanize(paymentMethod ?? "cash")}
                </span>
              ) : null}
              {scheduledAt || scheduledDate ? (
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  <Timer size={13} />
                  {scheduledAt
                    ? formatRelative(scheduledAt)
                    : `Booked ${formatRelative(scheduledDate! + "T00:00:00")}`}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-2 lg:items-end shrink-0">
            {isActive ? (
              <>
                {onReschedule ? (
                  <button
                    type="button"
                    onClick={onReschedule}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3.5 text-[12.5px] font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    <RefreshCw size={13} /> Reschedule
                  </button>
                ) : null}
                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3.5 text-[12.5px] font-bold text-white hover:bg-rose-500/30 transition-colors"
                  >
                    <XCircle size={13} /> Cancel
                  </button>
                ) : null}
              </>
            ) : isCompleted ? (
              <Link
                href={`/patient/diagnostic-tests/bookings/${bookingId}/rate`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 backdrop-blur-md px-3.5 text-[12.5px] font-bold text-white hover:bg-white/25 transition-colors"
              >
                <Star size={13} /> Rate experience
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Summary tiles row
 * ──────────────────────────────────────────────────────────────────── */
function SummaryTiles({
  when,
  scheduledDate,
  labName,
  amount,
  paymentStatus,
  paymentMethod,
}: {
  when: string;
  scheduledDate?: string;
  labName?: string | null;
  amount: number;
  paymentStatus?: string;
  paymentMethod?: string;
}) {
  const date = scheduledDate ? `${scheduledDate}T00:00:00` : null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-md border border-border bg-surface-1 p-4 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          <Calendar size={11} /> Scheduled
        </span>
        <span className="text-[13px] font-bold text-text leading-tight">
          {date ? formatDayLabel(date) : "TBD"}
        </span>
        <span className="text-[11px] text-text-soft truncate">{when}</span>
      </div>
      <div className="rounded-md border border-border bg-surface-1 p-4 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          <Building2 size={11} /> Lab
        </span>
        <span className="text-[13px] font-bold text-text leading-tight truncate">
          {labName || "Assigned at confirmation"}
        </span>
        <span className="text-[11px] text-text-soft">
          {labName ? "Verified partner" : "Awaiting assignment"}
        </span>
      </div>
      <div className="rounded-md border border-border bg-surface-1 p-4 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          <CreditCard size={11} /> Total
        </span>
        <span className="text-[16px] font-extrabold tabular-nums text-text">
          LKR {Number(amount).toLocaleString()}
        </span>
        <span className="text-[11px] text-text-soft">
          {humanize(paymentMethod ?? "cash")} · {humanize(paymentStatus ?? "pending")}
        </span>
      </div>
      <div className="rounded-md border border-border bg-surface-1 p-4 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          <Phone size={11} /> Contact
        </span>
        <span className="text-[13px] font-bold text-text leading-tight">
          Lab partner
        </span>
        <span className="text-[11px] text-text-soft">
          Will reach you before visit
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Vertical timeline
 * ──────────────────────────────────────────────────────────────────── */
function VerticalTimeline({
  status,
  createdAt: _createdAt,
}: {
  status: string;
  createdAt?: string;
}) {
  const stage = pipelineIndex(status);
  const isCancelled = status === "cancelled";
  return (
    <ol className="relative pl-7">
      {/* vertical rail */}
      <span
        className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-border"
        aria-hidden
      />
      {PIPELINE.map((s, i) => {
        const done = !isCancelled && i < stage;
        const current = !isCancelled && i === stage;
        const Icon = s.icon;
        return (
          <li
            key={s.key}
            className={cn(
              "relative pb-4 last:pb-0",
              isCancelled && "opacity-50",
            )}
          >
            {/* Dot */}
            <span
              className={cn(
                "absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors",
                done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : current
                    ? "bg-brand border-brand text-white shadow-[0_0_0_4px_rgba(2,132,199,0.15)]"
                    : "bg-surface-1 border-border text-text-muted",
              )}
              aria-hidden
            >
              {done ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    current ? "bg-white" : "bg-text-muted",
                  )}
                />
              )}
            </span>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-tight",
                    done
                      ? "text-text"
                      : current
                        ? "text-brand"
                        : "text-text-soft",
                  )}
                >
                  {s.label}
                </p>
                <p className="text-[11.5px] text-text-muted mt-0.5">
                  {s.description}
                </p>
              </div>
              {current ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                  Now
                </span>
              ) : done ? (
                <span className="shrink-0 text-[10.5px] font-mono text-emerald-600 font-semibold">
                  Done
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
      {isCancelled ? (
        <li className="relative">
          <span
            className="absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 bg-rose-500 border-rose-500 text-white"
            aria-hidden
          >
            <X size={11} strokeWidth={3} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-rose-700">
              Cancelled
            </p>
            <p className="text-[11.5px] text-text-muted mt-0.5">
              This booking will not proceed. You can book a new test any time.
            </p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────── */
function statusPillIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={11} />;
    case "cancelled":
      return <XCircle size={11} />;
    case "confirmed":
      return <CheckCircle2 size={11} />;
    case "in_progress":
    case "processing":
    case "sample_collected":
      return <TestTube2 size={11} />;
    case "sample_collection_en_route":
    case "phlebotomist_assigned":
      return <MapPin size={11} />;
    default:
      return <Clock size={11} />;
  }
}

/* ─────────────────────────────────────────────────────────────────────
 *  Modal shell
 * ──────────────────────────────────────────────────────────────────── */
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  tone = "brand",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  tone?: "brand" | "danger";
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-md border border-border bg-surface shadow-xl overflow-hidden anim-rise">
        <div
          className="h-1 w-full"
          style={{
            background:
              tone === "danger"
                ? "linear-gradient(90deg, #F43F5E 0%, #E11D48 100%)"
                : "linear-gradient(90deg, #38BDF8 0%, #0369A1 100%)",
          }}
        />
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="text-[15px] font-bold text-text">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-[12.5px] text-text-soft leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalFoot({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmIcon,
  busy,
  disabled,
  confirmTone = "brand",
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  confirmTone?: "brand" | "danger";
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
      >
        Close
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60 transition-colors",
          confirmTone === "danger"
            ? "bg-rose-600 hover:bg-rose-700"
            : "bg-brand hover:bg-brand/90",
        )}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}
