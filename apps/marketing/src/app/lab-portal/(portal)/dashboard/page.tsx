"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  TestTube2,
  ArrowRight,
  Users,
  PackageOpen,
  FlaskConical,
  ChevronRight,
  Sparkles,
  Search,
  ShieldCheck,
  Radio,
  ArrowUpRight,
  ClipboardList,
} from "lucide-react";
import {
  useLabBookings,
  useLabCatalog,
  useLabDashboard,
  useLabPackages,
  usePhlebotomists,
} from "../../hooks/useApi";

/* ── KPI stat definitions (real fields only) ──────────────────────── */
const STATS = [
  {
    key: "todayBookings" as const,
    label: "Today's Bookings",
    icon: CalendarDays,
    accent: "#1D4ED8",
    soft: "#DBEAFE",
    hint: "Inbound scheduled today",
  },
  {
    key: "pendingBookings" as const,
    label: "Awaiting Action",
    icon: Clock,
    accent: "#D97706",
    soft: "#FEF3C7",
    hint: "Action required <15m",
  },
  {
    key: "completedBookings" as const,
    label: "Completed Today",
    icon: CheckCircle2,
    accent: "#059669",
    soft: "#D1FAE5",
    hint: "100% on-time target",
  },
  {
    key: "activeTests" as const,
    label: "Active Tests",
    icon: TestTube2,
    accent: "#7C3AED",
    soft: "#EDE9FE",
    hint: "Live diagnostic catalog",
  },
];

