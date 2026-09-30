"use client";

// Patient-portal viewer route. Mirrors the doctor-side route shape so
// the shared <DicomViewer /> component is used unchanged. RBAC for the
// study is enforced inside /imaging/studies/<studyUid> (which calls
// canAccessPatient against the resolved patient id).

import { use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Layers, ScanLine } from "lucide-react";

import { api } from "@/portal/lib/api";
import { useT } from "@/portal/i18n";
import {
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  PANEL,
  PanelSkeleton,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

const DicomViewer = dynamic(
  () =>
    import("@/portal/components/imaging/DicomViewer").then(
      (m) => m.DicomViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] w-full animate-pulse rounded-xl bg-slate-100" />
    ),
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

  const seriesCount = data?.series.length ?? 0;
  const modality = data?.series[0]?.modality;

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<ScanLine size={13} aria-hidden />}
        kicker="Imaging & scans"
        kickerMeta={modality ? `${modality} study` : "DICOM study"}
        title={t("imaging.viewerTitle")}
        description={
          <span className="font-mono text-xs">UID {decoded}</span>
        }
        chips={
          data ? (
            <>
              <span className={HERO_CHIP}>
                <Layers size={12} className="text-sky-300" aria-hidden />
                {seriesCount} series · {instances.length} slices
              </span>
            </>
          ) : undefined
        }
        actions={
          <Link href="/patient/imaging" className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            {t("imaging.backToRecords")}
          </Link>
        }
      />

      <section className={PANEL}>
        {isLoading ? (
          <PanelSkeleton rows={2} className="mt-0 [&>div]:h-56" />
        ) : !data ? (
          <EmptyBlock
            className="mt-0"
            icon={<ScanLine size={19} />}
            title={t("imaging.studyNotFound")}
            body="This study may have been removed, or the link is incomplete."
            actions={
              <Link
                href="/patient/imaging"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
              >
                <ChevronLeft size={13} aria-hidden />
                All imaging studies
              </Link>
            }
          />
        ) : (
          <DicomViewer instances={instances} />
        )}
      </section>
    </PatientPage>
  );
}
