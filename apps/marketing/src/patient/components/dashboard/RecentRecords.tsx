"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
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
import { CardHeader } from "@/patient/components/primitives/CardHeader";
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
        <CardHeader
          title="Recent records"
          caption="Latest from your medical file"
          icon={<FileText size={16} aria-hidden />}
          href="/patient/records"
          linkLabel="See all"
          action={
            <Link
              href="/patient/records/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs font-semibold text-text transition-colors hover:bg-surface-3"
            >
              <Plus size={13} strokeWidth={2.5} className="text-brand" aria-hidden />
              Upload
            </Link>
          }
        />

        {/* ── Sub-component Filter Tabs ────────────────────────────────── */}
        <div className="mt-4">
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
                <div className="mt-3 flex flex-col items-center justify-center rounded-xl bg-surface-2 p-7 text-center">
                  <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-surface text-brand shadow-card">
                    <UploadCloud size={18} aria-hidden />
                  </span>
                  <p className="text-xs font-semibold text-text">
                    No {filter === "all" ? "" : filter} records found
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Upload documents to populate this section.
                  </p>
                    <Link
                      href="/patient/records/new"
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
                    >
                      <Plus size={12} aria-hidden />
                      Add record
                    </Link>
                </div>
              );
            }

            return (
              <ul className="mt-2 divide-y divide-border">
                {displayList.map((r) => {
                  const visuals = getRecordVisuals(r.recordType);
                  const Icon = visuals.icon;

                  return (
                    <li key={r.id} data-testid="record-row">
                      <Link
                        href={`/patient/records/${r.id}`}
                        className="group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-transform group-hover:scale-105",
                              visuals.iconContainer,
                            )}
                            aria-hidden
                          >
                            <Icon size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text transition-colors group-hover:text-brand">
                              {r.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
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
                              "hidden items-center rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline-flex",
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
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-success" />
          <span>Encrypted patient records</span>
        </span>
        <span>Showing latest 5</span>
      </div>
    </Card>
  );
}
