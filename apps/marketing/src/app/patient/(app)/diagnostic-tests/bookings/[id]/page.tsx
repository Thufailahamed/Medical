"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Ban,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
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
  Wallet,
  X,
  XCircle,
} from "lucide-react";

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
import {
  Badge,
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  HERO_ATTENTION_CHIP,
  HERO_CHIP,
  HERO_DANGER_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  InfoField,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  SECONDARY_BTN,
  type Tone,
} from "@/patient/components/workspace";

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

type BookingDetail = {
  id: string;
  status: string;
  itemName?: string;
  packageName?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  scheduledAt?: string;
  labName?: string | null;
  totalPrice?: number;
  totalAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  resultPdfUrl?: string | null;
  resultUrl?: string | null;
  resultSummary?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  createdAt?: string;
  collectionAddress?: { line1?: string; city?: string; contactPhone?: string } | null;
};

function pipelineIndex(status: string): number {
  if (status === "cancelled") return -1;
  return PIPELINE.findIndex((s) => s.key === status);
}

function statusTone(status: string): Tone {
  if (status === "completed") return "emerald";
  if (
    status === "sample_collected" ||
    status === "processing" ||
    status === "in_progress"
  )
    return "amber";
  if (status === "cancelled") return "rose";
  if (status === "confirmed") return "sky";
  return "slate";
}

