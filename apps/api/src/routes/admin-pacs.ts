// @ts-nocheck
// Hospital-admin PACS API surface.
//
// All routes are mounted at /hospital-admin/pacs/* and gated by:
//   - tenantContextMiddleware (already global) → c.get("activeHospitalId")
//   - requireRole("hospital_admin")                → hospital_admin role
//
// Credentials are envelope-encrypted on write via `encryptPacsCredential`
// from `lib/pacs-credentials.ts`. They are NEVER returned in any read
// response body, never logged, and never written into the audit log's
// `details` field.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { hospitalPacsIntegrations } from "@healthcare/db";
import { audit } from "../lib/audit";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  encryptPacsCredential,
} from "../lib/pacs-credentials";
import {
  PacsClient,
  PacsAuthError,
  PacsTransientError,
} from "../lib/pacs-client";
import type { EncryptedPayloadRow } from "../lib/envelope-crypto";
import type { AppEnvironment } from "../types";

export const adminPacsRouter = new Hono<AppEnvironment>();

adminPacsRouter.use("*", authMiddleware, requireRole("hospital_admin"));

function requireActiveHospital(c: any): string | null {
  return c.get("activeHospitalId") ?? null;
}

/**
 * Public summary (no credentials).
 */
function toPublicSummary(row: any) {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    kekVersion: row.kekVersion,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncError: row.lastSyncError,
    consecutiveFailures: row.consecutiveFailures,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── List ───────────────────────────────────────────────────────
adminPacsRouter.get("/integrations", async (c) => {
  const db = c.get("db");
  const hospitalId = requireActiveHospital(c);
  if (!hospitalId) return c.json({ error: "no_active_tenant" }, 400);
  const rows = await db
    .select()
    .from(hospitalPacsIntegrations)
    .where(eq(hospitalPacsIntegrations.hospitalId, hospitalId));
  return c.json({ integrations: rows.map(toPublicSummary) });
});

// ─── Create ─────────────────────────────────────────────────────
adminPacsRouter.post("/integrations", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospitalId = requireActiveHospital(c);
  if (!hospitalId) return c.json({ error: "no_active_tenant" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const baseUrl = String(body.baseUrl ?? "").trim();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const syncIntervalMinutes = Number(body.syncIntervalMinutes ?? 60);

  if (!name) return c.json({ error: "name_required" }, 400);
  if (!baseUrl) return c.json({ error: "baseUrl_required" }, 400);
  if (!username) return c.json({ error: "username_required" }, 400);
  if (!password) return c.json({ error: "password_required" }, 400);
  if (
    !Number.isFinite(syncIntervalMinutes) ||
    syncIntervalMinutes < 5 ||
    syncIntervalMinutes > 24 * 60
  ) {
    return c.json({ error: "invalid_interval" }, 400);
  }
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return c.json({ error: "invalid_baseUrl" }, 400);
  }
  if (c.env.ENVIRONMENT === "production" && url.protocol !== "https:") {
    return c.json({ error: "https_required_in_production" }, 400);
  }

  const env = c.env as Record<string, unknown>;
  const [u, p] = await Promise.all([
    encryptPacsCredential(env, username),
    encryptPacsCredential(env, password),
  ]);

  const id = (crypto as any).randomUUID();
  await db.insert(hospitalPacsIntegrations).values({
    id,
    hospitalId,
    name,
    baseUrl,
    usernameEnc: u.row as EncryptedPayloadRow,
    passwordEnc: p.row as EncryptedPayloadRow,
    kekVersion: u.kekVersion,
    enabled: body.enabled === false ? false : true,
    syncIntervalMinutes,
  });

  await audit(db, {
    actorUserId: userId,
    action: "pacs_integration_created",
    resource: "hospital_pacs_integration",
    resourceId: id,
    details: { name, baseUrl, syncIntervalMinutes },
  });

  return c.json({ ok: true, id });
});

// ─── Update ─────────────────────────────────────────────────────
adminPacsRouter.put("/integrations/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospitalId = requireActiveHospital(c);
  if (!hospitalId) return c.json({ error: "no_active_tenant" }, 400);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const [existing] = await db
    .select()
    .from(hospitalPacsIntegrations)
    .where(eq(hospitalPacsIntegrations.id, id))
    .limit(1);
  if (!existing || existing.hospitalId !== hospitalId) {
    return c.json({ error: "not_found" }, 404);
  }

  const update: any = { updatedAt: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
    update.baseUrl = body.baseUrl.trim();
  }
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (Number.isFinite(body.syncIntervalMinutes)) {
    update.syncIntervalMinutes = Number(body.syncIntervalMinutes);
  }
  // Re-encrypt creds only if the user supplied a new one (empty = keep).
  if (typeof body.password === "string" && body.password.length > 0) {
    const p = await encryptPacsCredential(
      c.env as Record<string, unknown>,
      body.password
    );
    update.passwordEnc = p.row;
    update.kekVersion = p.kekVersion;
  }
  if (typeof body.username === "string" && body.username.length > 0) {
    const u = await encryptPacsCredential(
      c.env as Record<string, unknown>,
      body.username
    );
    update.usernameEnc = u.row;
    update.kekVersion = u.kekVersion;
  }

  await db
    .update(hospitalPacsIntegrations)
    .set(update)
    .where(eq(hospitalPacsIntegrations.id, id));
  await audit(db, {
    actorUserId: userId,
    action: "pacs_integration_updated",
    resource: "hospital_pacs_integration",
    resourceId: id,
    details: Object.keys(update).filter((k) => k !== "updatedAt"),
  });
  return c.json({ ok: true });
});