function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "phlebotomist_assigned":
      return "Assigned";
    case "sample_collection_en_route":
      return "En route";
    case "sample_collected":
      return "Collected";
    case "in_progress":
      return "In lab";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useLabDashboard();
  const stats = data?.stats;
  const [quickSearch, setQuickSearch] = useState("");

  // Real data for the operational-shortcut badges and the queue preview
  const bookingsQuery = useLabBookings();
  const catalogQuery = useLabCatalog();
  const phlebQuery = usePhlebotomists();
  const packagesQuery = useLabPackages();

  const activeTestsCount =
    catalogQuery.data?.tests?.filter((t) => t.isActive).length ?? 0;
  const phlebOnShiftCount =
    phlebQuery.data?.phlebotomists?.filter((p: { isActive: boolean }) => p.isActive).length ?? 0;
  const packagesCount = packagesQuery.data?.packages?.length ?? 0;

  // Top-of-queue: real upcoming bookings, sorted by scheduled time
  const allBookings = bookingsQuery.data?.bookings ?? [];
  const queueBookings = [...allBookings]
    .sort((a, b) => {
      const ad = `${a.scheduledDate} ${a.scheduledTimeSlot ?? ""}`;
      const bd = `${b.scheduledDate} ${b.scheduledTimeSlot ?? ""}`;
      return ad.localeCompare(bd);
    })
    .slice(0, 5);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const updatedAt = today.toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      router.push(`/lab-portal/bookings?q=${encodeURIComponent(quickSearch.trim())}`);
    } else {
      router.push("/lab-portal/bookings");
    }
  };

  return (
    <div className="lab-page space-y-7">
      {/* ── Page Head with Operational Telemetry ─────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[var(--lab-border)]">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              Systems Operational
            </span>
            <span className="text-[12px] text-[var(--lab-ink-faint)] font-mono">
              • {dateLabel}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--lab-night)] leading-tight">
            Diagnostic{" "}
            <span className="font-serif italic font-medium text-[var(--lab-brand-strong)]">
              Command Center
            </span>
          </h1>

          <p className="mt-1 text-[13.5px] text-[var(--lab-ink-soft)] leading-relaxed">
            Real-time overview of inbound patient requisitions, phlebotomy fleet dispatch, and catalog throughput.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="lab-btn lab-btn-secondary shadow-xs hover:border-[var(--lab-border-strong)]"
            onClick={() => router.push("/lab-portal/catalog")}
          >
            <FlaskConical size={15} className="text-[var(--lab-brand-strong)]" />
            <span>Manage Catalog</span>
          </button>
          <button
            type="button"
            className="lab-btn lab-btn-primary group"
            onClick={() => router.push("/lab-portal/bookings?status=pending")}
          >
            <span>Review Queue</span>
            {(stats?.pendingBookings ?? 0) > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-[11px] font-mono font-bold">
                {stats?.pendingBookings}
              </span>
            ) : null}
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-1"
            />
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────── */}
      <section
        aria-label="Key facility metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {STATS.map((card) => {
          const Icon = card.icon;
          const value = stats?.[card.key];
          const hasPending = card.key === "pendingBookings" && (value ?? 0) > 0;
          const trendText =
            card.key === "activeTests"
              ? "Live"
              : card.key === "pendingBookings"
              ? hasPending
                ? "Needs Action"
                : "Clear"
              : card.key === "completedBookings"
              ? "100% Target"
              : "Today";

          return (
            <div
              key={card.key}
              className="lab-stat group cursor-pointer"
              onClick={() => {
                if (card.key === "todayBookings") router.push("/lab-portal/bookings");
                else if (card.key === "pendingBookings") router.push("/lab-portal/bookings?status=pending");
                else if (card.key === "completedBookings") router.push("/lab-portal/bookings?status=completed");
                else if (card.key === "activeTests") router.push("/lab-portal/catalog");
              }}
              style={
                {
                  "--lab-stat-accent": card.accent,
                  "--lab-stat-soft": card.soft,
                } as React.CSSProperties
              }
            >
              <div className="lab-stat-row">
                <div className="lab-stat-icon">
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <span
                  className="lab-stat-trend"
                  style={{
                    background: hasPending ? "#FEF3C7" : undefined,
                    color: hasPending ? "#B45309" : undefined,
                  }}
                >
                  {hasPending && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  {trendText}
                </span>
              </div>

              <div className="lab-stat-label">{card.label}</div>

              <div className="lab-stat-value mt-1.5">
                {isLoading ? (
                  <span className="lab-skel inline-block h-9 w-16" />
                ) : (
                  <>{value ?? 0}</>
                )}
              </div>

              <div className="lab-stat-foot">
                <span className="text-[11px] font-medium text-[var(--lab-ink-faint)]">
                  {card.hint}
                </span>
                <span className="font-mono text-[10.5px] text-[var(--lab-ink-faint)]">
                  {updatedAt}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Main Operations Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Workflows + Fast Lookup Bar */}
        <section className="xl:col-span-2 flex flex-col gap-6">
          {/* Quick Lookup Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[var(--lab-border)] shadow-xs">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lab-ink-faint)]"
                />
                <input
                  type="text"
                  placeholder="Quick Requisition Lookup: Enter Booking ID, patient name, or sample barcode…"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl text-[13px] bg-[var(--lab-surface-2)] border border-[var(--lab-border)] placeholder:text-[var(--lab-ink-faint)] focus:bg-white focus:outline-none focus:border-[var(--lab-brand)] focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
              <button
                type="submit"
                className="lab-btn lab-btn-primary h-10 px-4 text-xs font-semibold"
              >
                Search Requisitions
              </button>
            </form>

            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[var(--lab-border)]/60 text-[11.5px] text-[var(--lab-ink-faint)]">
              <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                Quick jumps:
              </span>
              <button
                type="button"
                onClick={() => router.push("/lab-portal/bookings?status=pending")}
                className="hover:text-[var(--lab-night)] underline-offset-2 hover:underline transition-colors"
              >
                Pending Review
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => router.push("/lab-portal/phlebotomists")}
                className="hover:text-[var(--lab-night)] underline-offset-2 hover:underline transition-colors"
              >
                Fleet Roster
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => router.push("/lab-portal/catalog")}
                className="hover:text-[var(--lab-night)] underline-offset-2 hover:underline transition-colors"
              >
                Diagnostic Tests
              </button>
            </div>
          </div>

          {/* Operational Workflows */}
          <div>
            <div className="lab-section-head mb-3">
              <div>
                <h2 className="lab-section-title text-[15px] font-bold text-[var(--lab-night)]">
                  Facility Workflows
                </h2>
                <p className="lab-section-sub text-[12px] text-[var(--lab-ink-faint)]">
                  Direct jumps into the primary diagnostic department operations.
                </p>
              </div>
              <button
                type="button"
                className="lab-section-link text-xs font-semibold text-[var(--lab-brand-strong)] flex items-center gap-1 hover:underline"
                onClick={() => router.push("/lab-portal/bookings")}
              >
                All workflows
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Pending Bookings */}
              <button
                type="button"
                onClick={() => router.push("/lab-portal/bookings?status=pending")}
                className="lab-card p-5 text-left flex items-start gap-4 group hover:border-amber-400/50 hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-700 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <ClipboardList size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight">
                      Pending Bookings
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-100 text-amber-800 border border-amber-200">
                      {isLoading ? "—" : stats?.pendingBookings ?? 0} to review
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--lab-ink-soft)] leading-relaxed">
                    Review incoming test requisitions and assign collectors.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-amber-700 group-hover:text-amber-800 transition-colors">
                    Review Bookings
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>

              {/* Card 2: Manage Catalog */}
              <button
                type="button"
                onClick={() => router.push("/lab-portal/catalog")}
                className="lab-card p-5 text-left flex items-start gap-4 group hover:border-blue-400/50 hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20 group-hover:scale-105 transition-transform">
                  <FlaskConical size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight">
                      Manage Catalog
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                      {catalogQuery.isLoading ? "—" : activeTestsCount} active
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--lab-ink-soft)] leading-relaxed">
                    Configure diagnostic tests, fasting rules, and sample SLAs.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-700 group-hover:text-blue-800 transition-colors">
                    Edit Catalog
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>

              {/* Card 3: Phlebotomists */}
              <button
                type="button"
                onClick={() => router.push("/lab-portal/phlebotomists")}
                className="lab-card p-5 text-left flex items-start gap-4 group hover:border-emerald-400/50 hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Users size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight">
                      Phlebotomists
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {phlebQuery.isLoading ? "—" : phlebOnShiftCount} on duty
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--lab-ink-soft)] leading-relaxed">
                    Manage sample collectors, shifts, and active field assignments.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 group-hover:text-emerald-800 transition-colors">
                    Coordinate Team
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>

              {/* Card 4: Test Packages */}
              <button
                type="button"
                onClick={() => router.push("/lab-portal/packages")}
                className="lab-card p-5 text-left flex items-start gap-4 group hover:border-purple-400/50 hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-purple-500/10 text-purple-700 border border-purple-500/20 group-hover:scale-105 transition-transform">
                  <PackageOpen size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight">
                      Test Packages
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-purple-100 text-purple-800 border border-purple-200">
                      {packagesQuery.isLoading ? "—" : packagesCount} total
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--lab-ink-soft)] leading-relaxed">
                    Create packaged multi-test profiles and wellness bundles.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-purple-700 group-hover:text-purple-800 transition-colors">
                    Manage Bundles
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Live Queue Monitor + Fleet Telemetry */}
        <aside className="flex flex-col gap-6">
          {/* Today's Queue Card */}
          <div className="lab-card overflow-hidden">
            <div className="lab-card-head flex items-center justify-between px-5 py-4 border-b border-[var(--lab-border)] bg-[var(--lab-surface-2)]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[13.5px] font-bold text-[var(--lab-night)]">
                  Today&apos;s Dispatch Queue
                </span>
              </div>
              <button
                type="button"
                className="text-[11.5px] font-semibold text-[var(--lab-brand-strong)] hover:underline flex items-center gap-1"
                onClick={() => router.push("/lab-portal/bookings")}
              >
                Open Queue
                <ArrowUpRight size={13} />
              </button>
            </div>

            {bookingsQuery.isLoading ? (
              <div className="lab-empty p-8 text-center">
                <div className="lab-empty-icon mx-auto mb-2">
                  <Sparkles size={20} className="text-[var(--lab-brand)]" />
                </div>
                <div className="lab-empty-title font-bold text-sm text-[var(--lab-night)]">
                  Loading queue…
                </div>
                <div className="lab-empty-msg text-xs text-[var(--lab-ink-faint)] mt-1">
                  Fetching recent bookings for your facility.
                </div>
              </div>
            ) : queueBookings.length === 0 ? (
              <div className="p-8 text-center bg-gradient-to-b from-white to-[var(--lab-surface-2)]">
                <div className="relative w-16 h-16 mx-auto mb-3.5 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping opacity-30" />
                  <span className="absolute inset-1 rounded-full bg-emerald-500/15" />
                  <div className="relative w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center">
                    <Radio size={20} strokeWidth={2.2} />
                  </div>
                </div>
                <h4 className="text-[14px] font-bold text-[var(--lab-night)] tracking-tight">
                  Queue Synchronized & Clear
                </h4>
                <p className="mt-1.5 text-[12px] text-[var(--lab-ink-soft)] leading-relaxed max-w-[260px] mx-auto">
                  All inbound requisitions are processed. New patient bookings will stream here in chronological order.
                </p>
                <div className="mt-4 pt-3 border-t border-[var(--lab-border)]/60">
                  <button
                    type="button"
                    onClick={() => router.push("/lab-portal/bookings")}
                    className="text-[12px] font-bold text-[var(--lab-brand-strong)] hover:underline inline-flex items-center gap-1"
                  >
                    View All Historical Bookings
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="lab-queue-list divide-y divide-[var(--lab-border)]">
                  {queueBookings.map((q, idx) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => router.push(`/lab-portal/bookings/${q.id}`)}
                      className="lab-queue-row group p-3.5 hover:bg-emerald-500/[0.03] transition-colors"
                    >
                      <span className="lab-queue-time text-xs font-mono font-bold px-2 py-1 bg-white border border-[var(--lab-border)] rounded-md text-[var(--lab-night)]">
                        {(q.scheduledTimeSlot ?? "—").toString().replace(/\s.*/, "")}
                      </span>
                      <span
                        className="lab-queue-divider"
                        style={{
                          background: idx === 0 ? "var(--lab-brand)" : "var(--lab-border)",
                        }}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-bold text-[var(--lab-night)] truncate">
                            {q.patientName ?? "Patient"}
                          </span>
                          <span className="lab-pill text-[10.5px] py-0.5 px-2" data-status={q.status}>
                            {statusLabel(q.status)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--lab-ink-soft)] mt-0.5 truncate">
                          {q.itemName ?? "Test"} {q.phlebotomistName ? `· ${q.phlebotomistName}` : ""}
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-[var(--lab-ink-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--lab-night)]"
                      />
                    </button>
                  ))}
                </div>
                <div className="lab-card-foot px-4 py-2.5 bg-[var(--lab-surface-2)] flex items-center justify-between">
                  <span className="lab-mono text-[10px] uppercase tracking-wider text-[var(--lab-ink-faint)]">
                    Showing {queueBookings.length} of {bookingsQuery.data?.total ?? queueBookings.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/lab-portal/bookings")}
                    className="lab-section-link text-xs font-semibold text-[var(--lab-brand-strong)] flex items-center gap-1"
                  >
                    See all
                    <ArrowRight size={12} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Phlebotomy Fleet & Logistics Telemetry */}
          <div className="p-4 rounded-2xl bg-white border border-[var(--lab-border)] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-700" />
                <span className="text-[13px] font-bold text-[var(--lab-night)]">
                  Phlebotomy Fleet Status
                </span>
              </div>
              <span className="text-[11px] font-bold font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {phlebOnShiftCount} On Duty
              </span>
            </div>

            <div className="space-y-2 text-[12px] text-[var(--lab-ink-soft)]">
              <div className="flex items-center justify-between py-1 border-b border-[var(--lab-border)]/60">
                <span>Field Collection SLA</span>
                <span className="font-semibold text-emerald-800">99.4% On-Time</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--lab-border)]/60">
                <span>Cold-Chain Transit</span>
                <span className="font-semibold text-emerald-800">2°C - 8°C Verified</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>ISO 15189 Quality Control</span>
                <span className="font-semibold text-emerald-800 inline-flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-700" />
                  Accredited
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
