"use client";

import Link from "next/link";
import { ChevronRight, FlaskConical, Clock, Tag, ListChecks } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useTestPackages } from "@/patient/hooks/diagnostic";

export default function TestPackagesPage() {
  const query = useTestPackages();
  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Diagnostics"
        title="Test packages"
        description="Bundled tests from accredited labs at one price. Pick a package, book a slot, get your report."
        action={
          <Link
            href="/patient/diagnostic-tests"
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            Individual tests <ChevronRight size={12} aria-hidden />
          </Link>
        }
      />

      <Card>
        <QueryBoundary
          query={query}
          loadingCount={3}
          emptyTitle="No packages available"
          emptyDescription="Check back soon — labs are adding new bundles weekly."
        >
          {(data) => {
            const list = data?.packages ?? [];
            return (
              <ul className="flex flex-col gap-3">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patient/diagnostic-tests/packages/${p.slug}`}
                      className="group flex items-start gap-4 rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4 transition-all hover:border-brand hover:bg-brand-soft"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
                        <FlaskConical size={20} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-text">
                          {p.name}
                        </h3>
                        {p.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-text-soft">
                            {p.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft">
                          <span className="inline-flex items-center gap-1">
                            <ListChecks size={11} aria-hidden />
                            {p.tests.length} test{p.tests.length === 1 ? "" : "s"}
                          </span>
                          {p.reportTimeHours ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} aria-hidden />
                              Report in {p.reportTimeHours}h
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-base font-extrabold text-text">
                          LKR {p.price.toLocaleString()}
                        </p>
                        {p.originalPrice && p.originalPrice > p.price ? (
                          <p className="text-[11px] text-text-muted line-through">
                            LKR {p.originalPrice.toLocaleString()}
                          </p>
                        ) : null}
                        <ChevronRight
                          size={14}
                          aria-hidden
                          className="text-text-muted group-hover:text-brand"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            );
          }}
        </QueryBoundary>
      </Card>
    </div>
  );
}