// ─── Soft delete (disable) ──────────────────────────────────────
adminPacsRouter.delete("/integrations/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospitalId = requireActiveHospital(c);
  if (!hospitalId) return c.json({ error: "no_active_tenant" }, 400);
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(hospitalPacsIntegrations)
    .where(eq(hospitalPacsIntegrations.id, id))
    .limit(1);
  if (!existing || existing.hospitalId !== hospitalId) {
    return c.json({ error: "not_found" }, 404);
  }
  await db
    .update(hospitalPacsIntegrations)
    .set({ enabled: false, updatedAt: new Date().toISOString() })
    .where(eq(hospitalPacsIntegrations.id, id));
  await audit(db, {
    actorUserId: userId,
    action: "pacs_integration_disabled",
    resource: "hospital_pacs_integration",
    resourceId: id,
  });
  return c.json({ ok: true });
});

// ─── Test connection ────────────────────────────────────────────
// Decrypts creds + makes a single QIDO-RS call with a sentinel
// PatientID. Empty result = PACS is reachable. 401/403 = bad creds.
adminPacsRouter.post("/integrations/:id/test-connection", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospitalId = requireActiveHospital(c);
  if (!hospitalId) return c.json({ error: "no_active_tenant" }, 400);
  const id = c.req.param("id");
  const [integ] = await db
    .select()
    .from(hospitalPacsIntegrations)
    .where(eq(hospitalPacsIntegrations.id, id))
    .limit(1);
  if (!integ || integ.hospitalId !== hospitalId) {
    return c.json({ error: "not_found" }, 404);
  }


  const env = c.env as Record<string, unknown>;
  // Lazy decrypt: only call once each.
  const { decryptPacsCredential } = await import("../lib/pacs-credentials");
  let username: string;
  let password: string;
  try {
    username = await decryptPacsCredential(
      env,
      integ.usernameEnc as EncryptedPayloadRow
    );
    password = await decryptPacsCredential(
      env,
      integ.passwordEnc as EncryptedPayloadRow
    );
  } catch (err) {
    await audit(db, {
      actorUserId: userId,
      action: "pacs_connection_failed",
      resource: "hospital_pacs_integration",
      resourceId: id,
      details: { reason: "credential_unwrap_failed" },
    });
    return c.json({ ok: false, error: "credential_unwrap_failed" }, 502);
  }

  const t0 = Date.now();
  const client = new PacsClient(integ.baseUrl, { username, password });
  try {
    // Sentinel PatientID — empty list means the PACS is reachable and
    // accepted our creds. Any auth failure (401/403) throws immediately.
    await client.listStudies("__healthhub_ping__", { limit: 1 });
    const roundtripMs = Date.now() - t0;
    await audit(db, {
      actorUserId: userId,
      action: "pacs_connection_succeeded",
      resource: "hospital_pacs_integration",
      resourceId: id,
      details: { roundtripMs },
    });
    return c.json({ ok: true, roundtripMs });
  } catch (err) {
    require("fs").appendFileSync("/tmp/pacs-debug.log", `ERR: ${err instanceof Error ? err.constructor.name + ":" + err.message : String(err)}\n${err instanceof Error ? err.stack : ""}\n\n`);
    if (err instanceof PacsAuthError) {
      await audit(db, {
        actorUserId: userId,
        action: "pacs_connection_failed",
        resource: "hospital_pacs_integration",
        resourceId: id,
        details: { statusCode: err.statusCode, reason: "auth_failed" },
      });
      return c.json(
        { ok: false, error: "auth_failed", statusCode: err.statusCode },
        502
      );
    }
    const transient = err instanceof PacsTransientError;
    await audit(db, {
      actorUserId: userId,
      action: "pacs_connection_failed",
      resource: "hospital_pacs_integration",
      resourceId: id,
      details: {
        reason: transient ? "transient_failure" : "unknown",
        statusCode: transient ? err.statusCode : null,
      },
    });
    return c.json(
      { ok: false, error: transient ? "transient_failure" : "unknown" },
      502
    );
  }
});

export default adminPacsRouter;