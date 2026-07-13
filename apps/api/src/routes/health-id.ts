// @ts-nocheck
// ─── QR-Code Check-in & Dispensing: Health ID router ───────────────
//
// Mounted at /me/health-id (patient endpoints) and /portal/scan
// (staff resolve endpoint). The patient-side issues rotating
// per-purpose tokens; the staff-side resolves a scanned token to a
// patient record + scopes, appending a portal_scan_events row.
//
// Token model:
//   - qr_access_tokens extended with purpose/scopes/rotation/...
//   - Single live row per (patient_id, purpose) — partial-unique
//     index qr_access_tokens_pat_purpose_idx WHERE revoked_at IS NULL.
//   - Issuing a fresh row in the same slot revokes the prior one in
//     the same write so a stolen old QR can never be scanned.
//   - Token = 32 random bytes encoded as base64url (43 chars),
//     used as the table PK; never logged, only resourceId-tail.
//
// Scan flow:
//   - Staff lands on /portal/scan?purpose=checkin|dispense|id
//   - Taps Start Camera → @zxing/browser decodes a code
//   - Portal POSTs /portal/scan/resolve { token }
//   - Server validates token + tenant scope + role + rate limit
//   - Server appends portal_scan_events row
//   - Returns ResolveScanResult; portal redirects to confirm page

import { Hono } from "hono";
import { and, eq, isNull, sql, lt } from "drizzle-orm";
import {
  qrAccessTokens,
  portalScanEvents,
  patients,
  users,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { resolvePatientContext } from "../lib/caretaker";
import { encryptEnvelope, decryptEnvelope } from "../lib/envelope-crypto";
import type { AppEnvironment } from "../types";

const healthIdRouter = new Hono<AppEnvironment>();
const scanRouter = new Hono<AppEnvironment>();

// ─── Constants ────────────────────────────────────────────

const ROTATION_SECONDS = 30;
const TOKEN_TTL_HOURS = 24;
const MAX_SCANS_PER_TOKEN = 50;
const ALLOWED_PURPOSES = ["checkin", "dispense", "id", "all"] as const;
const STAFF_SCAN_ROLES = [
  "doctor",
  "pharmacy",
  "hospital_admin",
  "hospital_staff",
  "super_admin",
];

// ─── Helpers ──────────────────────────────────────────────

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // base64url: replace +/= with -_ no padding
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function encryptJson(
  c: any,
  payload: unknown,
): Promise<string> {
  const env = await encryptEnvelope(c.env as Record<string, unknown>, payload);
  return JSON.stringify(env);
}

async function decryptJson(c: any, stored: string): Promise<unknown> {
  const env = JSON.parse(stored) as {
    encryptedPayload: string;
    encryptedPayloadDekWrapped: string;
    iv: string;
    authTag: string;
  };
  return decryptEnvelope(c.env as Record<string, unknown>, env);
}

function parseScans(s: string | null | undefined): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function getIp(c: any): string | null {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

// ─── Per-IP rate limiter (in-memory) ─────────────────────
//
const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = rateBucket.get(ip);
  if (!b || b.resetAt < now) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

// ─── Token issuance ──────────────────────────────────────

healthIdRouter.post(
  "/issue",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));

    // Caretaker-aware resolution: returns the principal's patient
    // row when the caller is a caretaker with an active link.
    const patient = await resolvePatientContext(c);
    if (!patient) {
      return c.json(
        { error: "no_patient_context", reason: "patient_not_found" },
        404,
      );
    }

    const purpose = String(body?.purpose ?? "all");
    if (!(ALLOWED_PURPOSES as readonly string[]).includes(purpose)) {
      return c.json(
        {
          error: "invalid_purpose",
          allowed: [...ALLOWED_PURPOSES],
        },
        400,
      );
    }

    const hospitalId = (c.get("activeHospitalId") as string | null) || null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_HOURS * 3600_000);

    // Revoke any existing live row for (patient, purpose). The
    // partial-unique index enforces at most one; revoking first
    // frees the slot so the INSERT doesn't collide. Audit each
    // superseded row so a leak of an old QR is traceable.
    const existing = await db
      .select()
      .from(qrAccessTokens)
      .where(
        and(
          eq(qrAccessTokens.patientId, (patient as any).id),
          eq(qrAccessTokens.purpose, purpose),
          isNull(qrAccessTokens.revokedAt),
        ),
      );
    for (const row of existing) {
      await db
        .update(qrAccessTokens)
        .set({ revokedAt: now.toISOString() } as any)
        .where(eq(qrAccessTokens.token, row.token));
      await audit(db, {
        userId,
        action: "health_id.superseded",
        resource: "qr_access_token",
        resourceId: row.token,
        details: { purpose, reason: "new_issue" },
      });
    }

    const token = randomToken(32);
    const scopes = "*"; // open-scope; tenant matching optional
    const payload = {
      patientId: (patient as any).id,
      purpose,
      scopes: [scopes],
      issuedAt: now.toISOString(),
    };
    const encryptedPayload = await encryptJson(c, payload);

    await db.insert(qrAccessTokens).values({
      token,
      patientId: (patient as any).id,
      familyMemberId: null,
      encryptedPayload,
      expiresAt: expiresAt.toISOString(),
      maxScans: MAX_SCANS_PER_TOKEN,
      scansJson: "[]",
      purpose,
      scopes,
      createdByUserId: userId,
      hospitalId,
      lastIssuedAt: now.toISOString(),
      rotationSeconds: ROTATION_SECONDS,
      createdAt: now.toISOString(),
    } as any);

    await audit(db, {
      userId,
      actorUserId: c.get("actorId") ?? null,
      action: "health_id.issued",
      resource: "qr_access_token",
      resourceId: token.slice(0, 6) + "…" + token.slice(-4),
      details: {
        purpose,
        patientId: (patient as any).id,
        rotationSeconds: ROTATION_SECONDS,
        ttlHours: TOKEN_TTL_HOURS,
      },
      ip: getIp(c),
    });

    return c.json(
      {
        token,
        purpose,
        rotationSeconds: ROTATION_SECONDS,
        expiresAt: expiresAt.toISOString(),
        scopes: [scopes],
      },
      201,
    );
  },
);

