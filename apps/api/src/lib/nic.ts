/**
 * Sri Lankan NIC structural parsing + DOB extraction.
 *
 * Why this exists
 * ---------------
 * The check-digit algorithm for SL NIC is **not publicly published by the
 * Department for Registration of Persons**. The most-cited formula online
 * (`weights [7,3,1,5,9,4,8,2,6,10] mod 11`) is provably wrong against the
 * canonical Wikipedia example `197419202757`. The two best open-source
 * libraries (vinodliyanage/sri-lanka-nic and dilith-lab/srilanka-nic-decoder)
 * therefore do not implement check-digit verification — they validate
 * structure + extract DOB.
 *
 * We follow the same approach:
 *   1. Structural validation (regex + year range + day-of-year bounds +
 *      female offset rule).
 *   2. Cross-check: the DOB encoded in the NIC must match the DOB the user
 *      supplies. This is the strongest cheap check — fabricating a valid
 *      NIC requires the attacker to know the victim's real DOB anyway.
 *
 * If DRP ever publishes the real check-digit algorithm, drop it into
 * `verifyCheckDigit` and call it from `isStructurallyValid` as a hard
 * gate (not a soft warning — the formula above is wrong, we don't want
 * any green-flagged values slipping through).
 */

export type NicFormat = "OLD" | "NEW";
export type NicGender = "M" | "F";

export interface ParsedNic {
  format: NicFormat;
  year: number;
  month: number;
  day: number;
  gender: NicGender;
  /** Serial digits — 3 chars for old format, 4 chars for new. */
  serial: string;
  /** Check character as it appears in the NIC — opaque, NOT validated. */
  checkChar: string;
}

/** Old format: 9 digits + V or X. New format: 12 digits. */
export const NIC_REGEX = /^(\d{9}[VvXx]|\d{12})$/;

const OLD_REGEX = /^\d{9}[VvXx]$/;
const NEW_REGEX = /^\d{12}$/;

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function dayOfYearToMonthDay(
  year: number,
  doy: number,
): { month: number; day: number } {
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (daysInYear(year) === 366) monthDays[1] = 29;
  let remaining = doy;
  for (let i = 0; i < 12; i++) {
    if (remaining <= monthDays[i]) return { month: i + 1, day: remaining };
    remaining -= monthDays[i];
  }
  throw new Error("day-of-year out of range");
}

/** Canonicalise: trim + uppercase. */
export function normalizeNic(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Parse a structurally valid NIC. Returns null for any structural
 * failure (regex mismatch, year out of range, day-of-year out of range).
 *
 * Old format: `YY DDD SSS C V` where:
 *   YY  = birth year (last 2 digits; old format was only ever issued
 *         for persons born before 2000, so year = 1900 + YY)
 *   DDD = day-of-year, +500 added for females (so 1..366 for M, 501..866 for F)
 *   SSS = serial (3 digits)
 *   C   = check char (digit; algorithm unpublished)
 *   V   = voter suffix (V = eligible, X = non-permanent)
 *
 * New format: `YYYY DDD SSSS C` where:
 *   YYYY = full birth year
 *   DDD  = day-of-year, same female offset rule
 *   SSSS = serial (4 digits)
 *   C    = check digit (algorithm unpublished)
 */
export function parseNic(raw: string): ParsedNic | null {
  const nic = normalizeNic(raw);
  if (!NIC_REGEX.test(nic)) return null;

  if (NEW_REGEX.test(nic)) {
    const year = +nic.slice(0, 4);
    let daysRaw = +nic.slice(4, 7);
    const serial = nic.slice(7, 11);
    const checkChar = nic.slice(11, 12);

    const max = daysInYear(year);
    const gender: NicGender = daysRaw > max ? "F" : "M";
    if (gender === "F") daysRaw -= 500;
    if (year < 1900 || year > 9999) return null;
    if (daysRaw < 1 || daysRaw > max) return null;

    const { month, day } = dayOfYearToMonthDay(year, daysRaw);
    return { format: "NEW", year, month, day, gender, serial, checkChar };
  }

  // OLD format
  const yy = +nic.slice(0, 2);
  let daysRaw = +nic.slice(2, 5);
  const serial = nic.slice(5, 8);
  const checkChar = nic.slice(8, 9);

  // Old format only issued for persons born before 2000.
  const year = 1900 + yy;
  const max = daysInYear(year);
  const gender: NicGender = daysRaw > max ? "F" : "M";
  if (gender === "F") daysRaw -= 500;
  if (daysRaw < 1 || daysRaw > max) return null;

  const { month, day } = dayOfYearToMonthDay(year, daysRaw);
  return { format: "OLD", year, month, day, gender, serial, checkChar };
}

/**
 * Structural validity: parses cleanly + year is in plausible range
 * (1900..currentYear-15). The 15-year floor stops minors from
 * registering without parental oversight.
 */
export function isStructurallyValid(raw: string): boolean {
  const p = parseNic(raw);
  if (!p) return false;
  const nowYear = new Date().getUTCFullYear();
  return p.year >= 1900 && p.year <= nowYear - 15;
}

/** Extract DOB encoded in the NIC as ISO YYYY-MM-DD. Returns null on parse failure. */
export function nicEncodedDob(raw: string): string | null {
  const p = parseNic(raw);
  if (!p) return null;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Cross-check: does the DOB encoded in the NIC match the supplied DOB
 * string (YYYY-MM-DD)? Used at register + login time to defeat
 * attacker-fabricated NICs.
 */
export function nicMatchesDob(raw: string, dob: string): boolean {
  const encoded = nicEncodedDob(raw);
  if (!encoded) return false;
  return encoded === dob.trim();
}

/**
 * Derive the verification level achieved for a (nic, dob) pair:
 *   - "format+dob" — both structurally valid AND DOB matches the
 *     NIC's encoded birthdate (strongest cheap check).
 *   - "format"     — structurally valid but DOB not provided or
 *     doesn't match (weaker; only catches typos + obvious fakes).
 *   - "none"       — unparseable. Caller should reject.
 */
export function nicVerificationLevel(
  nic: string | null | undefined,
  dob: string | null | undefined,
): "none" | "format" | "format+dob" {
  if (!nic || !isStructurallyValid(nic)) return "none";
  if (dob && nicMatchesDob(nic, dob)) return "format+dob";
  return "format";
}