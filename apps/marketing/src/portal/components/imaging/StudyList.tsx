"use client";

// Shared study-list renderer for the imaging hub, patient chart tab,
// and patient-portal imaging page. Two modes:
//
//   mode="landing"        → rows include a patient column so doctors
//                           can scan across their panel
//   mode="patientChart"   → compact rows, no patient column (the
//                           patient id is already in the URL)
//
// Drives its own data via the existing /imaging/studies endpoint so
// callers don't need to pass anything other than `patientId` + filters.

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ScanLine, ChevronRight } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

export type ImagingStudy = {
  studyInstanceUid: string;
  modalities: string[];
  bodyParts: string[];
  studyDate: string | null;
  seriesCount: number;
  instanceCount: number;
  uploadedAt: string;
  patient?: { id: string; name: string } | null;
};

export type StudyListMode = "landing" | "patientChart";

export type StudyListProps = {
  patientId: string;
  /** When set, scope overrides the per-call filter (e.g. fixed modality on a tab). */
  modality?: string;
  /** ISO date YYYY-MM-DD lower bound. */
  from?: string;
  /** ISO date YYYY-MM-DD upper bound. */
  to?: string;
  /** Free-text StudyInstanceUID query — server filters as a substring. */
  q?: string;
  mode: StudyListMode;
  /** Detail-link base; defaults to the doctor portal viewer. */
  detailHrefBase?: string;
  /** Card padding for the wrapping container. */
  emptyTitle?: string;
  className?: string;
};

export function StudyList({
  patientId,
  modality,
  from,
  to,
  q,
  mode,
  detailHrefBase = "/portal/imaging",
  emptyTitle,
  className,
}: StudyListProps) {
  const t = useT();
  const filters = { patientId, modality, from, to, q };
  const { data, isLoading } = useQuery({
    queryKey: qk.imagingStudies(filters),
    queryFn: () => {
      const search = new URLSearchParams();
      if (patientId) search.set("patientId", patientId);
      if (modality) search.set("modality", modality);
      if (from) search.set("from", from);
      if (to) search.set("to", to);
      if (q) search.set("q", q);
      return api<{ studies: ImagingStudy[] }>(
        `/imaging/studies?${search.toString()}`
      );
    },
    enabled: !!patientId,
  });

  const showPatientCol = mode === "landing";

  return (
    <Card padding={false} className={className ?? "rounded-2xl"}>
      {isLoading ? (
        <div className="p-4 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data?.studies?.length ? (
        <ul className="flex flex-col">
          {data.studies.map((s) => (
            <li key={s.studyInstanceUid}>
              <Link
                href={`${detailHrefBase}/${encodeURIComponent(s.studyInstanceUid)}`}
                className="group flex items-center gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <ScanLine size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate font-mono">
                    {s.studyInstanceUid}
                  </div>
                  {showPatientCol && s.patient?.name && (
                    <div className="text-xs text-text-soft truncate">
                      {s.patient.name}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.modalities.map((m) => (
                      <Pill key={m} tone="info">
                        {m}
                      </Pill>
                    ))}
                    {s.bodyParts.map((b) => (
                      <Pill key={b} tone="violet">
                        {b}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-text-muted tabular-nums">
                    {t("imaging.hub.seriesCount", {
                      series: s.seriesCount,
                      instances: s.instanceCount,
                    })}
                  </div>
                  {s.studyDate && (
                    <div className="text-[11px] text-text-muted">
                      {formatDate(
                        `${s.studyDate.slice(0, 4)}-${s.studyDate.slice(
                          4,
                          6
                        )}-${s.studyDate.slice(6, 8)}`
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title={emptyTitle ?? t("imaging.hub.empty")}
          className="py-12"
        />
      )}
    </Card>
  );
}