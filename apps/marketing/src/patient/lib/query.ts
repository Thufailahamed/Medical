/**
 * Patient query keys and defaults.
 *
 * The definitions now live in `@healthcare/shared/contracts` so the Expo
 * app and this portal invalidate on identical keys. This module stays as
 * the web-side import site — every patient hook and test already imports
 * `@/patient/lib/query`, and keeping that specifier stable means the move
 * touches no call sites.
 */

export {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  rangeToFrom,
  type RangeKey,
} from "@healthcare/shared/contracts";
