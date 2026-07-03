// @ts-nocheck

import { and, eq, sql } from "drizzle-orm";
import { doctorRevenueEvents, doctors } from "@healthcare/db";

/**
 * Record a single billable event for a doctor. Idempotent: the unique
 * (doctor_id, source_kind, source_id) index swallows retries.
 *
 * Return-value contract — P4 audit fix:
 *   { ok: true,  amountLkr }               — inserted fresh
 *   { ok: true,  amountLkr, skipped: true } — already inserted (idempotent retry)
 *   { ok: false, amountLkr: 0, reason:
 *       "no_fee" | "no_doctor" | "db_error" } — caller's responsibility
 *
 * Routes that POST /visit-summary, PATCH /walk-ins/:id, etc. MUST
 * inspect `.ok` and emit a console.warn for skipped-or-error outcomes
 * so monitoring (Sentry) can surface lost-revenue events. The old
 * silent behaviour hid billing bugs from operators.
 */
export async function recordRevenueEvent(input: {
  db: any;
  doctorId: string;
  sourceKind: "appointment" | "walkin";
  sourceId: string;
  patientId?: string | null;
  occurredAt?: string;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  amountLkr?: number;
  reason?: "no_fee" | "no_doctor" | "db_error" | "already_counted";
}> {
  const { db, doctorId, sourceKind, sourceId, patientId } = input;

  const [doctor] = await db
    .select({ consultationFee: doctors.consultationFee })
    .from(doctors)
    .where(eq(doctors.id, doctorId))
    .limit(1);

  if (!doctor) {
    console.warn(
      `[revenue] recordRevenueEvent: doctor ${doctorId} not found, skipped.`
    );
    return { ok: false, amountLkr: 0, reason: "no_doctor" };
  }

  const amount = Number((doctor as any).consultationFee ?? 0);
  if (!amount || amount <= 0) {
    // The doctor hasn't set a fee yet. Still log so the dashboard
    // can surface this — operators can never tell from the
    // earnings page that fee=0 doctors are silently dropping.
    console.warn(
      `[revenue] doctor ${doctorId} has no consultationFee configured; event for ${sourceKind}:${sourceId} not recorded.`
    );
    return { ok: false, amountLkr: 0, reason: "no_fee" };
  }

  const occurredAt = input.occurredAt || new Date().toISOString();

  try {
    await db.insert(doctorRevenueEvents).values({
      doctorId,
      sourceKind,
      sourceId,
      patientId: patientId || null,
      amountLkr: amount,
      occurredAt,
    } as any);
    return { ok: true, amountLkr: amount };
  } catch (err: any) {
    // Unique-index violation = already counted. Treat as idempotent OK.
    const msg = String(err?.message || "");
    if (
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("constraint")
    ) {
      return { ok: true, skipped: true, amountLkr: amount, reason: "already_counted" };
    }
    console.error(
      `[revenue] recordRevenueEvent failed for ${sourceKind}:${sourceId}:`,
      err
    );
    return { ok: false, amountLkr: 0, reason: "db_error" };
  }
}