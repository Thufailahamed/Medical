import type { ZodError } from "zod";
import { translate, type Locale } from "./locale";

/**
 * Maps a custom English Zod message string to its i18n key. Built-in Zod
 * messages (e.g. "Invalid email", "String must contain at least 8 character(s)")
 * are returned unchanged — they fall through to the fallback branch.
 */
const MESSAGE_KEYS: Record<string, string> = {
  "Specialization is required": "validation.specializationRequired",
  "Specialization is required for doctor accounts":
    "validation.specializationRequiredDoctor",
  "Invalid doctor id": "validation.invalidDoctorId",
  "Invalid hospital id": "validation.invalidHospitalId",
  "Date must be YYYY-MM-DD": "validation.invalidDateFormat",
  "Time must be HH:MM (24h)": "validation.invalidTimeFormat",
  "Reason must be under 500 chars": "validation.reasonTooLong",
};

/**
 * Translate one Zod issue message in-place. Returns the original English
 * string when no key matches — the mobile app already keys off the
 * raw string for the 7 custom messages we translate, so this is safe.
 */
export function translateIssueMessage(
  message: string,
  locale: Locale,
): string {
  const key = MESSAGE_KEYS[message];
  if (!key) return message;
  return translate(locale, key, message);
}

/**
 * Produce a translated `details` object matching the shape of
 * `ZodError#flatten()`. `formErrors` is `string[]`, `fieldErrors` is
 * `Record<string, string[]>` — both translated per message.
 */
export function flattenTranslated(
  error: ZodError,
  locale: Locale,
): { formErrors: string[]; fieldErrors: Record<string, string[]> } {
  const flat = error.flatten();
  return {
    formErrors: flat.formErrors.map((m) => translateIssueMessage(m, locale)),
    fieldErrors: Object.fromEntries(
      Object.entries(flat.fieldErrors).map(([k, v]) => [
        k,
        (v || []).map((m) => translateIssueMessage(m, locale)),
      ]),
    ),
  };
}