import React from "react";
import type { Classification } from "@healthcare/shared/vitals";
import { Pill } from "@/components/ui";

const CLASSIFICATION_TONE: Record<
  Classification,
  { tone: "success" | "warning" | "danger" | "info"; labelKey: string }
> = {
  normal:   { tone: "success", labelKey: "vitals.classification.normal" },
  elevated: { tone: "warning", labelKey: "vitals.classification.elevated" },
  high:     { tone: "danger",  labelKey: "vitals.classification.high" },
  low:      { tone: "info",    labelKey: "vitals.classification.low" },
  critical: { tone: "danger",  labelKey: "vitals.classification.critical" },
};

type Props = {
  classification: Classification;
  label?: string;
  size?: "sm" | "md";
};

/**
 * Small coloured pill that signals a reading's clinical band. Tone
 * mapping is shared with the wellness score and the doctor/hospital
 * portals so the colour always means the same thing.
 */
export function ClassificationBadge({ classification, label, size = "sm" }: Props) {
  const meta = CLASSIFICATION_TONE[classification] ?? CLASSIFICATION_TONE.normal;
  return <Pill label={label ?? meta.labelKey} tone={meta.tone} size={size} />;
}