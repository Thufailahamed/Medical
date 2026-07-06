/**
 * Rx slot helpers — shared between the prescription composer and
 * the per-row preview in lists. Mirrors the mobile composer
 * (apps/mobile/src/app/(doctor)/prescription.tsx) so the web form
 * behaves identically:
 *   - 4-slot grid (morning / noon / evening / night) drives a derived
 *     frequency string
 *   - durationDays + ongoing controls compute the end-date preview
 *
 * The DB persists `frequency` as free text. We derive a human label
 * ("Twice daily", "QID" etc) at write time so the PDF + verify + list
 * rows all read the same shape.
 */

export const SLOTS = ["morning", "noon", "evening", "night"] as const;
export type Slot = (typeof SLOTS)[number];
export type Slots = Record<Slot, boolean>;

export function emptySlots(): Slots {
  return { morning: false, noon: false, evening: false, night: false };
}

/** Map a slot pattern to a frequency label. Returns null when no slot
 *  is selected — the form should treat this as "not yet filled". */
export function slotsToFrequency(s: Slots): string | null {
  const n =
    (s.morning ? 1 : 0) +
    (s.noon ? 1 : 0) +
    (s.evening ? 1 : 0) +
    (s.night ? 1 : 0);
  if (n === 0) return null;
  if (n === 1) return "Once daily";
  if (n === 2) return "Twice daily";
  if (n === 3) return "Three times daily";
  return "Four times daily";
}

/** Inverse — used by the template chip "apply" path and by the edit
 *  pre-fill. Tolerant to both the friendly labels (e.g. "Twice daily")
 *  and the short codes (BD, TDS, QID, OD) the DB may already carry. */
export function frequencyToSlots(freq?: string | null): Slots {
  const f = (freq || "").toLowerCase();
  if (!f) return emptySlots();
  if (f.includes("once") || f.includes("1") || f === "od")
    return { morning: true, noon: false, evening: false, night: false };
  if (f.includes("twice") || f.includes("2") || f === "bd")
    return { morning: true, noon: false, evening: true, night: false };
  if (f.includes("three") || f.includes("3") || f === "tds")
    return { morning: true, noon: true, evening: true, night: false };
  if (f.includes("four") || f.includes("4") || f === "qid")
    return { morning: true, noon: true, evening: true, night: true };
  return emptySlots();
}

/** Compute the end-date string (YYYY-MM-DD) from durationDays, or null
 *  if the prescription is ongoing. */
export function endDateFromDuration(
  startDate: string,
  days?: number | null,
  ongoing?: boolean
): string | null {
  if (ongoing) return null;
  if (!days || days <= 0) return null;
  const d = new Date(startDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Render an end-date preview label for the form. Returns null if
 *  there's no computed end-date (no duration / ongoing). */
export function endDateLabel(
  startDate: string,
  days?: number | null,
  ongoing?: boolean
): string | null {
  if (ongoing) return "Ongoing";
  const end = endDateFromDuration(startDate, days, ongoing);
  if (!end) return null;
  return end;
}
