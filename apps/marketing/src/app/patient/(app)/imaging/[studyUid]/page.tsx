"use client";

// Patient-portal viewer route. Mirrors the doctor-side route shape so
// the shared <DicomViewer /> component is used unchanged. RBAC for the
// study is enforced inside /imaging/studies/<studyUid> (which calls
// canAccessPatient against the resolved patient id).

import { use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";

const DicomViewer = dynamic(
  () =>
    import("@/portal/components/imaging/DicomViewer").then(
      (m) => m.DicomViewer
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[480px] w-full rounded-2xl" />,
  }
);

type StudyDetail = {
  studyInstanceUid: string;
  patientId: string;
  series: Array<{
    seriesInstanceUid: string;
    modality: string;
    bodyPart: string;
    instances: Array<{
      sopInstanceUid: string;
      fileId: string;
      fileName: string;
      fileSize: number;
      viewerUrl?: string;
    }>;
  }>;
};

export default function PatientImagingStudyPage({
  params,
}: {
  params: Promise<{ studyUid: string }>;
}) {
  const { studyUid } = use(params);
  const t = useT();
  const decoded = decodeURIComponent(studyUid);

  const { data, isLoading } = useQuery({
    queryKey: ["imaging", "study", "patient", decoded],
    queryFn: () =>
      api<StudyDetail>(`/imaging/studies/${encodeURIComponent(decoded)}`),
  });

  const instances = (data?.series ?? []).flatMap((s) =>
    s.instances.map((inst) => ({
      viewerUrl: inst.viewerUrl ?? `/files/download/${inst.fileId}`,
      fileName: inst.fileName ?? `${inst.sopInstanceUid}.dcm`,
      modality: s.modality,
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/portal/me/imaging"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-medium transition-colors"
        >
          <ArrowLeft size={12} /> {t("imaging.backToRecords")}
        </Link>
      </div>

      <PageHeader
        title={t("imaging.viewerTitle")}
        subtitle={decoded}
      />

      {isLoading ? (
        <Card padding={false} className="overflow-hidden rounded-2xl">
          <Skeleton className="h-[480px] w-full" />
        </Card>
      ) : !data ? (
        <Card padding={false} className="rounded-2xl">
          <Empty title={t("imaging.studyNotFound")} className="py-12" />
        </Card>
      ) : (
        <DicomViewer instances={instances} />
      )}
    </div>
  );
}