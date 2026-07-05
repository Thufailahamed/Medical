// @ts-nocheck

import { Hono } from "hono";
import { and, eq, isNull, or } from "drizzle-orm";
import { users, patients, doctors, otpCodes } from "@healthcare/db";
import {
  registerSchema,
  loginSchema,
  loginByNicSchema,
  loginByPhoneSchema,
  sendOtpSchema,
  verifyOtpSchema,
  normalizeNic,
  ageAtRegistration,
} from "../lib/validators";
import { authMiddleware } from "../middleware/auth";
import { flattenTranslated } from "../lib/validation-error";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  hashSecret,
  verifySecret,
  generateOtpCode,
  maskTarget,
} from "../lib/crypto";
import { nicVerificationLevel } from "../lib/nic";
import { normalizeSLPhone } from "../lib/phone";
import { createSmsProvider, formatOtpMessage } from "../lib/sms";
import type { AppEnvironment } from "../types";

const auth = new Hono<AppEnvironment>();

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

// ─── Register ────────────────────────────────────────────
auth.post("/register", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const { email, phone, name, role, password, nic, dob, doctorProfile, inviteToken } = parsed.data;

  // Phase 3.1 slice 3: invite tokens are only valid for hospital_staff
  // registrations. Reject early with a translated Zod message so we
  // don't create a user row with no downstream way to link to a hospital.
  if (inviteToken && role !== "hospital_staff") {
    return c.json(
      { error: "Invite tokens are only valid for hospital staff sign-ups" },
      400
    );
  }

  // Must have either email or phone
  if (!email && !phone) {
    return c.json({ error: "Email or phone required" }, 400);
  }

  // Check if user already exists in D1 database
  let existingUser = null;
  if (email) {
    [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  } else if (phone) {
    [existingUser] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  }

  if (existingUser) {
    return c.json({ error: "Email or phone number is already registered" }, 400);
  }

  // If NIC supplied (patient flow), check for prior binding
  if (nic) {
    const nicHash = await hashSecret(normalizeNic(nic));
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nicHash, nicHash))
      .limit(1);
    if (dup) {
      return c.json({ error: "This NIC is already registered" }, 409);
    }
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const nicHash = nic ? await hashSecret(normalizeNic(nic)) : null;
  const nicLevel = nicVerificationLevel(nic, dob);

  let dbUser: any = null;
  try {
    const [u] = await db
      .insert(users)
      .values({
        supabaseId: crypto.randomUUID(),
        email: email || null,
        phone: phone || null,
        name,
        role,
        nic: nic ? normalizeNic(nic) : null,
        nicHash,
        dateOfBirth: dob || null,
        nicVerificationLevel: nicLevel === "none" ? null : nicLevel,
        passwordHash,
      })
      .returning();

    if (role === "patient") {
      await db.insert(patients).values({ userId: u.id });
    } else if (role === "doctor") {
      if (!doctorProfile) {
        // Should be blocked by Zod refine, but guard anyway.
        throw new Error("Missing doctor profile");
      }
      await db.insert(doctors).values({
        userId: u.id,
        specialization: doctorProfile.specialization.trim(),
        registrationNumber: doctorProfile.registrationNumber?.trim() || null,
        hospitalId: doctorProfile.hospitalId || null,
      });
    }
    dbUser = u;
  } catch (err: any) {
    const msg = err?.message === "{}" || err?.message === "[object Object]" || !err?.message
      ? "Database insertion failed."
      : err.message;
    return c.json(
      { error: msg },
      500
    );
  }

  // Generate JWT token — surface plain NIC + DOB on the session so the
  // mobile app can scope data to a verified subject without a server
  // round-trip per request.
  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const registerAge = ageAtRegistration(dbUser.dateOfBirth);
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
    nicVerificationLevel: dbUser.nicVerificationLevel ?? null,
    isMinor: registerAge !== null && registerAge < 18,
  });

  // Phase 3.1 slice 3: consume the invite token inline so the new user
  // lands already linked to their hospital — no second "Accept" tap.
  let inviteConsume: { ok: boolean; error?: string; hospitalId?: string } = {
    ok: true,
  };
  if (inviteToken) {
    try {
      const { acceptStaffInvite } = await import("../lib/staff-invite-accept");
      const result = await acceptStaffInvite(db, inviteToken, dbUser.id);
      if (!result.ok) {
        inviteConsume = { ok: false, error: result.error };
      } else {
        inviteConsume = { ok: true, hospitalId: result.hospitalId };
      }
    } catch (err: any) {
      inviteConsume = { ok: false, error: err?.message || "Invite consume failed" };
    }
  }

  return c.json({
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
    // Phase 3.1 slice 3: surface invite-consume outcome to the client
    // so the register screen can show a "Linked to <hospital>" toast
    // (success) or "Could not link invite" warning (failure).
    inviteConsume,
  }, 201);
});

