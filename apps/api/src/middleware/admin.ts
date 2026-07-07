// @ts-nocheck
import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";
import { writeAudit } from "../lib/audit";

/**
 * Phase ADM-1: super_admin gate for every /admin/* route.
 * Stamps `c.set("adminActor", dbUser)` and a stable client IP.
 *
 * Use as a per-router prefix (adminRouter.use("*", requireAdmin)) so we
 * only pay one DB hit per request instead of one per inner route.
 */
export async function requireAdmin(c: Context<AppEnvironment>, next: Next) {
  const dbUser = c.get("dbUser");
  if (!dbUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (dbUser.role !== "super_admin") {
    return c.json(
      {
        error: "Admin portal is restricted to super administrators",
        code: "not_admin",
      },
      403
    );
  }
  if ((dbUser as any).status && (dbUser as any).status !== "active") {
    return c.json(
      {
        error: "Admin account is not active",
        code: "admin_inactive",
      },
      403
    );
  }
  c.set("adminActor", dbUser);

  // CF populates `cf-connecting-ip`; fall back to the raw socket IP.
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  c.set("clientIp", ip);

  await next();
}

/**
 * Convenience: append a structured audit row from inside an admin handler.
 * Captures the admin actor + IP. Never throws — see lib/audit.writeAudit.
 */
export async function recordAdminAction(
  c: Context<AppEnvironment>,
  input: {
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, any> | null;
  }
) {
  const db = c.get("db");
  const actor = c.get("adminActor");
  await writeAudit(db, {
    userId: actor?.id ?? null,
    action: `admin.${input.action}`,
    resource: input.resource,
    resourceId: input.resourceId ?? null,
    details: {
      ...(input.details ?? {}),
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
    },
    ip: c.get("clientIp") ?? null,
  });
}