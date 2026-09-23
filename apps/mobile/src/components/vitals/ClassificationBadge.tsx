import React from "react";
import { useTranslation } from "react-i18next";
import type { Classification } from "@healthcare/shared/vitals";
import { Pill } from "@/components/ui";

const CLASSIFICATION_TONE: Record<
  Classification,
  { tone: "success" | "warning" | "danger" | "info"; labelKey: string; defaultLabel: string }
> = {
  normal:   { tone: "success", labelKey: "vitals.classification.normal",   defaultLabel: "Normal" },
  elevated: { tone: "warning", labelKey: "vitals.classification.elevated", defaultLabel: "Elevated" },
  high:     { tone: "danger",  labelKey: "vitals.classification.high",     defaultLabel: "High" },
  low:      { tone: "info",    labelKey: "vitals.classification.low",      defaultLabel: "Low" },
  critical: { tone: "danger",  labelKey: "vitals.classification.critical", defaultLabel: "Critical" },
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
  const { t } = useTranslation();
  const meta = CLASSIFICATION_TONE[classification] ?? CLASSIFICATION_TONE.normal;
  const displayLabel = label ?? t(meta.labelKey, meta.defaultLabel);
  return <Pill label={displayLabel} tone={meta.tone} size={size} />;
}