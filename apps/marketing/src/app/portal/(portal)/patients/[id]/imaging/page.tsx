"use client";

// Patient chart → Imaging tab. Lists every DICOM study for this
// patient grouped by StudyInstanceUID. Reuses the shared <StudyList />
// in patientChart mode — no separate list rendering lives here so the
// doctor and patient portals never drift.

import { use } from "react";

import { StudyList } from "@/portal/components/imaging/StudyList";

export default function ImagingTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <StudyList
      patientId={id}
      mode="patientChart"
      detailHrefBase="/portal/imaging"
    />
  );
}