function paymentTone(p?: string): Tone {
  switch (p) {
    case "paid":
      return "emerald";
    case "cash_on_collection":
    case "pending":
      return "amber";
    case "failed":
    case "refunded":
      return "rose";
    default:
      return "slate";
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
      const refunded = (res.booking as { paymentStatus?: string } | undefined)?.paymentStatus === "refunded";
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
        window.open(res.checkoutUrl, "_blank", "noopener");
      }
    } catch (e) {
      setMsg({
        tone: "danger",
        text: e instanceof Error ? e.message : "Could not start payment.",
      });
    }
  }

  const data = query.data;

  if (!data) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<FlaskConical size={13} aria-hidden />}
          kicker="Lab bookings"
          kickerMeta={`#${id.slice(-6).toUpperCase()}`}
          title={query.isLoading ? "Loading booking…" : "Booking not found"}
          description={
            query.isLoading
              ? "Fetching the booking details and live status."
              : "This booking may have been deleted or the link is incorrect."
          }
          actions={
            <Link href="/patient/diagnostic-tests/bookings" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All bookings
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={4} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock
              className="mt-0"
              icon={<FlaskConical size={19} />}
              title="Booking not found"
              body="This booking may have been deleted or the link is incorrect."
              actions={
                <Link
                  href="/patient/diagnostic-tests/bookings"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  <ChevronLeft size={13} aria-hidden />
                  All bookings
                </Link>
              }
            />
          )}
        </section>
      </PatientPage>
    );
  }

  const b = data.booking as BookingDetail;
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
  const tone = statusTone(b.status);
  const shortId = b.id.length > 10 ? b.id.slice(-6).toUpperCase() : b.id;
  const scheduledIso = b.scheduledDate ? `${b.scheduledDate}T00:00:00` : null;

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<FlaskConical size={13} aria-hidden />}
        kicker="Lab bookings"
        kickerMeta={`#${shortId}`}
        title={title}
        description={
          b.scheduledAt || b.scheduledDate
            ? `${when} · ${b.scheduledAt ? formatRelative(b.scheduledAt) : `booked ${formatRelative(scheduledIso!)}`}`
            : when
        }
        chips={
          <>
            {b.status === "cancelled" ? (
              <span className={HERO_DANGER_CHIP}>
                <XCircle size={12} aria-hidden />
                Cancelled
              </span>
            ) : b.status === "completed" ? (
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                Report ready
              </span>
            ) : (
              <span className={HERO_ATTENTION_CHIP}>
                {badgeIcon(b.status)}
                {humanize(b.status)}
              </span>
            )}
            {b.paymentStatus ? (
              <span className={HERO_CHIP}>
                <CreditCard size={12} className="text-sky-300" aria-hidden />
                LKR {Number(amount).toLocaleString()} · {humanize(b.paymentMethod ?? "cash")}
              </span>
            ) : null}
            {b.labName ? (
              <span className={HERO_CHIP}>
                <Building2 size={12} className="text-teal-300" aria-hidden />
                {b.labName}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/diagnostic-tests/bookings" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All bookings
            </Link>
            {RESCHEDULABLE.includes(b.status) ? (
              <button type="button" onClick={() => setConfirmReschedule(true)} className={HERO_GHOST}>
                <RefreshCw size={15} aria-hidden />
                Reschedule
              </button>
            ) : null}
            {CANCELLABLE.includes(b.status) ? (
              <button type="button" onClick={() => setConfirmCancel(true)} className={HERO_GHOST}>
                <XCircle size={15} aria-hidden />
                Cancel
              </button>
            ) : null}
            {b.status === "completed" ? (
              <Link href={`/patient/diagnostic-tests/bookings/${b.id}/rate`} className={HERO_PRIMARY}>
                <Star size={15} className="text-amber-500" aria-hidden />
                Rate experience
              </Link>
            ) : null}
          </>
        }
      />

      {/* ── Status banners ───────────────────────────────── */}
      {msg ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium",
            msg.tone === "success"
              ? "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.2)]"
              : msg.tone === "danger"
                ? "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.2)]"
                : "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.2)]",
          )}
          role="status"
        >
          {msg.tone === "success" ? (
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
          ) : (
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-slate-400 transition-colors hover:text-slate-700"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      {b.cancellationReason ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.2)]">
          <Ban size={15} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <span className="font-semibold">Cancellation reason: </span>
            <span>{b.cancellationReason}</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Booking overview */}
          <section className={PANEL} aria-labelledby="bk-overview">
            <PanelHeader
              id="bk-overview"
              icon={<Info size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Booking overview"
              caption="Schedule, lab and payment at a glance"
            />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<CalendarDays size={14} />} label="Scheduled">
                {scheduledIso ? formatDayLabel(scheduledIso) : "TBD"}
                {b.scheduledTimeSlot ? ` · ${b.scheduledTimeSlot}` : ""}
              </InfoField>
              <InfoField icon={<Building2 size={14} />} label="Lab">
                {b.labName || "Assigned at confirmation"}
              </InfoField>
              <InfoField icon={<Wallet size={14} />} label="Total">
                LKR {Number(amount).toLocaleString()} · {humanize(b.paymentMethod ?? "cash")}
              </InfoField>
              <InfoField icon={<Phone size={14} />} label="Contact">
                {b.collectionAddress?.contactPhone ?? "Lab will reach you before the visit"}
              </InfoField>
            </dl>
          </section>

          {/* Status timeline */}
          <section className={PANEL} aria-labelledby="bk-timeline">
            <PanelHeader
              id="bk-timeline"
              icon={<Activity size={16} />}
              tone="bg-teal-50 text-teal-600"
              title="Status timeline"
              caption="Live progress from your request to the report"
              action={<Badge tone={tone}>{badgeIcon(b.status)}{humanize(b.status)}</Badge>}
            />
            <div className="mt-5">
              <VerticalTimeline status={b.status} />
            </div>
          </section>

          {/* Report (if completed) */}
          {b.status === "completed" ? (
            <section className={PANEL} aria-labelledby="bk-report">
              <PanelHeader
                id="bk-report"
                icon={<FileText size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Your report is ready"
                caption="Signed and uploaded by the lab"
              />
              {b.resultSummary ? (
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  {b.resultSummary}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {resultUrl ? (
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <ExternalLink size={13} aria-hidden />
                    Open full report
                  </a>
                ) : null}
                <Link
                  href={`/patient/diagnostic-tests/bookings/${b.id}/result`}
                  className={SECONDARY_BTN}
                >
                  <Sparkles size={13} className="text-violet-600" aria-hidden />
                  Explain with AI
                </Link>
              </div>
            </section>
          ) : null}

          {/* Patient notes */}
          {b.notes ? (
            <section className={PANEL} aria-labelledby="bk-notes">
              <PanelHeader
                id="bk-notes"
                icon={<StickyNote size={16} />}
                tone="bg-amber-50 text-amber-600"
                title="Notes for the phlebotomist"
                caption="Shared when you booked"
              />
              <p className="mt-4 rounded-xl bg-amber-50/60 p-4 text-sm leading-relaxed text-slate-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.15)]">
                {b.notes}
              </p>
            </section>
          ) : null}

          {/* Manage booking */}
          {(CANCELLABLE.includes(b.status) ||
            RESCHEDULABLE.includes(b.status) ||
            b.status === "completed") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={GROUP_LABEL}>Manage booking</span>
              <span className="flex-1" />
              {RESCHEDULABLE.includes(b.status) ? (
                <button
                  type="button"
                  onClick={() => setConfirmReschedule(true)}
                  className={SECONDARY_BTN}
                >
                  <RefreshCw size={13} aria-hidden />
                  Reschedule
                </button>
              ) : null}
              {CANCELLABLE.includes(b.status) ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.25)] transition-colors hover:bg-rose-100"
                >
                  <XCircle size={13} aria-hidden />
                  Cancel booking
                </button>
              ) : null}
              {b.status === "completed" ? (
                <Link
                  href={`/patient/diagnostic-tests/bookings/${b.id}/rate`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3.5 text-xs font-semibold text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)] transition-colors hover:bg-amber-100"
                >
                  <Star size={13} aria-hidden />
                  Rate experience
                </Link>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Right rail ────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Payment & support">
          <div className="flex flex-col gap-6 xl:sticky xl:top-6">
            {/* Payment summary */}
            <section className={PANEL} aria-labelledby="bk-pay">
              <PanelHeader
                id="bk-pay"
                icon={<CreditCard size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Payment"
                caption="Charges for this booking"
                action={
                  <Badge tone={paymentTone(b.paymentStatus)}>
                    {humanize(b.paymentStatus ?? "pending")}
                  </Badge>
                }
              />
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[10.5px] font-semibold text-slate-400">LKR</span>
                <span className="text-[28px] font-semibold tabular-nums tracking-tight text-slate-900">
                  {Number(amount).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <CreditCard size={12} className="text-slate-400" aria-hidden />
                {humanize(b.paymentMethod ?? "cash")}
              </p>
              {showPayRetry ? (
                <button
                  type="button"
                  onClick={doPayNow}
                  disabled={pay.isPending}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#07233a] text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                >
                  {pay.isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                      Starting payment…
                    </>
                  ) : (
                    <>
                      <CreditCard size={13} aria-hidden />
                      Pay now
                    </>
                  )}
                </button>
              ) : b.paymentStatus === "paid" ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 size={13} aria-hidden />
                  Payment received
                </p>
              ) : b.paymentStatus === "cash_on_collection" ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                  <Timer size={13} aria-hidden />
                  Pay cash on collection
                </p>
              ) : null}
            </section>

            {/* Lab info */}
            {b.labName ? (
              <section className={PANEL} aria-labelledby="bk-lab">
                <PanelHeader
                  id="bk-lab"
                  icon={<Building2 size={16} />}
                  tone="bg-teal-50 text-teal-600"
                  title="Performing lab"
                  caption="Verified partner laboratory"
                />
                <p className="mt-3 truncate text-sm font-semibold text-slate-900">
                  {b.labName}
                </p>
                {b.collectionAddress ? (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {b.collectionAddress.line1}
                    {b.collectionAddress.city ? `, ${b.collectionAddress.city}` : ""}
                  </p>
                ) : null}
                {b.collectionAddress?.contactPhone ? (
                  <a
                    href={`tel:${b.collectionAddress.contactPhone}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    <Phone size={12} aria-hidden />
                    {b.collectionAddress.contactPhone}
                  </a>
                ) : null}
              </section>
            ) : null}

            {/* Need help */}
            <section className={PANEL} aria-labelledby="bk-help">
              <PanelHeader
                id="bk-help"
                icon={<HelpCircle size={16} />}
                tone="bg-violet-50 text-violet-600"
                title="Need help?"
                caption="Reschedule, payment issues, delayed reports"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="mailto:care@healthhub.lk" className={SECONDARY_BTN}>
                  <Mail size={12} aria-hidden />
                  Email care
                </a>
                <a href="tel:+94112345678" className={SECONDARY_BTN}>
                  <PhoneCall size={12} aria-hidden />
                  Call us
                </a>
              </div>
            </section>

            {/* Booking ID + meta */}
            <div className="rounded-xl bg-slate-50 p-3.5 font-mono text-[11px] text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Booking ID</span>
                <span className="truncate font-semibold text-slate-800">{b.id}</span>
              </div>
              {b.createdAt ? (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-slate-400">Booked</span>
                  <span className="font-semibold text-slate-800">
                    {formatRelative(b.createdAt)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Reschedule modal ─────────────────────────── */}
      {confirmReschedule ? (
        <ModalShell
          title="Reschedule booking"
          subtitle="Pick a new date and time slot. The lab will re-confirm."
          onClose={() => setConfirmReschedule(false)}
        >
          <div className="space-y-4">
            <div>
              <label className={FIELD_LABEL}>New date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Time slot</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["morning", "afternoon", "evening", "night"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewSlot(s)}
                    className={cn(
                      "h-10 rounded-lg text-xs font-semibold transition-all",
                      newSlot === s
                        ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                        : "bg-slate-50 text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] hover:bg-white",
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

      {/* ── Cancel modal ──────────────────────────────── */}
      {confirmCancel ? (
        <ModalShell
          title="Cancel this booking?"
          subtitle="The lab will be notified so the visit can be stood down."
          onClose={() => setConfirmCancel(false)}
          tone="danger"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                If you paid online, your refund will be initiated to the
                original payment method.
              </span>
            </div>
            <div>
              <label className={FIELD_LABEL}>Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Schedule conflict, found another lab, etc."
                className={cn(FIELD_TEXTAREA, "resize-none")}
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
    </PatientPage>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Vertical timeline
 * ──────────────────────────────────────────────────────────────────── */
function VerticalTimeline({ status }: { status: string }) {
  const stage = pipelineIndex(status);
  const isCancelled = status === "cancelled";
  return (
    <ol className="relative pl-7">
      {/* vertical rail */}
      <span
        className="absolute bottom-2 left-2.5 top-2 w-0.5 bg-slate-200"
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
                "absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full transition-colors",
                done
                  ? "bg-emerald-500 text-white"
                  : current
                    ? "bg-sky-600 text-white shadow-[0_0_0_4px_rgba(2,132,199,0.15)]"
                    : "bg-white text-slate-400 shadow-[inset_0_0_0_2px_rgba(148,163,184,0.5)]",
              )}
              aria-hidden
            >
              {done ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    current ? "bg-white" : "bg-slate-400",
                  )}
                />
              )}
            </span>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-[13px] font-semibold leading-tight",
                    done
                      ? "text-slate-900"
                      : current
                        ? "text-sky-700"
                        : "text-slate-500",
                  )}
                >
                  <Icon size={12} aria-hidden />
                  {s.label}
                </p>
                <p className="mt-0.5 text-[11.5px] text-slate-400">
                  {s.description}
                </p>
              </div>
              {current ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-600" />
                  Now
                </span>
              ) : done ? (
                <span className="shrink-0 font-mono text-[10.5px] font-semibold text-emerald-600">
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
            className="absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white"
            aria-hidden
          >
            <X size={11} strokeWidth={3} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-rose-600">Cancelled</p>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
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
function badgeIcon(status: string) {
  switch (status) {
    case "completed":
    case "confirmed":
      return <CheckCircle2 size={11} />;
    case "cancelled":
      return <XCircle size={11} />;
    case "in_progress":
    case "processing":
    case "sample_collected":
      return <TestTube2 size={11} />;
    case "sample_collection_en_route":
    case "phlebotomist_assigned":
      return <MapPin size={11} />;
    default:
      return <Clock3 size={11} />;
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
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div
          className={cn(
            "h-1 w-full",
            tone === "danger" ? "bg-rose-500" : "bg-sky-600",
          )}
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-700"
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
      <button type="button" onClick={onCancel} className={SECONDARY_BTN}>
        Close
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-colors disabled:opacity-50",
          confirmTone === "danger"
            ? "bg-rose-600 hover:bg-rose-700"
            : "bg-[#07233a] hover:bg-sky-700",
        )}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}
