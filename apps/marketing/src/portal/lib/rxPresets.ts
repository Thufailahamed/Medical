/**
 * Quick-add presets for the prescription composer.
 *
 * Mirrors apps/mobile/src/app/(doctor)/prescription.tsx so the web
 * composer behaves identically:
 *   - `PRESET_MEDS` is a short list of common generic names the doctor
 *     can tap to skip the autocomplete on a busy clinic day. The
 *     autocomplete itself (`MedicineAutocomplete`) still works for
 *     anything not in the list.
 *   - `COMMON_DOSAGES` is the pill row under the dosage input — tap
 *     one to fill `500mg` etc.
 *
 * Keep these in sync with the mobile app when the catalogue evolves.
 */

export const PRESET_MEDS: Array<{ genericName: string; strength?: string }> = [
  { genericName: "Amoxicillin", strength: "500mg" },
  { genericName: "Paracetamol", strength: "500mg" },
  { genericName: "Ibuprofen", strength: "400mg" },
  { genericName: "Metformin", strength: "500mg" },
  { genericName: "Amlodipine", strength: "5mg" },
  { genericName: "Atorvastatin", strength: "20mg" },
  { genericName: "Omeprazole", strength: "20mg" },
  { genericName: "Salbutamol", strength: "100mcg" },
];

export const COMMON_DOSAGES = [
  "250mg",
  "500mg",
  "1g",
  "5mg",
  "10mg",
  "20mg",
];

export const TIMING_OPTIONS = [
  { value: "", label: "—" },
  { value: "before_food", label: "Before food" },
  { value: "after_food", label: "After food" },
  { value: "with_food", label: "With food" },
  { value: "bedtime", label: "At bedtime" },
] as const;
