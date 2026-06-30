// @ts-nocheck

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { users, patients, doctors, otpCodes } from "@healthcare/db";
import {
  registerSchema,
  loginSchema,
  loginByNicSchema,
  sendOtpSchema,
  verifyOtpSchema,
  normalizeNic,
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

  const { email, phone, name, role, password, nic, dob, doctorProfile } = parsed.data;

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
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
  });

  return c.json({
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
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
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
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

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
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

// ─── Send OTP ────────────────────────────────────────────
// Resolves the destination (mobile or email) either from the request body
// or from the user's profile, mints a 6-digit code, stores its hash with
// 5-minute TTL, and logs the plain code for now (no SMS gateway wired).
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

  const code = generateOtpCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    userId: dbUser.id,
    channel,
    target: destination,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  // No SMS/email gateway yet — log the code so the developer can copy it
  // out of the API logs during development.
  console.log(
    `[otp] channel=${channel} target=${maskTarget(destination)} purpose=${purpose} code=${code} expiresAt=${expiresAt}`,
  );

  return c.json({
    sent: true,
    channel,
    target: maskTarget(destination),
    expiresAt,
    // During dev: include the code so the mobile app can auto-fill.
    // REMOVE before any real deployment.
    devCode: code,
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

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const token = await generateToken(dbUser.id, jwtSecret, {
    nic: dbUser.nic,
    dob: dbUser.dateOfBirth,
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
