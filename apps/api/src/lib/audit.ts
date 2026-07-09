// @ts-nocheck
import { auditLogs } from "@healthcare/db";
import { logger } from "./logger";

export type AuditInput = {
  userId?: string | null;
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