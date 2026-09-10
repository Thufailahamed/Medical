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
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecords } from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function getRecordVisuals(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab") || key.includes("test")) {
    return {
      icon: FlaskConical,
      iconContainer: "bg-sky-50 text-sky-600 border-sky-200/70",
      badge: "bg-sky-50 text-sky-700 border-sky-200/70",
    };
  }
  if (key.includes("prescription") || key.includes("medication")) {
    return {
      icon: PillIcon,
      iconContainer: "bg-emerald-50 text-emerald-600 border-emerald-200/70",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    };
  }
  if (key.includes("imaging") || key.includes("scan")) {
    return {
      icon: ScanLine,
      iconContainer: "bg-violet-50 text-violet-600 border-violet-200/70",
      badge: "bg-violet-50 text-violet-700 border-violet-200/70",
    };
  }
  if (key.includes("vaccin")) {
    return {
      icon: Syringe,
      iconContainer: "bg-amber-50 text-amber-700 border-amber-200/70",
      badge: "bg-amber-50 text-amber-800 border-amber-200/70",
    };
  }
  if (key.includes("allerg")) {
    return {
      icon: Sparkles,
      iconContainer: "bg-rose-50 text-rose-600 border-rose-200/70",
      badge: "bg-rose-50 text-rose-700 border-rose-200/70",
    };
  }
  return {
    icon: FileText,
    iconContainer: "bg-blue-50 text-blue-600 border-blue-200/70",
    badge: "bg-blue-50 text-blue-700 border-blue-200/70",
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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-2xs"
              aria-hidden
            >
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Recent records
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                Latest from your medical file
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/patient/records/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 active:scale-[0.98] px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition-all"
            >
              <Plus size={12} strokeWidth={2.5} className="text-blue-600" />
              <span>Upload</span>
            </Link>
            <Link
              href="/patient/records"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
            >
              <span>See all</span>
              <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        </div>

        {/* ── Sub-component Filter Tabs ────────────────────────────────── */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-100">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all cursor-pointer border",
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200/60",
                )}
              >
                {tab.label}
              </button>
            );
          })}
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
                <div className="my-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <UploadCloud size={24} className="text-slate-400 mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700">
                    No {filter === "all" ? "" : filter} records found
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upload documents to populate this section.
                  </p>
                  <Link
                    href="/patient/records/new"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-semibold text-white shadow-2xs"
                  >
                    <Plus size={12} />
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
                        className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 transition-all hover:border-blue-300 hover:bg-blue-50/20 hover:shadow-2xs focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-lg border shadow-2xs transition-transform group-hover:scale-105",
                              visuals.iconContainer,
                            )}
                            aria-hidden
                          >
                            <Icon size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs md:text-[13px] font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                              {r.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={10} className="text-slate-400" />
                                {formatDayLabel(r.date)}
                              </span>
                              {r.diagnosis ? (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="truncate font-medium text-slate-600">
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
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-2xs",
                              visuals.badge,
                            )}
                          >
                            {formatRecordType(r.recordType)}
                          </span>
                          <ChevronRight
                            size={14}
                            className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600"
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
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Encrypted patient records</span>
        </span>
        <span className="text-[10px] text-slate-400">
          Showing up to 5 entries
        </span>
      </div>
    </Card>
  );
}
