"use client";

import Link from "next/link";
import {
  ChevronRight,
  Clock3,
  FlaskConical,
  ListChecks,
  Package,
  Wallet,
} from "lucide-react";

import { useTestPackages } from "@/patient/hooks/diagnostic";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  StatTile,
} from "@/patient/components/workspace";

export default function TestPackagesPage() {
  const query = useTestPackages();
  const list = query.data?.packages ?? [];

  const totalTests = list.reduce((acc, p) => acc + p.tests.length, 0);
  const minPrice = list.length ? Math.min(...list.map((p) => p.price)) : null;
  const fastest = list.length
    ? Math.min(...list.map((p) => p.reportTimeHours ?? Infinity))
    : null;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<Package size={13} aria-hidden />}
          kicker="Lab tests"
          kickerMeta="Bundled packages"
          title={
            <>
              Health check <HeroAccent>packages</HeroAccent>
            </>
          }
          description="Bundled tests from accredited labs at one price. Pick a package, book a slot, get your report."
          chips={
            <>
              <span className={HERO_CHIP}>
                <ListChecks size={12} className="text-sky-300" aria-hidden />
                {list.length} package{list.length === 1 ? "" : "s"}
              </span>
              <span className={HERO_CHIP}>
                <Wallet size={12} className="text-emerald-300" aria-hidden />
                One bundled price
              </span>
            </>
          }
          actions={
            <Link href="/patient/diagnostic-tests" className={HERO_GHOST}>
              <FlaskConical size={15} aria-hidden />
              Individual tests
            </Link>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Packages"
            icon={<Package size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(list.length)}
            sub="Available to book"
          />
          <StatTile
            label="Tests bundled"
            icon={<ListChecks size={16} />}
            tone="bg-teal-50 text-teal-600"
            value={String(totalTests)}
            sub="Across all packages"
          />
          <StatTile
            label="Starting at"
            icon={<Wallet size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={minPrice != null ? `LKR ${minPrice.toLocaleString()}` : "—"}
            sub="Lowest package price"
          />
          <StatTile
            label="Fastest report"
            icon={<Clock3 size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={fastest != null && Number.isFinite(fastest) ? `${fastest}h` : "—"}
            sub="Turnaround time"
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="pk-list">
          <PanelHeader
            id="pk-list"
            icon={<Package size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Available packages"
            caption={query.isLoading ? "Loading…" : `${list.length} package${list.length === 1 ? "" : "s"} from partner labs`}
            href="/patient/diagnostic-tests"
            linkLabel="Individual tests"
          />

          {query.isLoading ? (
            <PanelSkeleton rows={4} />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : list.length === 0 ? (
            <EmptyBlock
              icon={<Package size={19} />}
              title="No packages available"
              body="Check back soon — labs are adding new bundles weekly."
              actions={
                <Link
                  href="/patient/diagnostic-tests"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  <FlaskConical size={13} aria-hidden />
                  Browse individual tests
                </Link>
              }
            />
          ) : (
            <div className="mt-5 space-y-2">
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/patient/diagnostic-tests/packages/${p.slug}`}
                  className="block"
                >
                  <RailRow
                    tone="sky"
                    icon={<FlaskConical size={17} />}
                    title={p.name}
                    meta={[
                      `${p.tests.length} test${p.tests.length === 1 ? "" : "s"}`,
                      p.reportTimeHours ? `Report in ${p.reportTimeHours}h` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={
                      <>
                        <span className="text-right">
                          <span className="block text-sm font-bold text-slate-900">
                            LKR {p.price.toLocaleString()}
                          </span>
                          {p.originalPrice && p.originalPrice > p.price ? (
                            <span className="block text-[11px] text-slate-400 line-through">
                              LKR {p.originalPrice.toLocaleString()}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight size={15} className="text-slate-300 transition-colors group-hover:text-sky-600" aria-hidden />
                      </>
                    }
                  >
                    {p.description ? (
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-slate-400">
                        {p.description}
                      </span>
                    ) : null}
                  </RailRow>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Package tools">
          <section className={PANEL} aria-labelledby="pk-why">
            <PanelHeader
              id="pk-why"
              icon={<ListChecks size={16} />}
              tone="bg-teal-50 text-teal-600"
              title="Why book a package"
              caption="One price, one visit"
            />
            <ul className="mt-4 flex flex-col gap-3">
              {[
                "Every test in the bundle processed by an accredited lab.",
                "A single home-collection visit covers the whole package.",
                "One consolidated report delivered to your records.",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-600">
                    <ChevronRight size={11} aria-hidden />
                  </span>
                  <span className="text-xs leading-relaxed text-slate-600">{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <QuickToolsPanel
            id="pk-tools"
            tools={[
              { href: "/patient/diagnostic-tests", label: "All tests", hint: "Browse singles", icon: FlaskConical, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/diagnostic-tests/bookings", label: "Bookings", hint: "Track orders", icon: Clock3, tone: "from-slate-600 to-slate-800 shadow-slate-500/30" },
            ]}
          />

          <PromoCard
            href="/patient/diagnostic-tests/bookings"
            kicker="Track bookings"
            icon={<Clock3 size={21} aria-hidden />}
            title="Already booked a test?"
            body="See collection status and download reports"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