// ─── Login (email / phone + password) ────────────────────
auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const { email, phone, password } = parsed.data;
  const db = c.get("db");

  // Get user from D1 database
  let dbUser = null;
  if (email) {
    [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  } else if (phone) {
    [dbUser] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  }

  if (!dbUser) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Verify password hash
  let isPasswordValid = false;
  if (dbUser.passwordHash) {
    isPasswordValid = await verifyPassword(password, dbUser.passwordHash);
  }

  if (!isPasswordValid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Generate JWT token
  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const loginAge = ageAtRegistration(dbUser.dateOfBirth);
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
    nicVerificationLevel: dbUser.nicVerificationLevel ?? null,
    isMinor: loginAge !== null && loginAge < 18,
  });

  return c.json({
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
  });
});

// ─── Login by NIC + DOB (soft 2FA first factor) ─────────
// No password required — relies on the pair being hard to guess.
// On success returns a short-lived JWT scoped to this session only.
// Full session is granted after /auth/verify-otp succeeds.
auth.post("/login-by-nic", async (c) => {
  const body = await c.req.json();
  const parsed = loginByNicSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const { nic, dob } = parsed.data;
  const db = c.get("db");

  const nicHash = await hashSecret(normalizeNic(nic));
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.nicHash, nicHash))
    .limit(1);

  if (!dbUser) {
    // Identical response shape for unknown NIC + wrong DOB → no enumeration.
    return c.json({ error: "Invalid credentials" }, 401);
  }
  if (dbUser.dateOfBirth !== dob) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Refresh verification level on every login. Covers legacy rows where
  // the column was added later (0013 migration) and users whose stored
  // level was computed before the cross-check existed.
  const level = nicVerificationLevel(dbUser.nic, dbUser.dateOfBirth);
  if ((dbUser.nicVerificationLevel ?? null) !== (level === "none" ? null : level)) {
    await db
      .update(users)
      .set({ nicVerificationLevel: level === "none" ? null : level })
      .where(eq(users.id, dbUser.id));
    dbUser.nicVerificationLevel = level === "none" ? null : level;
  }

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const nicLoginAge = ageAtRegistration(dbUser.dateOfBirth);
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
    nicVerificationLevel: dbUser.nicVerificationLevel ?? null,
    isMinor: nicLoginAge !== null && nicLoginAge < 18,
    nicVerified: true,
  });

  return c.json({
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
    // Hint to the client that an OTP second factor is recommended.
    nextStep: "send_otp",
  });
});

// ─── Login by phone (OTP — primary login) ────────────────
// Phone-only passwordless login. Looks up user by phone,
// generates OTP, sends via SMS, returns userId for verify step.
auth.post("/login-by-phone", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginByPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const phone = parsed.data.phone; // Already normalized to +94XXXXXXXXX
  const db = c.get("db");

  const localPhone = "0" + phone.slice(3); // e.g. +94777313847 -> 0777313847
  const [dbUser] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.phone, phone),
        eq(users.phone, localPhone)
      )
    )
    .limit(1);

  if (!dbUser) {
    // Anti-enumeration: same shape as success but with a fake delay.
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const now = Date.now();

  // Rate limit + cooldown (same logic as /send-otp)
  const recentSends = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.target, phone),
        eq(otpCodes.channel, "mobile")
      )
    )
    .all();

  const last5min = recentSends.filter(
    (r) => now - new Date(r.createdAt).getTime() < 5 * 60 * 1000
  );
  if (last5min.length >= 5) {
    return c.json(
      { error: "Too many OTP requests. Try again in a few minutes.", retryAfterSec: 60 },
      429
    );
  }
  const mostRecent = recentSends
    .map((r) => new Date(r.createdAt).getTime())
    .sort((a, b) => b - a)[0];
  if (mostRecent && now - mostRecent < 30 * 1000) {
    return c.json(
      { error: "Please wait 30 seconds before requesting another OTP.", retryAfterSec: 30 },
      429
    );
  }

  // Pre-prune prior unconsumed OTPs
  const nowIso = new Date(now).toISOString();
  await db
    .update(otpCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(otpCodes.target, phone),
        eq(otpCodes.channel, "mobile"),
        isNull(otpCodes.consumedAt)
      )
    );

  const code = generateOtpCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    userId: dbUser.id,
    channel: "mobile",
    target: phone,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  // Send SMS via configured provider
  const sms = createSmsProvider(c.env);
  const message = formatOtpMessage(code);
  const smsResult = await sms.sendSms(phone, message);

  if (!smsResult.success) {
    console.error(`[login-by-phone] SMS send failed: ${smsResult.error}`);
  }

  const isDev = c.env.DEV_MODE === "true" || c.env.ENVIRONMENT === "development";

  return c.json({
    otpSent: true,
    userId: dbUser.id,
    channel: "mobile",
    target: maskTarget(phone),
    expiresAt,
    ...(isDev ? { devCode: code } : {}),
  });
});

