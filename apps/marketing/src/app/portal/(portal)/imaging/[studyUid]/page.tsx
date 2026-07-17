"use client";

// Full-page DICOM viewer for a single study. Renders the study header
// (modality + body part + date + instance count) at the top and the
// DicomViewer below, lazy-loaded so the cornerstone bundle only ships
// on this route.

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, ScanLine } from "lucide-react";
import dynamic from "next/dynamic";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import type { ImagingInstance } from "@/portal/components/imaging/DicomViewer";

const DicomViewer = dynamic(
  () =>
    import("@/portal/components/imaging/DicomViewer").then(
      (m) => m.DicomViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 flex items-center justify-center text-text-muted gap-2">
        <span className="text-xs">Loading viewer…</span>
      </div>
    ),
  }
);

type Series = {
  seriesInstanceUid: string;
  modality: string | null;
  bodyPart: string | null;
  instances: Array<{
    sopInstanceUid: string | null;
    fileId: string;
    fileName: string | null;
    fileSize: number | null;
    viewerUrl?: string;
  }>;
};

type Study = {
  studyInstanceUid: string;
  patientId: string;
  series: Series[];
};

export default function ImagingStudyPage({
  params,
}: {
  params: Promise<{ studyUid: string }>;
}) {
  const { studyUid } = use(params);
  const t = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ["imaging", "study", studyUid],
    queryFn: () => api<Study>(`/imaging/studies/${encodeURIComponent(studyUid)}`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card padding={false} className="rounded-2xl">
        <Empty
          title={t("imaging.error.notFound")}
          className="py-12"
        />
      </Card>
    );
  }

  // Flatten every series into a single instance list so the viewer can
  // carousel through them. Real clinical viewers group by series with a
  // sidebar — that's a Tier-2 polish item.
  const instances: ImagingInstance[] = data.series.flatMap((s) =>
    s.instances
      .filter((i) => !!i.viewerUrl)
      .map((i) => ({
        viewerUrl: i.viewerUrl!,
        fileName: i.fileName,
        modality: s.modality,
      }))
  );

  const totalInstances = instances.length;
  const modalities = Array.from(
    new Set(data.series.map((s) => s.modality).filter(Boolean) as string[])
  );
  const bodyParts = Array.from(
    new Set(data.series.map((s) => s.bodyPart).filter(Boolean) as string[])
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link
          href={`/portal/patients/${data.patientId}/records`}
          className="inline-flex items-center gap-1 hover:text-text transition-colors"
        >
          <ChevronLeft size={14} />
          {t("imaging.backToRecords")}
        </Link>
      </div>

      <PageHeader
        title={t("imaging.viewerTitle")}
        subtitle={t("imaging.studySummary", {
          count: totalInstances,
          series: data.series.length,
        })}
        icon={<ScanLine size={18} className="text-sky-600" />}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {modalities.map((m) => (
          <Pill key={m} tone="info">
            {t(`imaging.modality.${m}`, m)}
          </Pill>
        ))}
        {bodyParts.map((bp) => (
          <Pill key={bp} tone="violet">
            {bp}
          </Pill>
        ))}
        {totalInstances === 0 && (
          <Pill tone="warn">{t("imaging.noInstances")}</Pill>
        )}
      </div>

      {instances.length > 0 ? (
        <DicomViewer instances={instances} />
      ) : (
        <Card padding={false} className="rounded-2xl">
          <Empty
            title={t("imaging.noInstances")}
            className="py-12"
          />
        </Card>
      )}
    </div>
  );
}
