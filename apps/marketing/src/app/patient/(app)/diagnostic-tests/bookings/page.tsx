"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FlaskConical,
  Home,
  MapPin,
  Microscope,
  Plus,
  RotateCcw,
  Sparkles,
  TestTube2,
  Timer,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { StatTile } from "@/patient/components/primitives/StatTile";
import { api } from "@/portal/lib/api";
import { formatDayLabel, humanize, formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

const TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type BookingStatus =
  | "pending"
  | "confirmed"
  | "phlebotomist_assigned"
  | "sample_collection_en_route"
  | "sample_collected"
  | "in_progress"
  | "processing"
  | "completed"
  | "cancelled";

type BookingRow = {
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
  createdAt?: string;
};

/* ── Progress pipeline stages shown under each booking ───────────── */
const PIPELINE: { key: BookingStatus; label: string; icon: typeof Activity }[] = [
  { key: "pending", label: "Booked", icon: CalendarDays },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "sample_collected", label: "Collected", icon: Microscope },
  { key: "in_progress", label: "In lab", icon: TestTube2 },
  { key: "completed", label: "Result", icon: Activity },
];

function pipelineIndex(status: string): number {
  switch (status) {
    case "pending":
    case "phlebotomist_assigned":
    case "sample_collection_en_route":
      return 0;
    case "confirmed":
      return 1;
    case "sample_collected":
      return 2;
    case "in_progress":
    case "processing":
      return 3;
    case "completed":
      return 4;
    default:
      return -1;
  }
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

function paymentTone(p?: string): "success" | "warn" | "danger" | "neutral" {
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

export default function TestBookingsPage() {
  const [tab, setTab] = useState<string>("");
  const query = useQuery({
    queryKey: ["patient", "diagnostic", "bookings", tab],
    queryFn: () =>
      api<{ bookings: BookingRow[] }>(
        `/diagnostic-tests/bookings${tab ? `?status=${tab}` : ""}`,
      ),
  });

  /* Derive tab counts + summary stats from the unfiltered "all" list so
   * the user sees real totals on every tab. We only need this on first
   * render; React Query will cache it. */
  const allQuery = useQuery({
    queryKey: ["patient", "diagnostic", "bookings", "all"],
    queryFn: () =>
      api<{ bookings: BookingRow[] }>("/diagnostic-tests/bookings"),
  });

  const counts = useMemo(() => {
    const list = allQuery.data?.bookings ?? [];
    return {
      all: list.length,
      upcoming: list.filter(
        (b) =>
          b.status !== "completed" &&
          b.status !== "cancelled" &&
          pipelineIndex(b.status) < 4,
      ).length,
      completed: list.filter((b) => b.status === "completed").length,
      cancelled: list.filter((b) => b.status === "cancelled").length,
    };
  }, [allQuery.data]);

  const summary = useMemo(() => {
    const list = allQuery.data?.bookings ?? [];
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    const active = list.filter(
      (b) => b.status !== "completed" && b.status !== "cancelled",
    );
    const completed = list.filter((b) => b.status === "completed");
    const spentThisMonth = list
      .filter((b) => {
        if (b.status !== "completed") return false;
        const t = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return t >= monthStartMs;
      })
      .reduce(
        (acc, b) => acc + (b.totalPrice ?? b.totalAmount ?? 0),
        0,
      );
    const nextUpcoming = active
      .filter((b) => {
        const t = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return t >= now;
      })
      .sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return ta - tb;
      })[0];

    return { active, completed, spentThisMonth, nextUpcoming };
  }, [allQuery.data]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* ── 1. Premium hero ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl text-white shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #082F49 0%, #0369A1 50%, #0284C7 100%)",
        }}
      >
        {/* Decorative ambient glows */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.28) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)",
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

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-6 sm:p-8">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 backdrop-blur-md text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">
              <Sparkles size={11} className="text-sky-200" />
              Diagnostics · Orders &amp; results
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.1]">
              My bookings
            </h1>
            <p className="mt-2 text-sm text-sky-100/85 max-w-xl leading-relaxed">
              Every lab test and package you've scheduled — with live status,
              collection timeline, and result availability in one place.
            </p>

            {/* Inline next-upcoming mini-card */}
            {summary.nextUpcoming ? (
              <NextUpcomingCard booking={summary.nextUpcoming} />
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-sky-100/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                No bookings on the calendar.{" "}
                <Link
                  href="/patient/diagnostic-tests"
                  className="underline decoration-sky-300/60 underline-offset-2 hover:text-white"
                >
                  Book a test
                </Link>
                .
              </p>
            )}
          </div>

          <div className="flex flex-row lg:flex-col gap-2 lg:items-end shrink-0">
            <Link
              href="/patient/diagnostic-tests"
              className="inline-flex h-10 items-center gap-2 px-4 rounded-xl bg-white text-sky-950 text-[12.5px] font-bold shadow-md hover:bg-sky-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus size={14} className="text-sky-700" />
              Book new test
              <ArrowRight size={13} className="text-sky-600" />
            </Link>
            <Link
              href="/patient/records"
              className="inline-flex h-10 items-center gap-2 px-4 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-white text-[12.5px] font-bold hover:bg-white/20 transition-colors"
            >
              <FlaskConical size={13} />
              Past reports
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Summary stat tiles ──────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Total bookings"
          value={String(counts.all)}
          sublabel={`${counts.completed} completed`}
          icon={<FlaskConical size={18} />}
          accent="brand"
        />
        <StatTile
          label="Upcoming"
          value={String(counts.upcoming)}
          sublabel={
            counts.upcoming > 0 ? "Awaiting collection or lab" : "All clear"
          }
          icon={<Clock size={18} />}
          accent="sky"
        />
        <StatTile
          label="Completed"
          value={String(counts.completed)}
          sublabel="Reports available"
          icon={<CheckCircle2 size={18} />}
          accent="green"
        />
        <StatTile
          label="Spent this month"
          value={
            summary.spentThisMonth > 0
              ? `LKR ${summary.spentThisMonth.toLocaleString()}`
              : "LKR 0"
          }
          sublabel="Completed tests only"
          icon={<Wallet size={18} />}
          accent="amber"
        />
      </section>

      {/* ── 3. Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {TABS.map((t) => {
          const count =
            t.key === ""
              ? counts.all
              : t.key === "active"
                ? counts.upcoming
                : t.key === "completed"
                  ? counts.completed
                  : counts.cancelled;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-pill px-4 h-9 text-[12.5px] font-semibold transition-all",
                active
                  ? "bg-brand text-white shadow-sm"
                  : "border border-border bg-surface-1 text-text-soft hover:border-brand/40 hover:text-text",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "inline-grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tracking-wide",
                  active
                    ? "bg-white/25 text-white"
                    : "bg-surface-2 text-text-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 4. Bookings list ────────────────────────────────────────── */}
      <Card className="!p-0 overflow-hidden">
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="No bookings here"
          emptyDescription="Try a different tab, or book your first lab test."
        >
          {(data) => {
            const list = (data?.bookings ?? []).slice().sort((a, b) => {
              const ta = a.scheduledAt
                ? new Date(a.scheduledAt).getTime()
                : a.scheduledDate
                  ? new Date(a.scheduledDate).getTime()
                  : 0;
              const tb = b.scheduledAt
                ? new Date(b.scheduledAt).getTime()
                : b.scheduledDate
                  ? new Date(b.scheduledDate).getTime()
                  : 0;
              return tb - ta; // newest first
            });

            if (list.length === 0) {
              return <EmptyBookings onBook={() => setTab("")} />;
            }

            return (
              <ul className="flex flex-col">
                {list.map((b, idx) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    isLast={idx === list.length - 1}
                  />
                ))}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Booking card
 * ──────────────────────────────────────────────────────────────────── */
function BookingCard({
  booking: b,
  isLast,
}: {
  booking: BookingRow;
  isLast: boolean;
}) {
  const stage = pipelineIndex(b.status);
  const isCancelled = b.status === "cancelled";
  const isCompleted = b.status === "completed";
  const total = b.totalPrice ?? b.totalAmount ?? null;
  const name = b.itemName || b.packageName || "Test booking";
  const date = b.scheduledDate
    ? `${b.scheduledDate}T00:00:00`
    : (b.scheduledAt ?? null);
  const time = extractTime(b.scheduledTimeSlot);

  return (
    <li
      className={cn(
        "relative transition-colors hover:bg-surface-2/60",
        !isLast && "border-b border-border",
      )}
    >
      <Link
        href={`/patient/diagnostic-tests/bookings/${b.id}`}
        className="group flex flex-col sm:flex-row gap-4 p-4 sm:p-5"
      >
        {/* Date chip — left rail */}
        <DateChip iso={date} status={b.status} />

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Title + status pill */}
          <div className="flex flex-wrap items-start gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)",
                  }}
                  aria-hidden
                >
                  <FlaskConical size={13} />
                </span>
                <h3 className="text-[14.5px] font-bold text-text truncate">
                  {name}
                </h3>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-soft">
                {time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} className="text-text-muted" />
                    {time}
                  </span>
                ) : null}
                {b.labName ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} className="text-text-muted" />
                    {b.labName}
                  </span>
                ) : null}
                <span className="font-mono text-[10.5px] text-text-muted">
                  #{shortId(b.id)}
                </span>
                {b.scheduledAt ? (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <Timer size={11} />
                    {formatRelative(b.scheduledAt)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StatusPill tone={statusTone(b.status)} icon={pillIcon(b.status)}>
                {humanize(b.status)}
              </StatusPill>
              {b.paymentStatus ? (
                <StatusPill tone={paymentTone(b.paymentStatus)}>
                  {humanize(b.paymentStatus)}
                </StatusPill>
              ) : null}
            </div>
          </div>

          {/* Row 2: progress pipeline (hidden for cancelled) */}
          {!isCancelled ? (
            <div className="mt-4">
              <Pipeline progress={stage} />
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11.5px] text-rose-700">
              <XCircle size={13} />
              <span className="font-semibold">Cancelled</span>
              <span className="text-rose-600/80">
                · This booking won't proceed. You can book a new test any time.
              </span>
            </div>
          )}

          {/* Row 3: footer — price + quick actions */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-dashed border-border">
            <div className="flex items-center gap-3 text-[12px]">
              {total != null ? (
                <span className="inline-flex items-baseline gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                    Total
                  </span>
                  <span className="font-extrabold text-text tabular-nums">
                    LKR {total.toLocaleString()}
                  </span>
                </span>
              ) : null}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 size={12} />
                  Report ready
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-text-soft group-hover:text-brand transition-colors">
              <span>View details</span>
              <ChevronRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Pipeline progress bar
 * ──────────────────────────────────────────────────────────────────── */
function Pipeline({ progress }: { progress: number }) {
  if (progress < 0) return null;
  const pct = Math.max(0, Math.min(1, (progress + 1) / PIPELINE.length));
  return (
    <div className="relative">
      <div className="flex items-start justify-between">
        {PIPELINE.map((s, i) => {
          const done = i <= progress;
          const current = i === progress;
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="flex flex-col items-center min-w-0 flex-1 relative"
            >
              {/* Connector to previous */}
              {i > 0 ? (
                <div
                  className={cn(
                    "absolute top-3.5 right-1/2 -translate-y-1/2 h-0.5 -z-0",
                    i <= progress ? "bg-brand" : "bg-border",
                  )}
                  style={{
                    left: "-50%",
                    right: "50%",
                  }}
                />
              ) : null}

              <div
                className={cn(
                  "relative z-10 grid h-7 w-7 place-items-center rounded-full transition-colors",
                  done
                    ? "bg-brand text-white shadow-sm shadow-brand/30"
                    : "bg-surface-2 text-text-muted border border-border",
                  current && "ring-4 ring-brand/15",
                )}
                aria-hidden
              >
                {done && i < progress ? (
                  <CheckCircle2 size={13} strokeWidth={2.4} />
                ) : (
                  <Icon size={12} strokeWidth={2.2} />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-semibold uppercase tracking-wider",
                  done ? "text-brand" : "text-text-muted",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Faint fill bar behind the icons for visual continuity */}
      <div className="sr-only">{Math.round(pct * 100)}% complete</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Date chip on the left rail of each booking
 * ──────────────────────────────────────────────────────────────────── */
function DateChip({
  iso,
  status,
}: {
  iso: string | null;
  status: string;
}) {
  if (!iso) {
    return (
      <div className="flex sm:flex-col items-center sm:items-stretch gap-2 sm:gap-0 sm:w-[78px] sm:shrink-0 rounded-md border border-dashed border-border bg-surface-2/60 px-3 py-2 sm:py-3 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          TBD
        </span>
      </div>
    );
  }
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.toLocaleDateString("en-GB", { year: "2-digit" });
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const faded = status === "completed" || status === "cancelled";
  return (
    <div
      className={cn(
        "flex sm:flex-col items-center sm:items-stretch gap-2 sm:gap-0 sm:w-[78px] sm:shrink-0 rounded-md border px-3 py-2 sm:py-3 text-center transition-colors",
        faded
          ? "border-border bg-surface-1 text-text-soft"
          : "border-brand/30 bg-brand-soft text-brand",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.14em]",
          faded ? "text-text-muted" : "text-brand",
        )}
      >
        {weekday}
      </span>
      <span className="text-2xl font-extrabold tabular-nums leading-none">
        {day}
      </span>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          faded ? "text-text-muted" : "text-brand/80",
        )}
      >
        {month} '{year}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Next-upcoming inline card inside the hero
 * ──────────────────────────────────────────────────────────────────── */
function NextUpcomingCard({ booking }: { booking: BookingRow }) {
  const name = booking.itemName || booking.packageName || "Test booking";
  const date = booking.scheduledDate
    ? `${booking.scheduledDate}T00:00:00`
    : (booking.scheduledAt ?? null);
  const dayLabel = date ? formatDayLabel(date) : "TBD";
  const time = extractTime(booking.scheduledTimeSlot);
  return (
    <div className="mt-4 inline-flex flex-col gap-1 rounded-xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3 max-w-md">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Next up
      </span>
      <span className="text-sm font-bold text-white truncate">{name}</span>
      <span className="text-[12px] text-sky-100/80 inline-flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={11} />
          {dayLabel}
        </span>
        {time ? (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {time}
          </span>
        ) : null}
        {booking.labName ? (
          <span className="inline-flex items-center gap-1">
            <Home size={11} />
            {booking.labName}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Empty state — when there are no bookings in the active tab
 * ──────────────────────────────────────────────────────────────────── */
function EmptyBookings({ onBook }: { onBook: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div
        className="h-16 w-16 rounded-2xl grid place-items-center mb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(2,132,199,0.18) 100%)",
        }}
        aria-hidden
      >
        <FlaskConical size={26} className="text-sky-700" strokeWidth={1.7} />
      </div>
      <h3 className="text-[15px] font-bold text-text">No bookings here yet</h3>
      <p className="mt-1.5 text-[12.5px] text-text-soft max-w-sm leading-relaxed">
        Schedule a lab test or checkup package — your bookings, status, and
        reports will all live here.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 justify-center">
        <Link
          href="/patient/diagnostic-tests"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-brand/90 transition-colors"
        >
          <Plus size={13} />
          Book a test
        </Link>
        <button
          type="button"
          onClick={onBook}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3.5 text-[12.5px] font-semibold text-text-soft hover:border-brand/40 hover:text-text transition-colors"
        >
          <RotateCcw size={12} />
          View all bookings
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────── */
function pillIcon(status: string) {
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

function shortId(id: string): string {
  return id.length > 10 ? id.slice(-6).toUpperCase() : id.toUpperCase();
}

function extractTime(slot?: string): string | null {
  if (!slot) return null;
  // Slot can be "07:00 - 09:00 AM" or just "07:00"
  const first = slot.split(/[-–]/)[0]?.trim();
  if (!first) return null;
  const m = first.match(/(\d{1,2}):(\d{2})/);
  if (!m) return slot;
  let h = Number(m[1]);
  const min = m[2];
  const meridiem = /PM|pm/i.test(slot) && h < 12 ? "PM" : h >= 12 ? "PM" : "AM";
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${meridiem}`;
}
