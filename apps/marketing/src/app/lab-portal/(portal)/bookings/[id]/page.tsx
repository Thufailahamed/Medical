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
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  Badge,
  PanelSkeleton,
  type Tone,
} from "@/patient/components/workspace";

const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Assigned" },
  { key: "sample_collection_en_route", label: "En Route" },
  { key: "sample_collected", label: "Collected" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const STATUS_TONE: Record<string, Tone> = {
  pending: "amber",
  confirmed: "sky",
  phlebotomist_assigned: "violet",
  sample_collection_en_route: "sky",
  sample_collected: "emerald",
  in_progress: "amber",
  completed: "emerald",
  cancelled: "rose",
};

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
      <div className="lab-page">
        <PanelSkeleton rows={6} />
      </div>
    );
  }

  if (!data?.booking) {
    return (
      <div className="lab-page">
        <section className={PANEL}>
          <EmptyBlock
            icon={<AlertTriangle size={19} />}
            title="Booking not found"
            body="This requisition may have been archived or removed by the patient."
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
                onClick={() => router.push("/lab-portal/bookings")}
              >
                <ArrowLeft size={13} /> Back to bookings
              </button>
            }
          />
        </section>
      </div>
    );
  }

  const booking = data.booking;
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === booking.status);
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const tone = STATUS_TONE[booking.status] ?? "slate";

  return (
    <div className="lab-page flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/lab-portal/bookings")}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={13} /> Back to requisitions
      </button>

      <DoctorHero
        kicker={`Requisition #${shortId}`}
        kickerIcon={<FileText size={12} />}
        kickerMeta={booking.bookingType}
        title={booking.itemName || "Test Booking"}
        description={`${booking.patientName || "Patient"} · ${booking.collectionAddress?.city ?? "Home collection"}`}
        chips={
          <>
            <span className={HERO_CHIP}>
              <span className={`h-2 w-2 rounded-full ${tone === "rose" ? "bg-rose-400" : tone === "amber" ? "bg-amber-400" : "bg-emerald-400"}`} />
              {formatStatusLabel(booking.status)}
            </span>
            <span className={HERO_CHIP}>
              <Calendar size={12} /> {booking.scheduledDate} · {booking.scheduledTimeSlot}
            </span>
            <span className={HERO_CHIP}>
              <CreditCard size={12} /> LKR {booking.totalPrice.toLocaleString("en-LK")} · {booking.paymentStatus}
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<Activity size={18} />}
            label="Pipeline position"
            value={`${Math.max(currentIdx, 0) + 1}/${STATUS_STEPS.length}`}
            sub={booking.status === "cancelled" ? "Cancelled" : STATUS_STEPS[Math.max(currentIdx, 0)]?.label}
          />
        }
        actions={
          <>
            {booking.status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => cancelBooking.mutate({ id })}
                  className={HERO_GHOST}
                >
                  <XCircle size={14} /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => confirmBooking.mutate(id)}
                  className={HERO_PRIMARY}
                >
                  <CheckCircle2 size={14} /> Confirm booking
                </button>
              </>
            )}
            {(booking.status === "confirmed" || booking.status === "pending") && (
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className={booking.status === "confirmed" ? HERO_PRIMARY : HERO_GHOST}
              >
                <UserPlus size={14} />
                {booking.phlebotomistName ? "Reassign" : "Assign phlebotomist"}
              </button>
            )}
            {booking.status === "phlebotomist_assigned" && (
              <button
                type="button"
                onClick={() => markEnRoute.mutate(id)}
                className={HERO_PRIMARY}
              >
                <Truck size={14} /> Mark en route
              </button>
            )}
            {(booking.status === "phlebotomist_assigned" ||
              booking.status === "sample_collection_en_route") && (
              <button
                type="button"
                onClick={() => collectSample.mutate(id)}
                className={HERO_PRIMARY}
              >
                <Beaker size={14} /> Sample collected
              </button>
            )}
            {(booking.status === "sample_collected" ||
              booking.status === "in_progress") && (
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                className={HERO_PRIMARY}
              >
                <Upload size={14} /> Upload results
              </button>
            )}
          </>
        }
      />

      {/* Cancelled banner */}
      {booking.status === "cancelled" && (
        <div className="lab-banner lab-banner-danger">
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

      {/* ── Stat strip ── */}
      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Status"
            icon={<Activity size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={formatStatusLabel(booking.status)}
            sub={`Step ${Math.max(currentIdx, 0) + 1} of ${STATUS_STEPS.length}`}
          />
          <StatTile
            label="Scheduled"
            icon={<Calendar size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={booking.scheduledDate}
            sub={booking.scheduledTimeSlot}
          />
          <StatTile
            label="Total billed"
            icon={<CreditCard size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={`LKR ${booking.totalPrice.toLocaleString("en-LK")}`}
            sub={booking.paymentMethod ?? booking.paymentStatus}
          />
          <StatTile
            label="Phlebotomist"
            icon={<UserPlus size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={booking.phlebotomistName ?? "Unassigned"}
            sub={booking.phlebotomistPhone ?? "Dispatch pending"}
          />
        </div>
      </HeroOverlap>

      {/* ── Stepper ── */}
      <section className={PANEL}>
        <PanelHeader
          icon={<Activity size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Collection pipeline"
          caption={`Step ${Math.max(currentIdx, 0) + 1} of ${STATUS_STEPS.length}`}
        />
        <div className="lab-stepper mt-5">
          {STATUS_STEPS.map((step, i) => (
            <div
              key={step.key}
              className="lab-step"
              data-state={booking.status === "cancelled" ? "todo" : stepState(i, currentIdx)}
            >
              <span className="lab-step-line" />
              <span className="lab-step-dot">
                {i < currentIdx && booking.status !== "cancelled" ? <CheckCircle2 size={14} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className="lab-step-label">{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Detail grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Booking information */}
          <section className={PANEL}>
            <PanelHeader
              icon={<Building2 size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Booking information"
              caption={booking.bookingType}
            />
            <div className="lab-detail mt-5">
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
                  <span className="text-slate-500">{booking.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-400">
                <MapPin size={11} />
                Collection address
              </div>
              <p className="text-[13.5px] leading-relaxed text-slate-900">
                {booking.collectionAddress?.line1}
                {booking.collectionAddress?.line2 ? `, ${booking.collectionAddress.line2}` : ""}
                , {booking.collectionAddress?.city}
                {booking.collectionAddress?.district ? `, ${booking.collectionAddress.district}` : ""}
              </p>
              {booking.collectionAddress?.specialInstructions ? (
                <p className="mt-2 text-[12px] text-slate-500">
                  <strong className="text-slate-700">Note:</strong>{" "}
                  {booking.collectionAddress.specialInstructions}
                </p>
              ) : null}
            </div>
          </section>

          {/* Phlebotomist */}
          <section className={PANEL}>
            <PanelHeader
              icon={<UserPlus size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Phlebotomist assignment"
              action={
                (booking.status === "confirmed" || booking.status === "pending") ? (
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 transition-colors hover:text-violet-900"
                  >
                    <UserPlus size={13} />
                    {booking.phlebotomistName ? "Reassign" : "Assign"}
                  </button>
                ) : undefined
              }
            />
            {booking.phlebotomistName ? (
              <div className="mt-4 flex items-center gap-4">
                <div className="lab-avatar lab-avatar-lg">
                  {booking.phlebotomistName[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-bold tracking-tight text-slate-900">
                    {booking.phlebotomistName}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-slate-500">
                    <Phone size={12} />
                    {booking.phlebotomistPhone || "—"}
                  </div>
                </div>
                <Badge tone="violet">Assigned</Badge>
              </div>
            ) : (
              <div className="lab-banner lab-banner-warn mt-4">
                <div className="lab-banner-icon">
                  <AlertTriangle size={14} />
                </div>
                <div>
                  <div className="font-bold">No phlebotomist assigned</div>
                  <div className="opacity-90">
                    Confirm the booking first, then assign a team member to dispatch.
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Results */}
          {booking.resultPdfUrl || booking.resultSummary ? (
            <section className={PANEL}>
              <PanelHeader
                icon={<Beaker size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Diagnostic results"
                action={<Badge tone="emerald">Published</Badge>}
              />
              <div className="mt-4 space-y-4">
                {booking.resultSummary ? (
                  <p className="text-[13.5px] leading-relaxed text-slate-900">
                    {booking.resultSummary}
                  </p>
                ) : null}
                {booking.resultPdfUrl ? (
                  <a
                    href={booking.resultPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <FileText size={14} />
                    Open result PDF
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sidebar: actions + payment */}
        <aside className="flex flex-col gap-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Activity size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Workflow actions"
            />
            <div className="mt-4 flex flex-col gap-2.5">
              {booking.status === "pending" && (
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#07233a] text-xs font-semibold text-white transition-colors hover:bg-sky-800"
                  onClick={() => confirmBooking.mutate(id)}
                >
                  <CheckCircle2 size={14} />
                  Confirm booking
                </button>
              )}

              {(booking.status === "confirmed" || booking.status === "pending") && (
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => setShowAssignModal(true)}
                >
                  <UserPlus size={14} />
                  Assign phlebotomist
                </button>
              )}

              {booking.status === "phlebotomist_assigned" && (
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#07233a] text-xs font-semibold text-white transition-colors hover:bg-sky-800"
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
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#07233a] text-xs font-semibold text-white transition-colors hover:bg-sky-800"
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
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
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
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<CreditCard size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Settlement"
            />
            <div className="mt-4 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-slate-500">Total billed</span>
                <span className="text-[26px] font-bold tabular-nums tracking-tight text-slate-900">
                  <small className="mr-1 font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">LKR</small>
                  {booking.totalPrice.toLocaleString("en-LK")}
                </span>
              </div>
              <div className="space-y-2.5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-slate-500">Method</span>
                  <span className="font-semibold text-slate-900">{booking.paymentMethod}</span>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-slate-500">Status</span>
                  <Badge tone={booking.paymentStatus === "paid" ? "emerald" : "amber"}>
                    {booking.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-slate-500">Settlement cycle</span>
                  <span className="font-mono font-semibold text-slate-900">
                    Weekly · Fri
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ChevronRight size={11} />
                Disbursed to nominated bank account
              </div>
            </div>
          </section>
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
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {phlebData?.phlebotomists
                .filter((p) => p.isActive)
                .map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelectedPhleb(p.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      selectedPhleb === p.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="lab-avatar">{p.name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-slate-900">{p.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                        <Phone size={11} />
                        {p.phone}
                      </div>
                    </div>
                    {selectedPhleb === p.id && (
                      <CheckCircle2 size={16} className="text-emerald-600" />
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
              className="lab-btn lab-btn-primary"
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
              className="lab-btn lab-btn-primary"
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
