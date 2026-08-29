"use client";

// Patient portal imaging hub. Lists the signed-in patient's own DICOM
// studies. The StudyInstanceUID-row links into the patient-side viewer
// at /portal/me/imaging/[studyUid].
//
// The list query is driven by /imaging/studies which performs the
// canAccessPatient RBAC check server-side; we never ask the client to
// pass a patientId since it could be spoofed.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { StudyList } from "@/portal/components/imaging/StudyList";
import { useT } from "@/portal/i18n";

interface PatientMe {
  patient: {
    id: string;
    fullName: string;
    bloodGroup: string | null;
    dateOfBirth: string | null;
  };
}

export default function PatientImagingPage() {
  const t = useT();
  const me = useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => api<PatientMe>("/patients/me"),
  });

  const patientId = me.data?.patient.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("imaging.patientHub.title")}
        subtitle={t("imaging.patientHub.subtitle")}
      />

      {me.isLoading ? (
        <Card padding={false} className="rounded-2xl">
          <div className="p-4 flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      ) : !patientId ? (
        <Card padding={false} className="rounded-2xl">
          <Empty title={t("imaging.hub.noPatient")} className="py-12" />
        </Card>
      ) : (
        <StudyList
          patientId={patientId}
          mode="patientChart"
          detailHrefBase="/portal/me/imaging"
          emptyTitle={t("imaging.patientHub.empty")}
        />
      )}
    </div>
  );
}