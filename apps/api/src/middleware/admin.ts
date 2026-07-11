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
  // Audience gate: reject mobile-issued tokens from hitting admin routes.
  // Auth middleware sets `aud` from the JWT claim (default "mobile" for
  // back-compat). A token with `aud !== "admin"` cannot reach admin
  // endpoints regardless of role.
  const aud = c.get("aud");
  if (aud && aud !== "admin") {
    return c.json(
      {
        error: "Admin endpoints require an admin-audience token",
        code: "audience_mismatch",
      },
      401
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
  // When the request is being made under an impersonation session, the
  // admin actor is still the same (the impersonation token is a separate
  // JWT — admin endpoints always require `aud: "admin"` and a real
  // super_admin subject). We surface `actorId` so the audit chain shows
  // the *real* operator separately from `userId` (the impersonated subject).
  const impersonatedBy = c.get("impersonatedBy");
  const userIdOverride = impersonatedBy ? c.get("userId") : actor?.id ?? null;
  await writeAudit(db, {
    userId: userIdOverride,
    action: `admin.${input.action}`,
    resource: input.resource,
    resourceId: input.resourceId ?? null,
    details: {
      ...(input.details ?? {}),
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
      actorId: actor?.id ?? null,
      ...(impersonatedBy
        ? { impersonated: c.get("userId"), impersonatedBy }
        : {}),
    },
    ip: c.get("clientIp") ?? null,
  });
}

// Phase ADM-2: gate operator-only routes. Accepts super_admin (cross-org)
// AND insurance/ambulance operators (must have operatorOrgId set).
// Unlike requireAdmin this does NOT require aud === "admin" — operator
// login already mints that, but a few emergency-call flows may carry a
// mobile token for a super_admin; we accept both.
export async function requireOperator(c: Context<AppEnvironment>, next: Next) {
  const dbUser = c.get("dbUser");
  if (!dbUser) return c.json({ error: "Unauthorized" }, 401);

  const role = dbUser.role as string;
  if (role === "super_admin") {
    // super_admin gets cross-org view; leave operatorOrgId as-is.
  } else if (role === "insurance" || role === "ambulance") {
    if ((dbUser as any).status && (dbUser as any).status !== "active") {
      return c.json(
        { error: "Operator account is not active", code: "operator_inactive" },
        403,
      );
    }
    if (!(dbUser as any).operatorOrgId) {
      return c.json(
        {
          error: "Operator account is not assigned to an organization. Contact platform ops.",
          code: "operator_no_org",
        },
        403,
      );
    }
  } else {
    return c.json(
      { error: "Operator portal is restricted to platform operators", code: "not_operator" },
      403,
    );
  }

  // Stamp actor + IP for downstream handlers.
  c.set("adminActor", dbUser);
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  c.set("clientIp", ip);
  await next();
}