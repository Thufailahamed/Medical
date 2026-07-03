// @ts-nocheck

import { and, eq, sql } from "drizzle-orm";
import { doctorRevenueEvents, doctors } from "@healthcare/db";

/**
 * Record a single billable event for a doctor. Idempotent: the unique
 * (doctor_id, source_kind, source_id) index swallows retries.
 *
 * Returns the inserted event row, or null if the doctor doesn't exist /
 * has no fee configured.
 */
export async function recordRevenueEvent(input: {
  db: any;
  doctorId: string;
  sourceKind: "appointment" | "walkin";
  sourceId: string;
  patientId?: string | null;
  occurredAt?: string;
}): Promise<{ ok: boolean; skipped?: boolean; amountLkr?: number }> {
  const { db, doctorId, sourceKind, sourceId, patientId } = input;

  const [doctor] = await db
    .select({ consultationFee: doctors.consultationFee })
    .from(doctors)
    .where(eq(doctors.id, doctorId))
    .limit(1);

  if (!doctor) return { ok: false, skipped: true };

  const amount = Number((doctor as any).consultationFee ?? 0);
  if (!amount || amount <= 0) {
    return { ok: false, skipped: true, amountLkr: 0 };
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
      return { ok: true, skipped: true, amountLkr: amount };
    }
    console.error("recordRevenueEvent failed:", err);
    return { ok: false };
  }
}