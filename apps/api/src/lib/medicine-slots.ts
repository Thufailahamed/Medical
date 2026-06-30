// apps/api/src/lib/medicine-slots.ts
// R1: shared slot computation for medicine dose scheduling.
// Extracted from the duplicated copies that lived in medicines.ts and
// doses.ts. Both used identical logic — now there's one place to evolve
// the frequency table or add SL-specific dosing windows.

/**
 * Map a medicine's `frequency` + optional `timing` to the local "HH:MM"
 * slots that should have a dose row for any given day.
 *
 * Output times are local wall-clock (Asia/Colombo for SL). Callers store
 * them via `new Date().setHours(hh, mm, 0, 0)` + `.toISOString()` so the
 * stored timestamp is UTC but represents the user's intended local time.
 *
 * "As needed" returns [] so callers skip auto-schedule for PRN meds.
 */
export function slotsForFrequency(
  freq: string | null,
  timing?: string | null
): string[] {
  const f = (freq || "").toLowerCase();
  if (f === "once daily") return ["09:00"];
  if (f === "twice daily") return ["09:00", "21:00"];
  if (f === "three times daily") return ["09:00", "15:00", "21:00"];
  if (f === "four times daily") return ["08:00", "13:00", "18:00", "22:00"];

  // PRN / unknown — caller decides whether to skip. Returning a sensible
  // default keeps the older behaviour of "no schedule" for these meds.
  if (f === "as needed") return [];

  const t = (timing || "").toLowerCase();
  if (t.includes("morning") || t.includes("breakfast") || t.includes("food") || t.includes("am")) {
    return ["09:00"];
  }
  if (t.includes("noon") || t.includes("afternoon") || t.includes("lunch")) {
    return ["13:00"];
  }
  if (t.includes("evening") || t.includes("dinner")) {
    return ["18:00"];
  }
  if (t.includes("night") || t.includes("bed") || t.includes("pm")) {
    return ["21:00"];
  }
  return ["09:00"];
}

/**
 * Whether a medicine is "as needed" (PRN) — caller should NOT auto-schedule.
 */
export function isAsNeeded(freq: string | null): boolean {
  return (freq || "").toLowerCase() === "as needed";
}
