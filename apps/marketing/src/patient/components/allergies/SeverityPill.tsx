"use client";

import { Pill, type PillTone } from "@/patient/components/primitives/Pill";
import type { AllergyRow } from "@/patient/types/patient";

const TONE: Record<NonNullable<AllergyRow["severity"]>, PillTone> = {
  mild: "neutral",
  moderate: "info",
  severe: "warn",
  critical: "danger",
};

export function SeverityPill({ severity }: { severity: AllergyRow["severity"] }) {
  if (!severity) return null;
  return <Pill tone={TONE[severity]}>{severity}</Pill>;
}
