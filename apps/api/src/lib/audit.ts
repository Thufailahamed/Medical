// @ts-nocheck
import { auditLogs } from "@healthcare/db";
import { logger } from "./logger";

export type AuditInput = {
  userId?: string | null;
  // Caretaker Profiles: when a caretaker (or other actor) writes on
  // behalf of a principal, actorUserId records the human who actually
  // performed the action. userId stays the data subject so the
  // principal's audit log shows "your record was changed by actor X".
  actorUserId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, any> | null;
  ip?: string | null;
};

/**
 * Append-only audit log. Never throws.
 */
export async function audit(db: any, input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId || null,
      actorUserId: input.actorUserId || null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId || null,
      details: input.details ? JSON.stringify(input.details) : null,
      ip: input.ip || null,
    } as any);
  } catch (err) {
    logger.error("audit", "audit insert failed", {
      action: input.action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export { audit as writeAudit };