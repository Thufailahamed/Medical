"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Filter,
  Download,
  ChevronDown,
  Check,
  X,
  Phone,
  Clock,
  FlaskConical,
  Plus,
} from "lucide-react";
import {
  useLabBookings,
  useConfirmBooking,
  useCancelLabBooking,
} from "../../hooks/useApi";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Assigned" },
  { key: "sample_collection_en_route", label: "En Route" },
  { key: "sample_collected", label: "Collected" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const { data, isLoading } = useLabBookings(status || undefined);
  const confirmBooking = useConfirmBooking();
  const cancelBooking = useCancelLabBooking();

  const filtered = useMemo(() => {
    if (!data?.bookings) return [];
    if (!query.trim()) return data.bookings;
    const q = query.toLowerCase();
    return data.bookings.filter((b) =>
      [
        b.itemName,
        b.patientName,
        b.collectionAddress?.city,
        b.id,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data, query]);

  const counts = useMemo(() => {
    const all = data?.bookings ?? [];
    return {
      total: all.length,
      pending: all.filter((b) => b.status === "pending").length,
      active: all.filter(
        (b) =>
          !["completed", "cancelled"].includes(b.status)
      ).length,
    };
  }, [data]);

  return (
    <div className="lab-page">
      {/* ── Page head ── */}
      <div className="lab-page-head">
        <div>
          <span className="lab-page-eyebrow">
            <FlaskConical size={10} />
            Diagnostic Workflow
          </span>
          <h1 className="lab-page-title">
            Inbound <strong>requisitions</strong>
          </h1>
          <p className="lab-page-sub">
            Confirm new orders, dispatch phlebotomists, and close out
            completed samples without leaving the console.
          </p>
        </div>
        <div className="lab-page-actions">
          <button type="button" className="lab-btn lab-btn-secondary">
            <Download size={14} />
            Export
            <ChevronDown size={12} />
          </button>
          <button type="button" className="lab-btn lab-btn-primary">
            <Plus size={14} />
            New Booking
          </button>
        </div>
      </div>

      {/* ── Summary row ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="lab-stat" style={{ "--lab-stat-accent": "#1D4ED8", "--lab-stat-soft": "#DBEAFE" } as React.CSSProperties}>
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><Calendar size={19} strokeWidth={2.1} /></div>
          </div>
          <div className="lab-stat-label">Total in queue</div>
          <div className="lab-stat-value mt-2">{counts.total}</div>
          <div className="lab-stat-foot">Across all statuses</div>
        </div>
        <div className="lab-stat" style={{ "--lab-stat-accent": "#D97706", "--lab-stat-soft": "#FEF3C7" } as React.CSSProperties}>
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><Clock size={19} strokeWidth={2.1} /></div>
          </div>
          <div className="lab-stat-label">Awaiting confirmation</div>
          <div className="lab-stat-value mt-2">{counts.pending}</div>
          <div className="lab-stat-foot">SLA: respond in &lt; 30 min</div>
        </div>
        <div className="lab-stat" style={{ "--lab-stat-accent": "#059669", "--lab-stat-soft": "#D1FAE5" } as React.CSSProperties}>
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><Check size={19} strokeWidth={2.4} /></div>
          </div>
          <div className="lab-stat-label">Active jobs</div>
          <div className="lab-stat-value mt-2">{counts.active}</div>
          <div className="lab-stat-foot">In flight across the network</div>
        </div>
      </section>

      {/* ── Filters ── */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="lab-tabs">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                data-active={active}
                className="lab-tab"
                onClick={() => setStatus(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="lab-topbar-search !max-w-[280px]">
            <input
              type="search"
              placeholder="Search by patient, test, ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter bookings"
            />
          </div>
          <button type="button" className="lab-btn lab-btn-secondary lab-btn-icon" aria-label="More filters">
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* ── Bookings grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="lab-card lab-card-pad">
              <div className="lab-skel h-4 w-32 mb-3" />
              <div className="lab-skel h-3 w-48 mb-4" />
              <div className="lab-skel h-3 w-full mb-2" />
              <div className="lab-skel h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="lab-empty">
          <div className="lab-empty-icon">
            <Calendar size={26} strokeWidth={1.8} />
          </div>
          <div className="lab-empty-title">No bookings match this filter</div>
          <p className="lab-empty-msg">
            {query
              ? `Nothing matches "${query}". Try a different keyword.`
              : "Once new requisitions land they will show up here in real time."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((booking) => {
            const shortId = booking.id.slice(0, 8).toUpperCase();
            return (
              <article
                key={booking.id}
                className="lab-booking"
                onClick={() => router.push(`/lab-portal/bookings/${booking.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/lab-portal/bookings/${booking.id}`);
                }}
              >
                <div className="lab-booking-head">
                  <div className="min-w-0">
                    <div className="lab-booking-id">#{shortId}</div>
                    <div className="lab-booking-title">{booking.itemName || "Test Booking"}</div>
                  </div>
                  <span className="lab-pill" data-status={booking.status}>
                    {formatStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="lab-booking-meta">
                  <span className="lab-booking-meta-item">
                    <FlaskConical size={13} />
                    {booking.patientName || "Patient"}
                  </span>
                  <span className="lab-booking-meta-item">
                    <Calendar size={13} />
                    {booking.scheduledDate}
                  </span>
                  <span className="lab-booking-meta-item">
                    <Clock size={13} />
                    {booking.scheduledTimeSlot}
                  </span>
                  <span className="lab-booking-meta-item">
                    <Phone size={13} />
                    {booking.collectionAddress?.contactPhone || "—"}
                  </span>
                </div>

                <div className="flex items-start gap-1.5 text-[12px] text-[var(--lab-ink-soft)]">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-[var(--lab-ink-faint)]" />
                  <span className="leading-snug">
                    {booking.collectionAddress?.line1}
                    {booking.collectionAddress?.line2 ? `, ${booking.collectionAddress.line2}` : ""}
                    , {booking.collectionAddress?.city}
                  </span>
                </div>

                <div className="lab-booking-foot">
                  <div className="lab-booking-price">
                    <small>LKR</small>
                    {booking.totalPrice.toLocaleString("en-LK")}
                  </div>
                  {booking.status === "pending" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="lab-btn lab-btn-ghost lab-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelBooking.mutate({ id: booking.id });
                        }}
                      >
                        <X size={13} />
                        Decline
                      </button>
                      <button
                        type="button"
                        className="lab-btn lab-btn-primary lab-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmBooking.mutate(booking.id);
                        }}
                      >
                        <Check size={13} />
                        Confirm
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="lab-btn lab-btn-secondary lab-btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/lab-portal/bookings/${booking.id}`);
                      }}
                    >
                      Open detail
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
