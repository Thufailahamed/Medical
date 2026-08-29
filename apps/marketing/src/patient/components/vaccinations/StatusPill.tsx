"use client";

import { Pill, type PillTone } from "@/patient/components/primitives/Pill";

export type VaccinationStatus = "administered" | "due" | "overdue" | "upcoming";

const TONE: Record<VaccinationStatus, PillTone> = {
  administered: "success",
  upcoming: "neutral",
  due: "warn",
  overdue: "danger",
};

export function StatusPill({ status }: { status: VaccinationStatus }) {
  return <Pill tone={TONE[status]}>{status}</Pill>;
}
