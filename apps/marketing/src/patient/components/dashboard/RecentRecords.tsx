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

import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { useRecords } from "@/patient/hooks";
import { formatDayLabel, formatRecordType } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  PANEL,
  PanelHeader,
  PrimaryLink,
  Segmented,
  SECONDARY_BTN,
} from "@/portal/components/doctor/Workspace";

function getRecordVisuals(type: string | null | undefined) {
  const key = (type ?? "").toLowerCase();
  if (key.includes("lab") || key.includes("test")) {
    return {
      icon: FlaskConical,
      iconContainer: "bg-sky-50 text-sky-600",
      badge: "bg-sky-50 text-sky-700",
    };
  }
  if (key.includes("prescription") || key.includes("medication")) {
    return {
      icon: PillIcon,
      iconContainer: "bg-emerald-50 text-emerald-600",
      badge: "bg-emerald-50 text-emerald-700",
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
      iconContainer: "bg-amber-50 text-amber-600",
      badge: "bg-amber-50 text-amber-700",
    };
  }
  if (key.includes("allerg")) {
    return {
      icon: Sparkles,
      iconContainer: "bg-rose-50 text-rose-600",
      badge: "bg-rose-50 text-rose-700",
    };
  }
  return {
    icon: FileText,
    iconContainer: "bg-slate-100 text-slate-500",
    badge: "bg-slate-100 text-slate-600",
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
    <section
      aria-labelledby="pt-records"
      className={cn(PANEL, "flex h-full flex-col justify-between", className)}
    >
      <div>
        <PanelHeader
          id="pt-records"
          icon={<FileText size={16} />}
          tone="bg-violet-50 text-violet-600"
          title="Recent records"
          caption="Latest from your medical file"
          href="/patient/records"
          linkLabel="See all"
          action={
            <Link href="/patient/records/new" className={cn(SECONDARY_BTN, "h-8 px-3")}>
              <Plus size={13} strokeWidth={2.5} className="text-sky-600" aria-hidden />
              Upload
            </Link>
          }
        />

        {/* ── Sub-component Filter Tabs ────────────────────────────────── */}
        <div className="mt-4">
          <Segmented
            ariaLabel="Record type filters"
            value={filter}
            onChange={(id) => setFilter(id)}
            options={FILTER_TABS.map((tab) => ({ value: tab.id as string, label: tab.label }))}
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
                <EmptyBlock
                  className="mt-3"
                  icon={<UploadCloud size={19} />}
                  title={`No ${filter === "all" ? "" : `${FILTER_TABS.find((t) => t.id === filter)?.label.toLowerCase() ?? filter} `}records found`}
                  body="Upload lab reports, prescriptions or visit notes to build your medical file."
                  actions={
                    <PrimaryLink href="/patient/records/new" icon={<Plus size={13} />}>
                      Add record
                    </PrimaryLink>
                  }
                />
              );
            }

            return (
              <ul className="mt-2 flex flex-col gap-2">
                {displayList.map((r) => {
                  const visuals = getRecordVisuals(r.recordType);
                  const Icon = visuals.icon;

                  return (
                    <li key={r.id} data-testid="record-row">
                      <Link
                        href={`/patient/records/${r.id}`}
                        className="group flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-px hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-transform group-hover:scale-105",
                              visuals.iconContainer,
                            )}
                            aria-hidden
                          >
                            <Icon size={15} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                              {r.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} aria-hidden />
                                {formatDayLabel(r.date)}
                              </span>
                              {r.diagnosis ? (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="truncate font-medium text-slate-500">
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
                            className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-sky-600"
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
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-500" aria-hidden />
          <span>Encrypted patient records</span>
        </span>
        <span>Showing latest 5</span>
      </div>
    </section>
  );
}
