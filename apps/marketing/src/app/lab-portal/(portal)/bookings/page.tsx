"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Check,
  X,
  Clock,
  FlaskConical,
  ClipboardList,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  useLabBookings,
  useConfirmBooking,
  useCancelLabBooking,
} from "../../hooks/useApi";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  RailRow,
  Badge,
  PanelSkeleton,
  type Tone,
} from "@/patient/components/workspace";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "phlebotomist_assigned", label: "Assigned" },
  { key: "sample_collection_en_route", label: "En route" },
  { key: "sample_collected", label: "Collected" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
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

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialQuery = searchParams.get("q") || "";
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const { data, isLoading, isFetching, refetch } = useLabBookings(status || undefined);
  const confirmBooking = useConfirmBooking();
  const cancelBooking = useCancelLabBooking();

  const filtered = useMemo(() => {
    if (!data?.bookings) return [];
    if (!query.trim()) return data.bookings;
    const q = query.toLowerCase();
    return data.bookings.filter((b) =>
      [b.itemName, b.patientName, b.collectionAddress?.city, b.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, query]);

  const counts = useMemo(() => {
    const all = data?.bookings ?? [];
    return {
      total: all.length,
      pending: all.filter((b) => b.status === "pending").length,
      active: all.filter((b) => !["completed", "cancelled"].includes(b.status)).length,
    };
  }, [data]);

  const hero = (
    <DoctorHero
      kicker="Diagnostic workflow"
      kickerIcon={<FlaskConical size={12} />}
      kickerMeta={`${counts.total} in queue`}
      title="Inbound requisitions"
      description="Confirm new orders, dispatch phlebotomists, and close out completed samples without leaving the console."
      chips={
        <>
          <span className={HERO_CHIP}>
            <Clock size={12} /> {counts.pending} pending
          </span>
          <span className={HERO_CHIP}>
            <ClipboardList size={12} /> {counts.active} active jobs
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<ClipboardList size={18} />}
          label="Awaiting confirmation"
          value={counts.pending}
          sub={counts.pending ? "SLA: respond < 30 min" : "Queue is clear"}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => refetch()}
            className={HERO_GHOST}
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/lab-portal/bookings?status=pending" className={HERO_PRIMARY}>
            <ClipboardList size={14} /> Review pending
          </Link>
        </>
      }
    />
  );

  return (
    <div className="lab-page flex flex-col gap-6">
      {hero}

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label="Total in queue"
            icon={<Calendar size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(counts.total)}
            sub="Across all statuses"
            active={status === ""}
            onClick={() => setStatus("")}
          />
          <StatTile
            label="Awaiting confirmation"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(counts.pending)}
            sub="SLA: respond in < 30 min"
            pulse={counts.pending > 0}
            active={status === "pending"}
            onClick={() => setStatus("pending")}
          />
          <StatTile
            label="Active jobs"
            icon={<Check size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(counts.active)}
            sub="In flight across the network"
          />
        </div>
      </HeroOverlap>

      <section className={PANEL}>
        <PanelHeader
          icon={<ClipboardList size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Requisitions"
          caption={`${filtered.length} shown`}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented<string>
            ariaLabel="Filter bookings by status"
            value={status}
            onChange={setStatus}
            options={STATUS_TABS.map((t) => ({ value: t.key, label: t.label }))}
          />
          <PanelSearch
            value={query}
            onChange={setQuery}
            placeholder="Search patient, test, ID…"
            ariaLabel="Filter bookings"
          />
        </div>

        {isLoading ? (
          <PanelSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Calendar size={19} />}
            title="No bookings match this filter"
            body={
              query
                ? `Nothing matches "${query}". Try a different keyword.`
                : "Once new requisitions land they will show up here in real time."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filtered.map((booking) => {
              const shortId = booking.id.slice(0, 8).toUpperCase();
              const tone = STATUS_TONE[booking.status] ?? "slate";
              return (
                <li key={booking.id}>
                  <RailRow
                    tone={tone}
                    active={booking.status !== "cancelled"}
                    icon={<FlaskConical size={15} />}
                    title={
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400">#{shortId}</span>
                        {booking.itemName || "Test booking"}
                        <Badge tone={tone}>{statusLabel(booking.status)}</Badge>
                      </span>
                    }
                    meta={
                      <>
                        {booking.patientName ?? "Patient"} · {booking.scheduledDate} {booking.scheduledTimeSlot}
                        {booking.collectionAddress?.city ? ` · ${booking.collectionAddress.city}` : ""}
                        {booking.collectionAddress?.contactPhone ? ` · ${booking.collectionAddress.contactPhone}` : ""}
                      </>
                    }
                    trailing={
                      <span className="flex items-center gap-2">
                        <span className="hidden text-sm font-bold tabular-nums text-slate-900 sm:block">
                          LKR {booking.totalPrice.toLocaleString("en-LK")}
                        </span>
                        {booking.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => cancelBooking.mutate({ id: booking.id })}
                              disabled={cancelBooking.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                            >
                              <X size={13} /> Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmBooking.mutate(booking.id)}
                              disabled={confirmBooking.isPending}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
                            >
                              <Check size={13} /> Confirm
                            </button>
                          </>
                        ) : (
                          <Link
                            href={`/lab-portal/bookings/${booking.id}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            aria-label="Open booking detail"
                          >
                            <ChevronRight size={15} />
                          </Link>
                        )}
                      </span>
                    }
                  >
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">
                        {booking.collectionAddress?.line1}
                        {booking.collectionAddress?.line2 ? `, ${booking.collectionAddress.line2}` : ""}
                        , {booking.collectionAddress?.city}
                      </span>
                    </span>
                  </RailRow>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
