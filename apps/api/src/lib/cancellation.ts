/**
 * Cancellation policy + refund estimate.
 *
 * Rules (MVP):
 *   - Reschedule: always free — it's a slot swap, no refund math.
 *   - Cancel >= 24h before appointment: 100% refund.
 *   - Cancel 2–24h before: 50% refund (doctor keeps 50% as no-show protection).
 *   - Cancel < 2h before or no-show: 0% refund.
 *
 * Returns the estimate as `{ refundPct, refundLkr }`. Caller is responsible
 * for actually mutating the `payments` row (set status=refunded, write
 * refundedAmountLkr) and the `appointments` row (status=cancelled).
 */

export type RefundBucket = "full" | "half" | "none";

export interface CancellationEstimate {
  bucket: RefundBucket;
  refundPct: number; // 0–100
  refundLkr: number; // computed against `amountPaidLkr`
  rule: string;
}

/** Compute hours-to-appointment from date+time strings (YYYY-MM-DD, HH:MM). */
export function hoursUntil(
  dateStr: string,
  timeStr: string,
  now: Date = new Date()
): number {
  // YYYY-MM-DD + HH:MM → epoch ms. Treat as local time on the server.
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const appt = new Date(y, (mo || 1) - 1, d, h, mi || 0, 0, 0);
  const diffMs = appt.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function computeCancellationEstimate(
  dateStr: string,
  timeStr: string,
  amountPaidLkr: number,
  now: Date = new Date()
): CancellationEstimate {
  const hours = hoursUntil(dateStr, timeStr, now);
  if (hours >= 24) {
    return {
      bucket: "full",
      refundPct: 100,
      refundLkr: amountPaidLkr,
      rule: "Cancelled 24h+ before appointment — full refund.",
    };
  }
  if (hours >= 2) {
    return {
      bucket: "half",
      refundPct: 50,
      refundLkr: Math.round(amountPaidLkr * 0.5 * 100) / 100,
      rule: "Cancelled 2–24h before appointment — 50% refund.",
    };
  }
  return {
    bucket: "none",
    refundPct: 0,
    refundLkr: 0,
    rule: "Cancelled under 2h before appointment — no refund.",
  };
}

/** Localized policy text. UI binds these keys to a translation file. */
export const POLICY_KEYS = {
  intro: "cancellationPolicy.intro",
  full: "cancellationPolicy.full",
  half: "cancellationPolicy.half",
  none: "cancellationPolicy.none",
  payNote: "cancellationPolicy.payNote",
  accept: "cancellationPolicy.accept",
  decline: "cancellationPolicy.decline",
  title: "cancellationPolicy.title",
} as const;