"use client";

import {
  useRecordDischargeEvents,
  useRecordImagingFindings,
  useRecordLabResults,
  useRecordPrescriptionItems,
  useRecordVaccinationDoses,
} from "@/patient/hooks";

import { DischargeEventsList } from "./DischargeEventsList";
import { ImagingFindingsCard } from "./ImagingFindingsCard";
import { LabResultsTable } from "./LabResultsTable";
import { PrescriptionItemsList } from "./PrescriptionItemsList";
import { VaccinationDosesList } from "./VaccinationDosesList";

// Re-exported only so test files can mock them via vi.mock("@/patient/components/records/StructuredChildren").
export {
  useRecordLabResults,
  useRecordImagingFindings,
  useRecordDischargeEvents,
  useRecordVaccinationDoses,
  useRecordPrescriptionItems,
};

export function StructuredChildren({
  recordId,
  kind,
}: {
  recordId: string;
  kind: string;
}) {
  switch (kind) {
    case "lab_report":
      return <LabResultsTable recordId={recordId} />;
    case "imaging":
      return <ImagingFindingsCard recordId={recordId} />;
    case "discharge_summary":
      return <DischargeEventsList recordId={recordId} />;
    case "vaccination":
      return <VaccinationDosesList recordId={recordId} />;
    case "prescription":
      return <PrescriptionItemsList recordId={recordId} />;
    default:
      return null;
  }
}