// ─── Send OTP ────────────────────────────────────────────
// Resolves the destination (mobile or email) either from the request body
// or from the user's profile, mints a 6-digit code, stores its hash with
// 5-minute TTL, and logs the plain code for now (no SMS gateway wired).
//
// P4 audit fix: previously this endpoint had no rate limit and
// always inserted a fresh row. Two consequences:
//   (a) concurrent retry floods the otp_codes table with N unconsumed
//       rows — /verify-otp then picks the freshest, leaving N-1
//       still-valid codes floating around. Anyone who captured any
//       one of them can still verify until expiry.
//   (b) brute-force surface scales linearly with retries because the
//       per-row `attempts` cap is checked per row, not globally.
//
// Now:
//   - Rate limit: max 5 sends / 5 minutes per (target + channel).
//   - Cooldown: 30 seconds between consecutive sends on the same
//     (target + channel).
//   - Pre-prune: any previous unconsumed rows for the same
//     (target + channel) are expired on a new send so /verify-otp
//     only ever sees one live candidate.
auth.post("/send-otp", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const { userId, nic, channel, target, purpose } = parsed.data;
  const db = c.get("db");

  let dbUser: any = null;
  if (userId) {
    [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  } else if (nic) {
    const nicHash = await hashSecret(normalizeNic(nic));
    [dbUser] = await db.select().from(users).where(eq(users.nicHash, nicHash)).limit(1);
  }
  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  const destination = target || (channel === "mobile" ? dbUser.phone : dbUser.email);
  if (!destination) {
    return c.json({ error: `No ${channel} on file for this user` }, 400);
  }

  const now = Date.now();

  // Rate limit + cooldown. Count sends in the last 5 minutes for this
  // (target, channel); reject if over the ceiling. Also reject if the
  // most recent send on this (target, channel) was within the last
  // 30 seconds — prevents accidental double-tap from being a brute-force
  // amplifier.
  const recentSends = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.target, destination),
        eq(otpCodes.channel, channel)
      )
    )
    .all();

  const last5min = recentSends.filter(
    (r) => now - new Date(r.createdAt).getTime() < 5 * 60 * 1000
  );
  if (last5min.length >= 5) {
    return c.json(
      {
        error:
          "Too many OTP requests. Try again in a few minutes.",
        retryAfterSec: 60,
      },
      429
    );
  }
  const mostRecent = recentSends
    .map((r) => new Date(r.createdAt).getTime())
    .sort((a, b) => b - a)[0];
  if (mostRecent && now - mostRecent < 30 * 1000) {
    return c.json(
      {
        error: "Please wait 30 seconds before requesting another OTP.",
        retryAfterSec: 30,
      },
      429
    );
  }

  // Pre-prune prior unconsumed rows on this target/channel so
  // /verify-otp can only ever see the latest one we just inserted.
  const nowIso = new Date(now).toISOString();
  await db
    .update(otpCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(otpCodes.target, destination),
        eq(otpCodes.channel, channel),
        isNull(otpCodes.consumedAt)
      )
    );

  const code = generateOtpCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    userId: dbUser.id,
    channel,
    target: destination,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  // Send via configured SMS/email provider
  if (channel === "mobile") {
    const sms = createSmsProvider(c.env);
    const message = formatOtpMessage(code);
    const smsResult = await sms.sendSms(destination, message);
    if (!smsResult.success) {
      console.error(`[otp] SMS send failed: ${smsResult.error}`);
    }
  } else {
    // Email channel — no provider wired yet, log for dev.
    console.log(
      `[otp] channel=${channel} target=${maskTarget(destination)} purpose=${purpose} code=${code} expiresAt=${expiresAt}`,
    );
  }

  const isDev = c.env.DEV_MODE === "true" || c.env.ENVIRONMENT === "development";

  return c.json({
    sent: true,
    channel,
    target: maskTarget(destination),
    expiresAt,
    // Only include devCode in development — never in production.
    ...(isDev ? { devCode: code } : {}),
  });
});

