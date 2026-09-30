"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FlaskConical,
  MapPin,
  Microscope,
  Plus,
  TestTube2,
  Timer,
  Wallet,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { formatDayLabel, humanize, formatRelative } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  Badge,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroPulse,
  LiveDot,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RowAccent,
  SECONDARY_BTN,
  Segmented,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

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

const BOOKING_CARD =
  "group relative flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]";

export default function TestBookingsPage() {
  const [tab, setTab] = useState<string>("");
  const [now] = useState(() => Date.now());
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
    const monthStart = new Date(now);
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
  }, [allQuery.data, now]);

  const list = (query.data?.bookings ?? []).slice().sort((a, b) => {
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

  const next = summary.nextUpcoming;
  const nextDate = next
    ? next.scheduledDate
      ? `${next.scheduledDate}T00:00:00`
      : (next.scheduledAt ?? null)
    : null;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<FlaskConical size={13} aria-hidden />}
          kicker="Lab tests"
          kickerMeta="Orders & results"
          title={
            <>
              My lab <HeroAccent>bookings</HeroAccent>
            </>
          }
          description="Every lab test and package you've scheduled — with live status, collection timeline, and result availability in one place."
          chips={
            <>
              <span className={HERO_CHIP}>
                <LiveDot />
                {counts.upcoming > 0 ? `${counts.upcoming} upcoming` : "Nothing pending"}
              </span>
              <span className={HERO_CHIP}>
                <Wallet size={12} className="text-sky-300" aria-hidden />
                LKR {summary.spentThisMonth.toLocaleString()} this month
              </span>
            </>
          }
          aside={
            <HeroPulse
              icon={<CalendarDays size={20} strokeWidth={2.3} aria-hidden />}
              label="Next collection"
              value={nextDate ? formatDayLabel(nextDate) : "—"}
              sub={
                next
                  ? [next.itemName || next.packageName || "Test booking", extractTime(next.scheduledTimeSlot)]
                      .filter(Boolean)
                      .join(" · ")
                  : "No booking scheduled"
              }
            />
          }
          actions={
            <>
              <Link href="/patient/records" className={HERO_GHOST}>
                <FlaskConical size={15} aria-hidden />
                Past reports
              </Link>
              <Link href="/patient/diagnostic-tests" className={HERO_PRIMARY}>
                <Plus size={15} className="text-sky-600" aria-hidden />
                Book a test
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All bookings"
            icon={<FlaskConical size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(counts.all)}
            sub={`${counts.completed} completed`}
            active={tab === ""}
            onClick={() => setTab("")}
          />
          <StatTile
            label="Upcoming"
            icon={<Clock3 size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(counts.upcoming)}
            sub={counts.upcoming > 0 ? "Awaiting collection or lab" : "All clear"}
            pulse={counts.upcoming > 0}
            badge={counts.upcoming > 0 ? { text: "Live", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={tab === "active"}
            onClick={() => setTab("active")}
          />
          <StatTile
            label="Completed"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(counts.completed)}
            sub="Reports available"
            active={tab === "completed"}
            onClick={() => setTab("completed")}
          />
          <StatTile
            label="Cancelled"
            icon={<XCircle size={16} />}
            tone="bg-rose-50 text-rose-600"
            value={String(counts.cancelled)}
            sub="Won't proceed"
            active={tab === "cancelled"}
            onClick={() => setTab("cancelled")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="bk-list">
          <PanelHeader
            id="bk-list"
            icon={<FlaskConical size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Bookings"
            caption={query.isLoading ? "Loading…" : `${list.length} shown · newest first`}
            action={
              <Link href="/patient/diagnostic-tests" className={SECONDARY_BTN}>
                <Plus size={13} aria-hidden />
                <span className="hidden sm:inline">Book a test</span>
              </Link>
            }
          />

          <div className="mt-5">
            <Segmented<string>
              ariaLabel="Booking filters"
              value={tab}
              onChange={setTab}
              options={TABS.map((t) => ({
                value: t.key,
                label: t.label,
                count:
                  t.key === ""
                    ? counts.all
                    : t.key === "active"
                      ? counts.upcoming
                      : t.key === "completed"
                        ? counts.completed
                        : counts.cancelled,
              }))}
            />
          </div>

          {query.isLoading ? (
            <PanelSkeleton rows={4} />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : list.length === 0 ? (
            <EmptyBlock
              icon={<FlaskConical size={19} />}
              title="No bookings here"
              body="Schedule a lab test or checkup package — your bookings, status, and reports will all live here."
              actions={
                <>
                  <Link
                    href="/patient/diagnostic-tests"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Plus size={13} aria-hidden />
                    Book a test
                  </Link>
                  {tab !== "" ? (
                    <button type="button" onClick={() => setTab("")} className={SECONDARY_BTN}>
                      View all bookings
                    </button>
                  ) : null}
                </>
              }
            />
          ) : (
            <div className="mt-5 space-y-3">
              {list.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Booking tools">
          <QuickToolsPanel
            id="bk-tools"
            tools={[
              { href: "/patient/diagnostic-tests", label: "Book a test", hint: "Browse tests", icon: FlaskConical, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/diagnostic-tests/packages", label: "Packages", hint: "Bundled deals", icon: TestTube2, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
              { href: "/patient/records", label: "Records", hint: "Past reports", icon: Activity, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
            ]}
          />
          <PromoCard
            href="/patient/diagnostic-tests/packages"
            kicker="Better value"
            icon={<TestTube2 size={21} aria-hidden />}
            title="Bundle tests in a package"
            body="Accredited lab bundles at one discounted price"
          />
        </aside>
      </div>
    </PatientPage>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Booking card
 * ──────────────────────────────────────────────────────────────────── */
function BookingCard({ booking: b }: { booking: BookingRow }) {
  const stage = pipelineIndex(b.status);
  const isCancelled = b.status === "cancelled";
  const isCompleted = b.status === "completed";
  const total = b.totalPrice ?? b.totalAmount ?? null;
  const name = b.itemName || b.packageName || "Test booking";
  const date = b.scheduledDate
    ? `${b.scheduledDate}T00:00:00`
    : (b.scheduledAt ?? null);
  const time = extractTime(b.scheduledTimeSlot);
  const tone = statusTone(b.status);

  return (
    <Link href={`/patient/diagnostic-tests/bookings/${b.id}`} className={BOOKING_CARD}>
      <RowAccent
        className={
          tone === "emerald"
            ? "bg-emerald-500"
            : tone === "amber"
              ? "bg-amber-400"
              : tone === "rose"
                ? "bg-rose-500"
                : tone === "sky"
                  ? "bg-sky-500"
                  : "bg-slate-300"
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Date chip — left rail */}
        <DateChip iso={date} status={b.status} />

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                {name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                {time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} className="text-slate-400" aria-hidden />
                    {time}
                  </span>
                ) : null}
                {b.labName ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} className="text-slate-400" aria-hidden />
                    {b.labName}
                  </span>
                ) : null}
                <span className="font-mono text-[10.5px] text-slate-400">
                  #{shortId(b.id)}
                </span>
                {b.scheduledAt ? (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Timer size={11} aria-hidden />
                    {formatRelative(b.scheduledAt)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge tone={tone}>
                {pillIcon(b.status)}
                {humanize(b.status)}
              </Badge>
              {b.paymentStatus ? (
                <Badge tone={paymentTone(b.paymentStatus)}>
                  {humanize(b.paymentStatus)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Progress pipeline (hidden for cancelled) */}
      {!isCancelled ? (
        <div className="pl-1 sm:pl-[92px]">
          <Pipeline progress={stage} />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50/70 px-3 py-2 text-[11.5px] text-rose-700 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.15)]">
          <XCircle size={13} aria-hidden />
          <span className="font-semibold">Cancelled</span>
          <span className="text-rose-600/80">
            · This booking won&rsquo;t proceed. You can book a new test any time.
          </span>
        </div>
      )}

      {/* Footer — price + quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-3">
        <div className="flex items-center gap-3 text-[12px]">
          {total != null ? (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Total
              </span>
              <span className="font-bold tabular-nums text-slate-900">
                LKR {total.toLocaleString()}
              </span>
            </span>
          ) : null}
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 size={12} aria-hidden />
              Report ready
            </span>
          ) : null}
        </div>

        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 transition-colors group-hover:text-sky-700">
          View details
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
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
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {/* Connector to previous */}
              {i > 0 ? (
                <div
                  className={cn(
                    "absolute right-1/2 top-3.5 -z-0 h-0.5 -translate-y-1/2",
                    i <= progress ? "bg-sky-600" : "bg-slate-200",
                  )}
                  style={{ left: "-50%", right: "50%" }}
                />
              ) : null}

              <div
                className={cn(
                  "relative z-10 grid h-7 w-7 place-items-center rounded-full transition-colors",
                  done
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                    : "bg-slate-50 text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)]",
                  current && "ring-4 ring-sky-100",
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
                  done ? "text-sky-700" : "text-slate-400",
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
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-center shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] sm:w-[78px] sm:shrink-0 sm:flex-col sm:gap-0 sm:py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
        "flex items-center gap-2 rounded-lg px-3 py-2 text-center transition-colors sm:w-[78px] sm:shrink-0 sm:flex-col sm:gap-0 sm:py-3",
        faded
          ? "bg-slate-50 text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]"
          : "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_rgba(2,132,199,0.25)]",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.14em]",
          faded ? "text-slate-400" : "text-sky-600",
        )}
      >
        {weekday}
      </span>
      <span className="text-2xl font-bold leading-none tabular-nums">
        {day}
      </span>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          faded ? "text-slate-400" : "text-sky-600/80",
        )}
      >
        {month} &rsquo;{year}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────── */
function pillIcon(status: string) {
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
