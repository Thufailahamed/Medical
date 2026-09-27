"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  FileText,
  FlaskConical,
  Pill as PillIcon,
  Plus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Syringe,
  UploadCloud,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecords } from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function getRecordVisuals(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab") || key.includes("test")) {
    return {
      icon: FlaskConical,
      iconContainer: "bg-brand-soft text-brand",
      badge: "bg-brand-soft text-brand",
    };
  }
  if (key.includes("prescription") || key.includes("medication")) {
    return {
      icon: PillIcon,
      iconContainer: "bg-success-soft text-success",
      badge: "bg-success-soft text-success",
    };
  }
  if (key.includes("imaging") || key.includes("scan")) {
    return {
      icon: ScanLine,
      iconContainer: "bg-violet-50 text-violet-600",
      badge: "bg-violet-50 text-violet-700",
    };
  }
  if (key.includes("vaccin")) {
    return {
      icon: Syringe,
      iconContainer: "bg-warn-soft text-warn",
      badge: "bg-warn-soft text-warn",
    };
  }
  if (key.includes("allerg")) {
    return {
      icon: Sparkles,
      iconContainer: "bg-danger-soft text-danger",
      badge: "bg-danger-soft text-danger",
    };
  }
  return {
    icon: FileText,
    iconContainer: "bg-surface-2 text-text-soft",
    badge: "bg-surface-2 text-text-soft",
  };
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "prescription", label: "Prescriptions" },
  { id: "lab", label: "Lab reports" },
  { id: "note", label: "Notes" },
] as const;

export function RecentRecords({ className }: { className?: string }) {
  const query = useRecords({ limit: 10 });
  const [filter, setFilter] = useState<string>("all");

  return (
    <Card
      accent="sky"
      className={cn("anim-rise flex h-full flex-col justify-between", className)}
    >
      <div>
        {/* ── Card Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs"
              aria-hidden
            >
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text tracking-tight">
                Recent records
              </h2>
              <p className="text-[11px] font-medium text-text-muted">
                Latest from your medical file
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/patient/records/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 active:scale-[0.98] px-2.5 py-1 text-xs font-semibold text-text shadow-2xs transition-all"
            >
              <Plus size={12} strokeWidth={2.5} className="text-brand" />
              <span>Upload</span>
            </Link>
            <Link
              href="/patient/records"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft transition-colors"
            >
              <span>See all</span>
              <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        </div>

        {/* ── Sub-component Filter Tabs ────────────────────────────────── */}
        <div className="mt-3.5">
          <SegmentedTabs
            ariaLabel="Record type filters"
            activeId={filter}
            onChange={(id) => setFilter(id)}
            tabs={FILTER_TABS.map((tab) => ({ id: tab.id, label: <>{tab.label}</> }))}
          />
        </div>

        {/* ── Records List ────────────────────────────────────────────── */}
        <QueryBoundary
          query={query}
          emptyTitle="No records yet"
          emptyDescription="Lab results, prescriptions and visit notes will appear here once uploaded."
          className="mt-3 flex flex-col gap-2"
        >
          {(data) => {
            const allRecords = data.records ?? [];
            const filtered =
              filter === "all"
                ? allRecords
                : allRecords.filter((r) =>
                    r.recordType?.toLowerCase().includes(filter),
                  );
            const displayList = filtered.slice(0, 5);

            if (displayList.length === 0) {
              return (
                <div className="my-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/50 p-6 text-center">
                  <UploadCloud size={24} className="text-text-muted mb-1.5" />
                  <p className="text-xs font-semibold text-text">
                    No {filter === "all" ? "" : filter} records found
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Upload documents to populate this section.
                  </p>
                    <Link
                      href="/patient/records/new"
                      className="pt-btn pt-btn-primary mt-3 h-8 px-3 text-xs"
                    >
                      <Plus size={12} aria-hidden />
                      Add record
                    </Link>
                </div>
              );
            }

            return (
              <ul className="mt-3 flex flex-col gap-2">
                {displayList.map((r) => {
                  const visuals = getRecordVisuals(r.recordType);
                  const Icon = visuals.icon;

                  return (
                    <li key={r.id} data-testid="record-row">
                      <Link
                        href={`/patient/records/${r.id}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 transition-all hover:border-border-strong hover:shadow-2xs focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-md shadow-2xs transition-transform group-hover:scale-105",
                              visuals.iconContainer,
                            )}
                            aria-hidden
                          >
                            <Icon size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs md:text-[13px] font-bold text-text transition-colors group-hover:text-brand">
                              {r.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-text-soft">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={10} className="text-text-muted" />
                                {formatDayLabel(r.date)}
                              </span>
                              {r.diagnosis ? (
                                <>
                                  <span className="text-border-strong">·</span>
                                  <span className="truncate font-medium text-text-soft">
                                    {r.diagnosis}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shadow-2xs",
                              visuals.badge,
                            )}
                          >
                            {formatRecordType(r.recordType)}
                          </span>
                          <ChevronRight
                            size={14}
                            className="text-border-strong transition-all group-hover:translate-x-0.5 group-hover:text-brand"
                            aria-hidden
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </QueryBoundary>
      </div>

      {/* ── Footer Status Strip ─────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-success" />
          <span>Encrypted patient records</span>
        </span>
        <span className="text-[10px] text-text-muted">
          Showing up to 5 entries
        </span>
      </div>
    </Card>
  );
}
