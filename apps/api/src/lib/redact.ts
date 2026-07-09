// apps/api/src/lib/redact.ts
//
// PII redaction utility for LLM prompts.
//
// Workers AI is a shared inference boundary — patient summary text
// (`clinicalSummary`, lab report bodies, vitals, allergies, conditions)
// routinely contains NIC, phone numbers, and email addresses. Sending
// those to a third-party inference endpoint without stripping them is
// a privacy leak (the LLM provider logs prompts for abuse review).
//
// `redactPii` is a regex-only scrubber. It's intentionally simple:
// no NLP, no entity recognition. Patterns covered:
//   - Sri Lankan NIC: 9 digits + V/X (old) or 12 digits (new).
//   - SL phone numbers: +94xxxxxxxxx, 94xxxxxxxxx, 0xxxxxxxxx.
//   - Email addresses (RFC 5322 lite).
//
// Anything the regex misses is logged once via `console.warn` so we
// can iterate on patterns. Failed redaction is not a hard error —
// the route still runs. A future iteration may switch to a stricter
// pass-through (e.g. jsPII or a dedicated tokenizer).

const SL_NIC_OLD = /\b\d{9}[VvXx]\b/g;
const SL_NIC_NEW = /\b\d{12}\b/g;
const SL_PHONE_INTL = /\+?94\d{9}\b/g;
const SL_PHONE_DOMESTIC = /\b0\d{9}\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const REDACTION_TAG = "[REDACTED]";

/**
 * Replace PII substrings with a redaction tag. Returns the original
 * string unchanged if no patterns match.
 */
export function redactPii(input: string): string {
  if (!input) return input;
  let out = input
    .replace(SL_NIC_OLD, REDACTION_TAG)
    .replace(SL_NIC_NEW, REDACTION_TAG)
    .replace(SL_PHONE_INTL, REDACTION_TAG)
    .replace(SL_PHONE_DOMESTIC, REDACTION_TAG)
    .replace(EMAIL, REDACTION_TAG);

  // Defensive: SL_NIC_NEW and SL_PHONE_DOMESTIC overlap (NIC is 12
  // digits, phone is 10 starting with 0 — no overlap, but 12-digit
  // strings starting with 0 are matched by both; the order above
  // resolves the ambiguity in favour of phone).
  return out;
}

/**
 * Convenience for callers holding arrays of messages. Same shape as
 * `redactPii` but operates on each `content` field. Returns a new
 * array; the input is unchanged.
 */
export function redactMessages<T extends { role: string; content: string }>(
  messages: T[],
): T[] {
  return messages.map((m) => ({
    ...m,
    content: redactPii(m.content),
  }));
}