// ─── Verify OTP ──────────────────────────────────────────
auth.post("/verify-otp", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const { userId, nic, channel, code } = parsed.data;
  const db = c.get("db");

  let dbUser: any = null;
  if (userId) {
    [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  } else if (nic) {
    const nicHash = await hashSecret(normalizeNic(nic));
    [dbUser] = await db.select().from(users).where(eq(users.nicHash, nicHash)).limit(1);
  }
  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Pick the freshest unconsumed OTP for this user+channel.
  const candidates = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, dbUser.id), eq(otpCodes.channel, channel)))
    .all();

  const now = Date.now();
  const live = candidates
    .filter((o) => !o.consumedAt && new Date(o.expiresAt).getTime() > now && o.attempts < OTP_MAX_ATTEMPTS)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (live.length === 0) {
    return c.json({ error: "No active OTP — request a new one" }, 400);
  }
  const otp = live[0];

  const ok = await verifySecret(code, otp.codeHash);
  if (!ok) {
    await db
      .update(otpCodes)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(otpCodes.id, otp.id));
    return c.json({ error: "Invalid OTP code" }, 401);
  }

  await db
    .update(otpCodes)
    .set({ consumedAt: new Date().toISOString() })
    .where(eq(otpCodes.id, otp.id));

  // P4 audit fix: also mark any sibling unconsumed rows as consumed
  // so a previously-captured code from a prior /send-otp is
  // immediately invalidated on a successful verify. Cheap — at
  // most 1 row after the rate-limit pruning was added in P4.
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(otpCodes.userId, dbUser.id),
        eq(otpCodes.channel, channel),
        isNull(otpCodes.consumedAt)
      )
    );

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const otpAge = ageAtRegistration(dbUser.dateOfBirth);
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
    isMinor: otpAge !== null && otpAge < 18,
    nicVerified: true,
    otpVerified: true,
  });

  return c.json({
    verified: true,
    channel,
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
  });
});

// ─── Get current user ────────────────────────────────────
auth.get("/me", authMiddleware, async (c) => {
  const dbUser = c.get("dbUser");
  return c.json({ user: dbUser });
});

// ─── Refresh token ───────────────────────────────────────
auth.post("/refresh", async (c) => {
  const { refresh_token } = await c.req.json().catch(() => ({}));

  if (!refresh_token) {
    return c.json({ error: "Refresh token required" }, 400);
  }

  return c.json({
    session: {
      access_token: "dummy-new-token",
      refresh_token: "dummy-refresh-token",
    },
  });
});

// ─── Logout ──────────────────────────────────────────────
auth.post("/logout", authMiddleware, async (c) => {
  return c.json({ message: "Logged out" });
});

// ─── Forgot password ─────────────────────────────────────
auth.post("/forgot-password", async (c) => {
  return c.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
});

// ─── Reset password ──────────────────────────────────────
auth.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const accessToken = body?.accessToken || body?.access_token;
  const newPassword = body?.newPassword || body?.password || "";

  if (!accessToken || !newPassword) {
    return c.json({ error: "accessToken and newPassword are required" }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  // Decode the access token (which acts as the reset token)
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const decoded = await verifyToken(accessToken, secret);
  if (!decoded || !decoded.sub) {
    return c.json({ error: "Invalid or expired reset token" }, 401);
  }

  const db = c.get("db");
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, decoded.sub));

  return c.json({ message: "Password reset successfully" });
});

// ─── Change password (requires current password) ─────────
auth.post("/change-password", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const dbUser = c.get("dbUser");
  const body = await c.req.json().catch(() => ({}));
  const currentPassword = body?.currentPassword || "";
  const newPassword = body?.newPassword || "";

  if (!currentPassword || !newPassword) {
    return c.json({ error: "currentPassword and newPassword are required" }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }
  if (currentPassword === newPassword) {
    return c.json({ error: "New password must differ from the current one" }, 400);
  }

  // Verify current password hash
  const isPasswordValid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!isPasswordValid) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  const db = c.get("db");
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));

  return c.json({ message: "Password changed successfully" });
});

export default auth;
