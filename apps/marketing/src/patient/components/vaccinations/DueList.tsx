"use client";

import type { VaccinationSlot } from "@/patient/types/patient";

import { VaccinationList } from "./VaccinationList";

export function DueList({ rows }: { rows: VaccinationSlot[] }) {
  return <VaccinationList rows={rows} />;
}
