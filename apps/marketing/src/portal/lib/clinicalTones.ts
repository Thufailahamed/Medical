// Shared status / severity → Pill tone mappings. One source of truth so
// every chart tab renders status badges the same way.

export type PillTone =
  | "neutral"
  | "brand"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "accent"
  | "violet";

/** Prescription status (medical_records.recordType === "prescription"). */
export function rxStatusToTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "signed":
    case "completed":
    case "dispensed":
      return "success";
    case "draft":
    case "pending":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Clinical note status. Notes mostly use signed / draft. */
export function noteStatusToTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "signed":
      return "success";
    case "draft":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Lab order status. */
export function labOrderStatusToTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "ordered":
      return "warn";
    case "accepted":
    case "sample_collected":
    case "collected":
    case "in_progress":
    case "processing":
      return "brand";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Lab order priority. */
export function labOrderPriorityToTone(priority?: string | null): PillTone {
  switch ((priority ?? "").toLowerCase()) {
    case "stat":
    case "urgent":
      return "danger";
    case "routine":
    case "normal":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Follow-up status. */
export function followUpStatusToTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "scheduled":
    case "pending":
    case "reminded":
      return "brand";
    case "completed":
      return "success";
    case "missed":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Visit status (appt or walk-in). */
export function visitStatusToTone(status?: string | null): PillTone {
  switch ((status ?? "").toLowerCase()) {
    case "scheduled":
    case "confirmed":
    case "in_progress":
    case "in_consultation":
      return "brand";
    case "waiting":
      return "warn";
    case "completed":
      return "success";
    case "cancelled":
    case "no_show":
      return "danger";
    default:
      return "neutral";
  }
}

/** Vital classification. */
export function vitalClassificationToTone(
  classification?: string | null
): PillTone {
  switch ((classification ?? "").toLowerCase()) {
    case "normal":
      return "success";
    case "abnormal":
    case "warning":
    case "high":
    case "low":
      return "warn";
    case "critical":
      return "danger";
    default:
      return "neutral";
  }
}

/** Allergy severity. */
export function allergySeverityToTone(severity?: string | null): PillTone {
  switch ((severity ?? "").toLowerCase()) {
    case "mild":
      return "warn";
    case "moderate":
      return "warn";
    case "severe":
    case "life_threatening":
      return "danger";
    default:
      return "neutral";
  }
}

/** Severity ranking for sorting allergies most-critical first. */
const SEVERITY_RANK: Record<string, number> = {
  life_threatening: 0,
  severe: 1,
  moderate: 2,
  mild: 3,
};
export function allergySeverityRank(severity?: string | null): number {
  return SEVERITY_RANK[(severity ?? "").toLowerCase()] ?? 4;
}

/** Vital-type → label (snake_case → "snake case"). */
export function vitalLabel(type?: string | null): string {
  return (type ?? "").replace(/_/g, " ");
}

/** Record-kind → label for the records-by-type section. */
export function recordKindLabel(kind?: string | null): string {
  return (kind ?? "").replace(/_/g, " ");
}
