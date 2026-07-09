// @ts-nocheck
// ─── TOTP MFA routes for doctors (Round 2 P0) ─────────────────────
//
// Endpoints:
//   POST /mfa/status          → { enabled, enrolledAt }         (auth + doctor)
//   POST /mfa/setup           → { otpauthUrl, secret }          (auth + doctor)
//   POST /mfa/verify-setup    → { recoveryCodes }               (auth + doctor)
//   POST /mfa/disable         → { ok }                           (auth + doctor)
//
//   POST /mfa/challenge       → { token }                       (NO auth, uses mfaToken)
//
// Flow:
//   1. Doctor signs in. Auth route checks `doctors.mfa_enabled`. If
//      false AND row has no `mfaSecretEnc` yet, it returns
//      `{ mfaRequired: 'enroll', mfaToken }` — mobile routes to
//      /mfa-setup.
//   2. Doctor enrolls TOTP, verifies first token, gets recovery codes.
//   3. From then on, every login returns
//      `{ mfaRequired: 'verify', mfaToken }` and mobile routes to
//      /mfa-challenge. Successful challenge mints the session JWT.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { doctors, users } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { generateToken, verifyToken } from "../lib/crypto";
import {
  generateSecret,
  buildOtpAuthUrl,
  verifyToken as verifyTotp,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
} from "../lib/mfa";
import { audit } from "../lib/audit";
import { logger } from "../lib/logger";
import type { AppEnvironment } from "../types";

const mfaRouter = new Hono<AppEnvironment>();

async function loadDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d || null;
}

async function loadUser(db: any, userId: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u || null;
}

// ─── Status ───────────────────────────────────────────────────────
mfaRouter.post("/status", authMiddleware, requireRole("doctor"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const d = await loadDoctor(db, userId);
  if (!d) return c.json({ error: "Doctor profile not found" }, 404);
  return c.json({
    enabled: !!d.mfaEnabled,
    enrolledAt: d.mfaEnrolledAt || null,
    hasSecret: !!d.mfaSecretEnc,
  });
});

// ─── Setup (start enrollment) ─────────────────────────────────────
//
// Generates a fresh secret, encrypts it under MFA_SECRET_KEK, and
// persists. Returns the otpauth URL so the mobile app can render a
// QR code. Does NOT flip mfa_enabled — that only happens after the
// doctor verifies their first TOTP token.
mfaRouter.post("/setup", authMiddleware, requireRole("doctor"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const d = await loadDoctor(db, userId);
  if (!d) return c.json({ error: "Doctor profile not found" }, 404);

  if (d.mfaEnabled) {
    return c.json(
      { error: "MFA already enabled. Disable before re-enrolling." },
      400
    );
  }

  try {
    const secret = generateSecret();
    const enc = await encryptSecret(c.env, secret);
    const user = await loadUser(db, userId);
    const account = user?.email || `doctor-${d.id}`;
    const otpauthUrl = buildOtpAuthUrl(secret, account);

    await db
      .update(doctors)
      .set({
        mfaSecretEnc: enc,
        mfaEnabled: 0,
        mfaRecoveryCodesHash: null,
        mfaRecoveryUsedCodes: null,
        mfaEnrolledAt: null,
      })
      .where(eq(doctors.id, d.id));

    // Returned secret is plaintext only because the mobile app needs to
    // render the QR. It is NEVER logged and never returned again.
    return c.json({ otpauthUrl, secret });
  } catch (err) {
    logger.error("mfa.setup", "encrypt failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "MFA not configured" }, 503);
  }
});

// ─── Verify-setup ─────────────────────────────────────────────────
//
// Body: { token } — 6-digit TOTP from the doctor's authenticator.
// Verifies, flips mfa_enabled=1, mints recovery codes (hashed only),
// returns the plaintext codes ONCE for the doctor to save.
mfaRouter.post(
  "/verify-setup",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const token = String(body.token || "");
    if (!token) return c.json({ error: "token required" }, 400);

    const d = await loadDoctor(db, userId);
    if (!d) return c.json({ error: "Doctor profile not found" }, 404);
    if (!d.mfaSecretEnc) {
      return c.json({ error: "Setup not started. Call /mfa/setup first." }, 400);
    }
    if (d.mfaEnabled) {
      return c.json({ error: "MFA already enabled" }, 400);
    }

    let secret: string;
    try {
      secret = await decryptSecret(c.env, d.mfaSecretEnc);
    } catch (err) {
      logger.error("mfa.verify-setup", "decrypt failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "MFA misconfigured" }, 503);
    }

    if (!verifyTotp(secret, token)) {
      return c.json({ error: "Invalid token" }, 401);
    }

    const codes = generateRecoveryCodes();
    const hashCsv = await hashRecoveryCodes(c.env, codes);
    const enrolledAt = new Date().toISOString();

    await db
      .update(doctors)
      .set({
        mfaEnabled: 1,
        mfaRecoveryCodesHash: hashCsv,
        mfaRecoveryUsedCodes: null,
        mfaEnrolledAt: enrolledAt,
      })
      .where(eq(doctors.id, d.id));

    await audit({
      db,
      userId,
      action: "mfa.enabled",
      resource: "doctor",
      resourceId: d.id,
      details: { enrolledAt },
    });

    // Codes returned ONCE — never again. Mobile must display + persist.
    return c.json({
      enabled: true,
      enrolledAt,
      recoveryCodes: codes,
    });
  }
);

// ─── Disable ──────────────────────────────────────────────────────
//
// Body: { token? , recoveryCode? } — requires current TOTP or unused
// recovery. Wipes MFA state. Useful for lost device / switching apps.
mfaRouter.post(
  "/disable",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const token = body.token ? String(body.token) : null;
    const recoveryCode = body.recoveryCode
      ? String(body.recoveryCode)
      : null;
    if (!token && !recoveryCode) {
      return c.json({ error: "token or recoveryCode required" }, 400);
    }

    const d = await loadDoctor(db, userId);
    if (!d) return c.json({ error: "Doctor profile not found" }, 404);
    if (!d.mfaEnabled || !d.mfaSecretEnc) {
      return c.json({ error: "MFA not enabled" }, 400);
    }

    let ok = false;
    if (token) {
      const secret = await decryptSecret(c.env, d.mfaSecretEnc).catch(() => null);
      if (!secret) return c.json({ error: "MFA misconfigured" }, 503);
      ok = verifyTotp(secret, token);
    } else if (recoveryCode && d.mfaRecoveryCodesHash) {
      const usedCsv = await consumeRecoveryCode(
        c.env,
        recoveryCode,
        d.mfaRecoveryCodesHash,
        d.mfaRecoveryUsedCodes
      );
      if (usedCsv !== null) {
        // Burned a recovery code to disable — update used list first.
        await db
          .update(doctors)
          .set({ mfaRecoveryUsedCodes: usedCsv })
          .where(eq(doctors.id, d.id));
        ok = true;
      }
    }

    if (!ok) return c.json({ error: "Invalid code" }, 401);

    await db
      .update(doctors)
      .set({
        mfaSecretEnc: null,
        mfaEnabled: 0,
        mfaRecoveryCodesHash: null,
        mfaRecoveryUsedCodes: null,
        mfaEnrolledAt: null,
      })
      .where(eq(doctors.id, d.id));

    await audit({
      db,
      userId,
      action: "mfa.disabled",
      resource: "doctor",
      resourceId: d.id,
      details: { via: token ? "totp" : "recovery" },
    });

    return c.json({ ok: true });
  }
);

