/**
 * Sri Lanka phone number utilities.
 * Accepts local (07X) and international (+94) formats.
 * Normalises to E.164: +94XXXXXXXXX.
 */

const SL_MOBILE_PREFIXES = ['070','071','072','074','075','076','077','078','079'];

/** Normalise any SL phone format to E.164 (+94XXXXXXXXX). Returns null if invalid. */
export function normalizeSLPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, '');
  let num = digits;
  
  // +94XXXXXXXXX or 94XXXXXXXXX → strip country code
  if (num.startsWith('+94')) num = '0' + num.slice(3);
  else if (num.startsWith('94') && num.length === 11) num = '0' + num.slice(2);
  
  // Must be 10 digits starting with 0
  if (num.length !== 10 || !num.startsWith('0')) return null;
  
  // Check valid mobile prefix
  const prefix = num.slice(0, 3);
  if (!SL_MOBILE_PREFIXES.includes(prefix)) return null;
  
  return '+94' + num.slice(1);
}

/** Validate that a number is a valid SL mobile. */
export function isValidSLMobile(phone: string): boolean {
  return normalizeSLPhone(phone) !== null;
}
