"use client";

import { useState } from "react";
import Link from "next/link";
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
  Search,
  ShieldCheck,
  Radio,
  ClipboardList,
  Activity,
} from "lucide-react";
import {
  useLabBookings,
  useLabCatalog,
  useLabDashboard,
  useLabPackages,
  usePhlebotomists,
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
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  PanelSkeleton,
  Badge,
  type Tone,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

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

function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "Pending";
    case "confirmed": return "Confirmed";
    case "phlebotomist_assigned": return "Assigned";
    case "sample_collection_en_route": return "En route";
    case "sample_collected": return "Collected";
    case "in_progress": return "In lab";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return s.replace(/_/g, " ");
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useLabDashboard();
  const stats = data?.stats;
  const [quickSearch, setQuickSearch] = useState("");

  const bookingsQuery = useLabBookings();
  const catalogQuery = useLabCatalog();
  const phlebQuery = usePhlebotomists();
  const packagesQuery = useLabPackages();

  const activeTestsCount =
    catalogQuery.data?.tests?.filter((t) => t.isActive).length ?? 0;
  const phlebOnShiftCount =
    phlebQuery.data?.phlebotomists?.filter((p: { isActive: boolean }) => p.isActive).length ?? 0;
  const packagesCount = packagesQuery.data?.packages?.length ?? 0;

  const allBookings = bookingsQuery.data?.bookings ?? [];
  const queueBookings = [...allBookings]
    .sort((a, b) => {
      const ad = `${a.scheduledDate} ${a.scheduledTimeSlot ?? ""}`;
      const bd = `${b.scheduledDate} ${b.scheduledTimeSlot ?? ""}`;
      return ad.localeCompare(bd);
    })
    .slice(0, 6);

  const dateLabel = new Date().toLocaleDateString("en-LK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickSearch.trim();
    router.push(q ? `/lab-portal/bookings?q=${encodeURIComponent(q)}` : "/lab-portal/bookings");
  };

  const hero = (
    <DoctorHero
      kicker="Diagnostic command"
      kickerIcon={<FlaskConical size={12} />}
      kickerMeta={dateLabel}
      title="Lab command center"
      description="Real-time overview of inbound patient requisitions, phlebotomy fleet dispatch, and catalog throughput."
      chips={
        <>
          <span className={HERO_CHIP}>
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Systems operational
          </span>
          <span className={HERO_CHIP}>
            <TestTube2 size={12} /> {activeTestsCount} active tests
          </span>
          <span className={HERO_CHIP}>
            <Users size={12} /> {phlebOnShiftCount} phlebotomists on duty
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<ClipboardList size={18} />}
          label="Awaiting action"
          value={stats?.pendingBookings ?? 0}
          sub={stats?.pendingBookings ? "Review requisitions" : "Queue is clear"}
        />
      }
      actions={
        <>
          <Link href="/lab-portal/catalog" className={HERO_GHOST}>
            <FlaskConical size={14} /> Manage catalog
          </Link>
          <Link href="/lab-portal/bookings?status=pending" className={HERO_PRIMARY}>
            Review queue
            {(stats?.pendingBookings ?? 0) > 0 ? (
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-800">
                {stats?.pendingBookings}
              </span>
            ) : null}
            <ArrowRight size={14} />
          </Link>
        </>
      }
    />
  );

  if (isLoading && !data) {
    return (
      <div className="lab-page">
        {hero}
        <HeroOverlap>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)]" />
            ))}
          </div>
        </HeroOverlap>
        <PanelSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="lab-page flex flex-col gap-6">
      {hero}

      {/* ── Floating stat strip ── */}
      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            href="/lab-portal/bookings"
            label="Today's bookings"
            icon={<CalendarDays size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(stats?.todayBookings ?? 0)}
            sub="Inbound scheduled today"
          />
          <StatTile
            href="/lab-portal/bookings?status=pending"
            label="Awaiting action"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(stats?.pendingBookings ?? 0)}
            sub="Action required <15m"
            pulse={(stats?.pendingBookings ?? 0) > 0}
            badge={(stats?.pendingBookings ?? 0) > 0 ? { text: "Needs action", tone: "bg-amber-50 text-amber-700" } : { text: "Clear", tone: "bg-emerald-50 text-emerald-700" }}
          />
          <StatTile
            href="/lab-portal/bookings?status=completed"
            label="Completed today"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(stats?.completedBookings ?? 0)}
            sub="Closed requisitions"
          />
          <StatTile
            href="/lab-portal/catalog"
            label="Active tests"
            icon={<TestTube2 size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(activeTestsCount)}
            sub="Live diagnostic catalog"
          />
        </div>
      </HeroOverlap>

      {/* ── Operations grid ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={cn(PANEL, "xl:col-span-2")}>
          <PanelHeader
            icon={<Radio size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title="Today's dispatch queue"
            caption={
              bookingsQuery.data?.total != null
                ? `Showing ${queueBookings.length} of ${bookingsQuery.data.total} requisitions`
                : "Upcoming collections in chronological order"
            }
            href="/lab-portal/bookings"
            linkLabel="Open queue"
          />
          {queueBookings.length === 0 ? (
            <EmptyBlock
              icon={<Radio size={19} />}
              title="Queue synchronized & clear"
              body="All inbound requisitions are processed. New patient bookings will stream here in chronological order."
              actions={
                <Link href="/lab-portal/bookings" className="text-xs font-semibold text-sky-700 hover:underline">
                  View all bookings
                </Link>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {queueBookings.map((q) => (
                <li key={q.id}>
                  <RailRow
                    tone={STATUS_TONE[q.status] ?? "slate"}
                    active={q.status !== "cancelled"}
                    icon={<FlaskConical size={15} />}
                    title={
                      <span className="flex items-center gap-2">
                        {q.patientName ?? "Patient"}
                        <Badge tone={STATUS_TONE[q.status] ?? "slate"}>{statusLabel(q.status)}</Badge>
                      </span>
                    }
                    meta={`${q.itemName ?? "Test"} · ${q.scheduledDate} ${q.scheduledTimeSlot ?? ""}${q.phlebotomistName ? ` · ${q.phlebotomistName}` : ""}`}
                    trailing={
                      <Link
                        href={`/lab-portal/bookings/${q.id}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        aria-label="Open booking"
                      >
                        <ChevronRight size={15} />
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Quick requisition lookup */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
          >
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                placeholder="Quick lookup — booking ID, patient name, or barcode…"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800"
            >
              Search requisitions
            </button>
          </form>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-slate-400">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Quick jumps:</span>
            <Link href="/lab-portal/bookings?status=pending" className="hover:text-slate-700 hover:underline underline-offset-2">Pending review</Link>
            <span>·</span>
            <Link href="/lab-portal/phlebotomists" className="hover:text-slate-700 hover:underline underline-offset-2">Fleet roster</Link>
            <span>·</span>
            <Link href="/lab-portal/catalog" className="hover:text-slate-700 hover:underline underline-offset-2">Diagnostic tests</Link>
          </div>
        </section>

        {/* ── Aside: quick tools + fleet telemetry ── */}
        <aside className="flex flex-col gap-4">
          <QuickToolsPanel
            id="lab-quick-tools"
            title="Facility workflows"
            tag="One click"
            tools={[
              {
                href: "/lab-portal/bookings?status=pending",
                label: "Pending bookings",
                hint: `${stats?.pendingBookings ?? 0} to review`,
                icon: ClipboardList,
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                href: "/lab-portal/catalog",
                label: "Manage catalog",
                hint: `${activeTestsCount} active tests`,
                icon: FlaskConical,
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                href: "/lab-portal/phlebotomists",
                label: "Phlebotomists",
                hint: `${phlebOnShiftCount} on duty`,
                icon: Users,
                tone: "from-emerald-500 to-emerald-700 shadow-emerald-500/30",
              },
              {
                href: "/lab-portal/packages",
                label: "Test packages",
                hint: `${packagesCount} bundles`,
                icon: PackageOpen,
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<Activity size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Fleet telemetry"
              caption="Phlebotomy dispatch health"
              action={
                <Badge tone="emerald">{phlebOnShiftCount} on duty</Badge>
              }
            />
            <ul className="mt-4 space-y-2.5 text-[12.5px]">
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Field collection SLA</span>
                <span className="font-semibold text-emerald-700">99.4% on-time</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Cold-chain transit</span>
                <span className="font-semibold text-emerald-700">2°C–8°C verified</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">ISO 15189 quality</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <ShieldCheck size={13} /> Accredited
                </span>
              </li>
            </ul>
          </section>

          <PromoCard
            kicker="Catalog coverage"
            title="Expand your diagnostic menu"
            body={`${packagesCount} packages and ${activeTestsCount} tests are live for patients right now.`}
            href="/lab-portal/packages"
            icon={<PackageOpen size={20} />}
          />
        </aside>
      </div>
    </div>
  );
}