healthIdRouter.get(
  "/current",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const patient = await resolvePatientContext(c);
    if (!patient) {
      return c.json({ token: null, purpose: null }, 200);
    }
    const purposeQ = c.req.query("purpose") ?? "all";
    const [row] = await db
      .select()
      .from(qrAccessTokens)
      .where(
        and(
          eq(qrAccessTokens.patientId, (patient as any).id),
          eq(qrAccessTokens.purpose, purposeQ),
          isNull(qrAccessTokens.revokedAt),
        ),
      )
      .limit(1);
    if (!row) return c.json({ token: null, purpose: purposeQ }, 200);
    if (row.expiresAt <= new Date().toISOString()) {
      return c.json({ token: null, purpose: purposeQ }, 200);
    }
    return c.json({
      token: row.token,
      purpose: row.purpose,
      rotationSeconds: row.rotationSeconds ?? ROTATION_SECONDS,
      expiresAt: row.expiresAt,
      scopes: (row.scopes ?? "*").split(",").map((s) => s.trim()).filter(Boolean),
    });
  },
);

healthIdRouter.post(
  "/revoke",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const patient = await resolvePatientContext(c);
    if (!patient) {
      return c.json({ error: "no_patient_context" }, 404);
    }
    const body = await c.req.json().catch(() => ({}));
    const purpose = body?.purpose ? String(body.purpose) : null;

    const filters: any[] = [
      eq(qrAccessTokens.patientId, (patient as any).id),
      isNull(qrAccessTokens.revokedAt),
    ];
    if (purpose) filters.push(eq(qrAccessTokens.purpose, purpose));

    const rows = await db
      .select()
      .from(qrAccessTokens)
      .where(and(...filters));

    const now = new Date().toISOString();
    let count = 0;
    for (const row of rows) {
      await db
        .update(qrAccessTokens)
        .set({ revokedAt: now } as any)
        .where(eq(qrAccessTokens.token, row.token));
      count += 1;
      await audit(db, {
        userId,
        action: "health_id.revoked",
        resource: "qr_access_token",
        resourceId: row.token.slice(0, 6) + "…" + row.token.slice(-4),
        details: { purpose: row.purpose, explicit: true },
        ip: getIp(c),
      });
    }

    return c.json({ revoked: count });
  },
);

// ─── Staff scan resolve ───────────────────────────────────

