"use client";

/**
 * /portal/prescriptions/[id] — global prescription detail page.
 *
 * Thin wrapper around `<RxDetail>` that wires the back-arrow to
 * `/portal/prescriptions`. The per-patient variant lives at
 * `/portal/patients/[id]/prescriptions/[rxId]` and points the back
 * arrow at the chart.
 */

import { use } from "react";

import { RxDetail } from "@/portal/components/rx/RxDetail";
import { useT } from "@/portal/i18n";

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  return (
    <RxDetail
      prescriptionId={id}
      backHref="/portal/prescriptions"
      backLabel={t("rx.detail.backToList")}
    />
  );
}