// ─── Challenge (no auth — uses mfaToken) ──────────────────────────
//
// Body: { mfaToken, code }. The mfaToken is a short-TTL JWT
// (purpose=mfa) signed at the login step. We verify it, check the
// TOTP/recovery code against the doctor's stored envelope, then mint
// a full session JWT and return it.
mfaRouter.post("/challenge", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const mfaToken = String(body.mfaToken || "");
  const code = String(body.code || "");
  if (!mfaToken || !code) {
    return c.json({ error: "mfaToken and code required" }, 400);
  }

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const decoded = await verifyToken(mfaToken, jwtSecret).catch(() => null);
  if (!decoded || decoded.purpose !== "mfa" || !decoded.sub) {
    return c.json({ error: "Invalid or expired mfa token" }, 401);
  }

  const db = c.get("db");
  const userId = decoded.sub as string;
  const d = await loadDoctor(db, userId);
  if (!d) return c.json({ error: "Doctor profile not found" }, 404);
  if (!d.mfaEnabled || !d.mfaSecretEnc) {
    return c.json({ error: "MFA not enabled" }, 400);
  }

  // Try TOTP first; on miss fall through to recovery.
  let accepted = false;
  let burnedRecoveryCsv: string | null = null;
  try {
    const secret = await decryptSecret(c.env, d.mfaSecretEnc);
    if (verifyTotp(secret, code)) accepted = true;
  } catch {
    // fall through
  }
  if (!accepted && d.mfaRecoveryCodesHash) {
    const usedCsv = await consumeRecoveryCode(
      c.env,
      code,
      d.mfaRecoveryCodesHash,
      d.mfaRecoveryUsedCodes
    );
    if (usedCsv !== null) {
      accepted = true;
      burnedRecoveryCsv = usedCsv;
    }
  }
  if (!accepted) return c.json({ error: "Invalid code" }, 401);

  if (burnedRecoveryCsv !== null) {
    await db
      .update(doctors)
      .set({ mfaRecoveryUsedCodes: burnedRecoveryCsv })
      .where(eq(doctors.id, d.id));
  }

  // Mint full session JWT. Same shape auth.ts uses post-MFA, with
  // doctor profile fields attached so doctor-only routes work.
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const token = await generateToken(userId, jwtSecret, {
    role: "doctor",
    mfaPassed: true,
    doctorId: d.id,
  });

  await audit({
    db,
    userId,
    action: "mfa.challenge.passed",
    resource: "doctor",
    resourceId: d.id,
    details: { via: burnedRecoveryCsv ? "recovery" : "totp" },
  });

  return c.json({
    token,
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      : null,
  });
});

export default mfaRouter;