scanRouter.post(
  "/resolve",
  authMiddleware,
  requireRole(...STAFF_SCAN_ROLES),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role ?? "unknown";

    const ip = getIp(c);
    if (ip && !rateLimitOk(ip)) {
      return c.json(
        { error: "rate_limited", reason: "too_many_scans" },
        429,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    if (!token) {
      return c.json({ error: "missing_token" }, 400);
    }
    const requestedPurpose = body?.purpose
      ? String(body.purpose)
      : null;

    const ua = c.req.header("user-agent") ?? null;
    const hospitalId = (c.get("activeHospitalId") as string | null) || null;

    // Helper to log + return the failure shape so we don't repeat
    // the audit/insert dance at every error path.
    async function fail(
      reason: string,
      status: number,
      extra: Record<string, any> = {},
    ) {
      // Best-effort audit; we may not have a patient row to point
      // at yet (token not found) so we skip the portal_scan_events
      // insert in that case.
      if (extra.patientId) {
        await db.insert(portalScanEvents).values({
          id: crypto.randomUUID(),
          token,
          patientId: extra.patientId,
          scannedByUserId: userId,
          portalRole: role,
          purpose: requestedPurpose ?? extra.tokenPurpose ?? "?",
          hospitalId,
          success: false,
          reason,
          ip,
          userAgent: ua,
          createdAt: new Date().toISOString(),
        } as any);
      }
      await audit(db, {
        userId,
        action: "health_id.scan_rejected",
        resource: "qr_access_token",
        resourceId: token.slice(0, 6) + "…" + token.slice(-4),
        details: { reason, requestedPurpose, role, hospitalId },
        ip,
      });
      return c.json({ error: reason, ...extra }, status);
    }

    const [row] = await db
      .select()
      .from(qrAccessTokens)
      .where(eq(qrAccessTokens.token, token))
      .limit(1);

    if (!row) {
      return await fail("not_found", 404);
    }
    if (row.revokedAt) {
      return await fail("revoked", 410, { patientId: row.patientId });
    }
    if (row.expiresAt <= new Date().toISOString()) {
      return await fail("expired", 410, {
        patientId: row.patientId,
        tokenPurpose: row.purpose,
      });
    }

    const scans = parseScans(row.scansJson);
    if (scans.length >= row.maxScans) {
      return await fail("max_scans_reached", 410, {
        patientId: row.patientId,
        tokenPurpose: row.purpose,
      });
    }

    // Purpose gate. 'all' or 'emergency' tokens resolve in any
    // scanner context (legacy compatibility + emergency scanner).
    // Any other token must match the scanner's requested purpose.
    if (
      requestedPurpose &&
      row.purpose !== "all" &&
      row.purpose !== "emergency" &&
      row.purpose !== requestedPurpose
    ) {
      return await fail("purpose_mismatch", 409, {
        patientId: row.patientId,
        tokenPurpose: row.purpose,
        requestedPurpose,
      });
    }

    // Tenant gate. Open-scope ("*") resolves in any tenant; otherwise
    // the row's hospitalId must match the active tenant.
    const scopes = (row.scopes ?? "*").split(",").map((s) => s.trim());
    const isOpenScope = scopes.length === 0 || scopes.includes("*");
    if (!isOpenScope && row.hospitalId && row.hospitalId !== hospitalId) {
      return await fail("tenant_mismatch", 403, {
        patientId: row.patientId,
        tokenPurpose: row.purpose,
        tokenHospitalId: row.hospitalId,
      });
    }

    // Decrypt envelope + hydrate patient + user.
    let bundle: any = null;
    try {
      bundle = await decryptJson(c, row.encryptedPayload);
    } catch (err) {
      return await fail("envelope_corrupt", 500, {
        patientId: row.patientId,
        tokenPurpose: row.purpose,
      });
    }

    const [patientRow] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, row.patientId))
      .limit(1);
    if (!patientRow) {
      return await fail("patient_not_found", 404);
    }
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, (patientRow as any).userId))
      .limit(1);

    // Append scan to the row (increment counter + audit trail).
    scans.push({ at: new Date().toISOString(), ip, userAgent: ua, role });
    await db
      .update(qrAccessTokens)
      .set({ scansJson: JSON.stringify(scans) } as any)
      .where(eq(qrAccessTokens.token, token));

    // portal_scan_events (success row).
    await db.insert(portalScanEvents).values({
      id: crypto.randomUUID(),
      token,
      patientId: row.patientId,
      scannedByUserId: userId,
      portalRole: role,
      purpose: row.purpose,
      hospitalId,
      success: true,
      reason: null,
      ip,
      userAgent: ua,
      createdAt: new Date().toISOString(),
    } as any);

    await audit(db, {
      userId,
      action: "health_id.scanned",
      resource: "qr_access_token",
      resourceId: token.slice(0, 6) + "…" + token.slice(-4),
      details: {
        patientId: row.patientId,
        purpose: row.purpose,
        hospitalId,
        remainingScans: row.maxScans - scans.length,
      },
      ip,
    });

    // Hydrate hospital name for the confirm card.
    let hospitalName: string | null = null;
    if (hospitalId) {
      const [h] = await db
        .select({ name: hospitals.name })
        .from(hospitals)
        .where(eq(hospitals.id, hospitalId))
        .limit(1);
      hospitalName = (h as any)?.name ?? null;
    }

    return c.json({
      patient: {
        id: row.patientId,
        name: userRow?.name ?? null,
        photo: (userRow as any)?.photo ?? null,
        nic: (userRow as any)?.nic ?? null,
        dob: (patientRow as any).dateOfBirth ?? null,
        bloodGroup: (patientRow as any).bloodGroup ?? null,
      },
      purpose: row.purpose,
      scopes,
      hospitalId,
      hospitalName,
      expiresAt: row.expiresAt,
      remainingScans: row.maxScans - scans.length,
    });
  },
);

export default healthIdRouter;
export { scanRouter };