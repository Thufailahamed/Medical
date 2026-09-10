"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  UserPlus,
  Truck,
  Beaker,
  Upload,
  FileText,
  AlertTriangle,
  CreditCard,
  Building2,
  Activity,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  useLabBookingDetail,
  useConfirmBooking,
  useAssignPhlebotomist,
  useCollectSample,
  useMarkEnRoute,
  useCompleteBooking,
  useCancelLabBooking,
  usePhlebotomists,
} from "../../../hooks/useApi";
import { uploadFile } from "../../../lib/api";

const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Assigned" },
  { key: "sample_collection_en_route", label: "En Route" },
  { key: "sample_collected", label: "Collected" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

function stepState(index: number, currentIdx: number) {
  if (index < currentIdx) return "done" as const;
  if (index === currentIdx) return "current" as const;
  return "todo" as const;
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useLabBookingDetail(id);
  const { data: phlebData } = usePhlebotomists();
  const confirmBooking = useConfirmBooking();
  const assignPhleb = useAssignPhlebotomist();
  const collectSample = useCollectSample();
  const markEnRoute = useMarkEnRoute();
  const completeBooking = useCompleteBooking();
  const cancelBooking = useCancelLabBooking();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedPhleb, setSelectedPhleb] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [resultPdfUrl, setResultPdfUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="lab-page space-y-4">
        <div className="lab-skel h-4 w-32" />
        <div className="lab-skel h-44 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lab-skel h-32" />
          <div className="lab-skel h-32" />
        </div>
      </div>
    );
  }

  if (!data?.booking) {
    return (
      <div className="lab-page">
        <div className="lab-empty">
          <div className="lab-empty-icon">
            <AlertTriangle size={26} />
          </div>
          <div className="lab-empty-title">Booking not found</div>
          <p className="lab-empty-msg">
            This requisition may have been archived or removed by the patient.
          </p>
          <button
            type="button"
            className="lab-btn lab-btn-secondary mt-5"
            onClick={() => router.push("/lab-portal/bookings")}
          >
            <ArrowLeft size={14} />
            Back to bookings
          </button>
        </div>
      </div>
    );
  }

  const booking = data.booking;
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === booking.status);
  const shortId = booking.id.slice(0, 8).toUpperCase();

  return (
    <div className="lab-page">
      {/* ── Breadcrumb / back ── */}
      <button
        type="button"
        onClick={() => router.push("/lab-portal/bookings")}
        className="lab-btn lab-btn-ghost lab-btn-sm mb-4"
      >
        <ArrowLeft size={13} />
        Back to bookings
      </button>

      {/* ── Header ── */}
      <div className="lab-page-head">
        <div>
          <span className="lab-page-eyebrow">
            <FileText size={10} />
            Requisition #{shortId}
          </span>
          <h1 className="lab-page-title">
            {booking.itemName || "Test Booking"}
          </h1>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="lab-pill" data-status={booking.status}>
              {formatStatusLabel(booking.status)}
            </span>
            <span className="text-[12.5px] text-[var(--lab-ink-soft)] flex items-center gap-1.5">
              <Calendar size={13} />
              {booking.scheduledDate} · {booking.scheduledTimeSlot}
            </span>
          </div>
        </div>
        <div className="lab-page-actions">
          {booking.status === "pending" && (
            <button
              type="button"
              className="lab-btn lab-btn-secondary"
              onClick={() => cancelBooking.mutate({ id })}
            >
              <XCircle size={14} />
              Decline
            </button>
          )}
          <button
            type="button"
            className="lab-btn lab-btn-dark"
            onClick={() => router.push("/lab-portal/bookings")}
          >
            Print requisition
          </button>
        </div>
      </div>

      {/* Cancelled banner */}
      {booking.status === "cancelled" && (
        <div className="lab-banner lab-banner-danger mb-6">
          <div className="lab-banner-icon">
            <AlertTriangle size={14} />
          </div>
          <div>
            <div className="font-bold">Requisition cancelled</div>
            <div className="opacity-90">
              {booking.cancellationReason || "No reason provided"}
              {booking.paymentStatus === "refunded" ? " · Payment flagged for refund." : ""}
            </div>
          </div>
        </div>
      )}

      {/* ── Stepper ── */}
      <div className="lab-card lab-card-pad mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10.5px] tracking-[0.16em] uppercase text-[var(--lab-ink-faint)] lab-mono">
              Workflow
            </div>
            <h2 className="text-[15px] font-bold text-[var(--lab-night)] tracking-tight">
              Collection pipeline
            </h2>
          </div>
          <span className="text-[11.5px] text-[var(--lab-ink-soft)] lab-mono">
            Step {Math.max(currentIdx, 0) + 1} of {STATUS_STEPS.length}
          </span>
        </div>

        <div className="lab-stepper">
          {STATUS_STEPS.map((step, i) => (
            <div
              key={step.key}
              className="lab-step"
              data-state={stepState(i, currentIdx)}
            >
              <span className="lab-step-line" />
              <span className="lab-step-dot">
                {i < currentIdx ? <CheckCircle2 size={14} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className="lab-step-label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="lab-card">
            <div className="lab-card-head">
              <div className="lab-card-title">
                <Building2 size={15} />
                Booking information
              </div>
              <span className="text-[10.5px] tracking-[0.12em] uppercase text-[var(--lab-ink-faint)] lab-mono">
                {booking.bookingType}
              </span>
            </div>
            <div className="lab-card-pad">
              <div className="lab-detail">
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Patient</div>
                  <div className="lab-detail-row-value">{booking.patientName || "Unknown"}</div>
                </div>
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Date</div>
                  <div className="lab-detail-row-value">{booking.scheduledDate}</div>
                </div>
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Time slot</div>
                  <div className="lab-detail-row-value">{booking.scheduledTimeSlot}</div>
                </div>
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Contact</div>
                  <div className="lab-detail-row-value">{booking.collectionAddress?.contactPhone || "—"}</div>
                </div>
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Service</div>
                  <div className="lab-detail-row-value">{booking.itemName || "Test"}</div>
                </div>
                <div className="lab-detail-row">
                  <div className="lab-detail-row-label">Payment</div>
                  <div className="lab-detail-row-value">
                    LKR {booking.totalPrice.toLocaleString("en-LK")} ·{" "}
                    <span className="text-[var(--lab-ink-soft)]">{booking.paymentMethod}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-[var(--lab-surface-2)] border border-[var(--lab-border)] p-4">
                <div className="text-[10.5px] tracking-[0.16em] uppercase text-[var(--lab-ink-faint)] lab-mono mb-2 flex items-center gap-1.5">
                  <MapPin size={11} />
                  Collection address
                </div>
                <p className="text-[13.5px] text-[var(--lab-night)] leading-relaxed">
                  {booking.collectionAddress?.line1}
                  {booking.collectionAddress?.line2 ? `, ${booking.collectionAddress.line2}` : ""}
                  , {booking.collectionAddress?.city}
                  {booking.collectionAddress?.district ? `, ${booking.collectionAddress.district}` : ""}
                </p>
                {booking.collectionAddress?.specialInstructions ? (
                  <p className="mt-2 text-[12px] text-[var(--lab-ink-soft)]">
                    <strong className="text-[var(--lab-ink)]">Note:</strong>{" "}
                    {booking.collectionAddress.specialInstructions}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Phlebotomist */}
          <div className="lab-card">
            <div className="lab-card-head">
              <div className="lab-card-title">
                <UserPlus size={15} />
                Phlebotomist assignment
              </div>
              {(booking.status === "confirmed" || booking.status === "pending") && (
                <button
                  type="button"
                  className="lab-btn lab-btn-violet lab-btn-sm"
                  onClick={() => setShowAssignModal(true)}
                >
                  <UserPlus size={13} />
                  {booking.phlebotomistName ? "Reassign" : "Assign phlebotomist"}
                </button>
              )}
            </div>
            <div className="lab-card-pad">
              {booking.phlebotomistName ? (
                <div className="flex items-center gap-4">
                  <div className="lab-avatar lab-avatar-lg">
                    {booking.phlebotomistName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight">
                      {booking.phlebotomistName}
                    </div>
                    <div className="text-[12.5px] text-[var(--lab-ink-soft)] flex items-center gap-1.5 mt-0.5">
                      <Phone size={12} />
                      {booking.phlebotomistPhone || "—"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lab-banner lab-banner-warn">
                  <div className="lab-banner-icon">
                    <AlertTriangle size={14} />
                  </div>
                  <div>
                    <div className="font-bold">No phlebotomist assigned</div>
                    <div className="opacity-90">
                      Confirm the booking first, then assign a team member to
                      dispatch.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {booking.resultPdfUrl || booking.resultSummary ? (
            <div className="lab-card">
              <div className="lab-card-head">
                <div className="lab-card-title">
                  <Beaker size={15} />
                  Diagnostic results
                </div>
                <span className="lab-pill" data-status="completed">
                  Published
                </span>
              </div>
              <div className="lab-card-pad space-y-4">
                {booking.resultSummary ? (
                  <p className="text-[13.5px] text-[var(--lab-night)] leading-relaxed">
                    {booking.resultSummary}
                  </p>
                ) : null}
                {booking.resultPdfUrl ? (
                  <a
                    href={booking.resultPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="lab-btn lab-btn-secondary"
                  >
                    <FileText size={14} />
                    Open result PDF
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Sidebar: actions + payment */}
        <aside className="space-y-6">
          <div className="lab-card">
            <div className="lab-card-head">
              <div className="lab-card-title">
                <Activity size={15} />
                Workflow actions
              </div>
            </div>
            <div className="lab-card-pad flex flex-col gap-2.5">
              {booking.status === "pending" && (
                <button
                  type="button"
                  className="lab-btn lab-btn-primary lab-btn-block"
                  onClick={() => confirmBooking.mutate(id)}
                >
                  <CheckCircle2 size={14} />
                  Confirm booking
                </button>
              )}

              {(booking.status === "confirmed" || booking.status === "pending") && (
                <button
                  type="button"
                  className="lab-btn lab-btn-violet lab-btn-block"
                  onClick={() => setShowAssignModal(true)}
                >
                  <UserPlus size={14} />
                  Assign phlebotomist
                </button>
              )}

              {booking.status === "phlebotomist_assigned" && (
                <button
                  type="button"
                  className="lab-btn lab-btn-amber lab-btn-block"
                  onClick={() => markEnRoute.mutate(id)}
                >
                  <Truck size={14} />
                  Mark en route
                </button>
              )}

              {(booking.status === "phlebotomist_assigned" ||
                booking.status === "sample_collection_en_route") && (
                <button
                  type="button"
                  className="lab-btn lab-btn-cyan lab-btn-block"
                  onClick={() => collectSample.mutate(id)}
                >
                  <Beaker size={14} />
                  Mark sample collected
                </button>
              )}

              {(booking.status === "sample_collected" ||
                booking.status === "in_progress") && (
                <button
                  type="button"
                  className="lab-btn lab-btn-indigo lab-btn-block"
                  onClick={() => setShowResultModal(true)}
                >
                  <Upload size={14} />
                  Upload results & complete
                </button>
              )}

              {booking.status === "completed" && (
                <div className="lab-banner lab-banner-success">
                  <div className="lab-banner-icon">
                    <ShieldCheck size={14} />
                  </div>
                  <div>
                    <div className="font-bold">Completed</div>
                    <div className="opacity-90">
                      Results synced to the patient record.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lab-card">
            <div className="lab-card-head">
              <div className="lab-card-title">
                <CreditCard size={15} />
                Settlement
              </div>
            </div>
            <div className="lab-card-pad space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-[var(--lab-ink-soft)]">Total billed</span>
                <span className="font-display text-[26px] font-medium text-[var(--lab-night)] tracking-tight">
                  <small className="font-sans text-[11px] font-semibold text-[var(--lab-ink-faint)] mr-1 uppercase tracking-[0.05em]">LKR</small>
                  {booking.totalPrice.toLocaleString("en-LK")}
                </span>
              </div>
              <div className="border-t border-[var(--lab-border)] pt-4 space-y-2.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--lab-ink-soft)]">Method</span>
                  <span className="font-semibold text-[var(--lab-night)]">{booking.paymentMethod}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--lab-ink-soft)]">Status</span>
                  <span className="lab-pill" data-status={booking.paymentStatus === "paid" ? "completed" : "pending"}>
                    {booking.paymentStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[var(--lab-ink-soft)]">Settlement cycle</span>
                  <span className="lab-mono font-semibold text-[var(--lab-night)]">
                    Weekly · Fri
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--lab-ink-faint)]">
                <ChevronRight size={11} />
                Disbursed to nominated bank account
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Assign modal ── */}
      {showAssignModal && (
        <ModalShell onClose={() => setShowAssignModal(false)} title="Assign phlebotomist" subtitle="Select an active team member to dispatch." size="md">
          <div className="space-y-3">
            <label className="lab-label">
              Active phlebotomists
              <span className="lab-label-req">*</span>
            </label>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {phlebData?.phlebotomists
                .filter((p) => p.isActive)
                .map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelectedPhleb(p.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selectedPhleb === p.id
                        ? "border-[var(--lab-brand)] bg-[var(--lab-brand-soft)]"
                        : "border-[var(--lab-border)] hover:border-[var(--lab-border-strong)] bg-white"
                    }`}
                  >
                    <div className="lab-avatar">{p.name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-[var(--lab-night)]">{p.name}</div>
                      <div className="text-[11.5px] text-[var(--lab-ink-soft)] flex items-center gap-1.5 mt-0.5">
                        <Phone size={11} />
                        {p.phone}
                      </div>
                    </div>
                    {selectedPhleb === p.id && (
                      <CheckCircle2 size={16} className="text-[var(--lab-brand)]" />
                    )}
                  </button>
                )) ?? <div className="lab-skel h-12 w-full" />}
            </div>
          </div>

          <div className="lab-modal-foot !mt-5 -mx-[26px] -mb-[22px]">
            <button
              type="button"
              className="lab-btn lab-btn-secondary"
              onClick={() => setShowAssignModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lab-btn lab-btn-violet"
              disabled={!selectedPhleb}
              onClick={() => {
                const phleb = phlebData?.phlebotomists.find(
                  (p) => p.id === selectedPhleb
                );
                if (phleb) {
                  assignPhleb.mutate({
                    id,
                    phlebotomistId: phleb.id,
                    phlebotomistName: phleb.name,
                    phlebotomistPhone: phleb.phone,
                  });
                  setShowAssignModal(false);
                }
              }}
            >
              <UserPlus size={14} />
              Assign & notify
            </button>
          </div>
        </ModalShell>
      )}

      {/* ── Upload result modal ── */}
      {showResultModal && (
        <ModalShell onClose={() => setShowResultModal(false)} title="Upload diagnostic results" subtitle="Attach the report PDF and a brief summary for the patient record." size="lg">
          <div className="space-y-4">
            <div className="lab-field">
              <label className="lab-label">Result summary</label>
              <textarea
                rows={3}
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
                placeholder="A short clinical summary visible to the patient…"
                className="lab-input"
              />
            </div>

            <div className="lab-field">
              <label className="lab-label">Report PDF</label>
              <div className="lab-input-wrap">
                <Upload size={14} />
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="lab-input !pl-10"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] ?? null);
                    setUploadError(null);
                  }}
                />
              </div>
              <p className="lab-hint">
                PDF or image up to 20 MB. Uploaded privately to your R2 bucket.
              </p>
            </div>

            <div className="lab-field">
              <label className="lab-label">Or paste /files URL</label>
              <input
                type="url"
                value={resultPdfUrl}
                onChange={(e) => setResultPdfUrl(e.target.value)}
                placeholder="/files/download/…"
                className="lab-input lab-mono"
              />
            </div>

            {uploadError && (
              <div className="lab-banner lab-banner-danger">
                <div className="lab-banner-icon">
                  <AlertTriangle size={14} />
                </div>
                <div>{uploadError}</div>
              </div>
            )}
          </div>

          <div className="lab-modal-foot !mt-5 -mx-[26px] -mb-[22px]">
            <button
              type="button"
              className="lab-btn lab-btn-secondary"
              onClick={() => setShowResultModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lab-btn lab-btn-indigo"
              disabled={uploading}
              onClick={async () => {
                try {
                  setUploading(true);
                  setUploadError(null);
                  let pdfUrl = resultPdfUrl;
                  if (selectedFile && !pdfUrl) {
                    const uploaded = await uploadFile(selectedFile);
                    pdfUrl = uploaded.url;
                    setResultPdfUrl(pdfUrl);
                  }
                  if (!pdfUrl) {
                    setUploadError(
                      "Attach a result PDF or paste a /files URL first."
                    );
                    return;
                  }
                  completeBooking.mutate({
                    id,
                    resultSummary: resultSummary || undefined,
                    resultPdfUrl: pdfUrl,
                  });
                  setShowResultModal(false);
                } catch (err) {
                  setUploadError(
                    err instanceof Error ? err.message : "Upload failed"
                  );
                } finally {
                  setUploading(false);
                }
              }}
            >
              <Upload size={14} />
              {uploading ? "Uploading…" : "Submit & complete"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="lab-overlay-host">
      <div className="lab-overlay-backdrop" onClick={onClose} />
      <div
        className={`lab-modal-panel lab-modal-${size}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lab-modal-head">
          <div>
            <div className="lab-modal-title">{title}</div>
            {subtitle ? <div className="lab-modal-sub">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="lab-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="lab-modal-body">{children}</div>
      </div>
    </div>
  );
}
