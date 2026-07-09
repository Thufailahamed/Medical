// @ts-nocheck

import { Hono } from "hono";
import { and, eq, isNull, or, inArray } from "drizzle-orm";
import { users, patients, doctors, otpCodes, notifications } from "@healthcare/db";
import { getApprovalRequiredRoles } from "../lib/settings";
import {
  registerSchema,
  loginSchema,
  loginByNicSchema,
  loginByPhoneSchema,
  sendOtpSchema,
  verifyOtpSchema,
  tenantRegisterSchema,
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
import { encryptPii } from "../lib/pii-cipher";
import { normalizeSLPhone } from "../lib/phone";
import { createSmsProvider, formatOtpMessage } from "../lib/sms";
import { createEmailProvider, formatOtpEmail } from "../lib/email";
import { logger } from "../lib/logger";
import type { AppEnvironment } from "../types";

const auth = new Hono<AppEnvironment>();

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

// ─── MFA branch (Round 2 P0) ──────────────────────────────
// For doctors whose `doctors.mfa_enabled = 1`, return a 5-minute
// `mfaToken` instead of a full session JWT. The mobile app posts the
// mfaToken + TOTP/recovery to /mfa/challenge to mint the real session.
//
// Also fires for doctors with no enrollment yet — the response shape
// carries `mfaRequired: 'enroll'` so the mobile app routes them to
// /mfa-setup first.
//
// Returns null when MFA does not apply (non-doctor or not yet
// enrolled-but-also-not-required) so the caller can continue the
// normal login flow unchanged.
async function maybeIssueMfaToken(
  c: any,
  db: any,
  dbUser: any
): Promise<{ mfaRequired: "enroll" | "verify"; mfaToken: string; expiresAt: number } | null> {
  if (!dbUser || dbUser.role !== "doctor") return null;
  const [d] = await db
    .select({
      id: doctors.id,
      mfaEnabled: doctors.mfaEnabled,
      mfaSecretEnc: doctors.mfaSecretEnc,
    })
    .from(doctors)
    .where(eq(doctors.userId, dbUser.id))
    .limit(1);
  if (!d) return null;

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const ttlSeconds = 5 * 60;
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const mfaToken = await generateToken(dbUser.id, jwtSecret, {
    purpose: "mfa",
    role: "doctor",
    doctorId: d.id,
    exp: expiresAt,
  });

  if (!d.mfaEnabled || !d.mfaSecretEnc) {
    return { mfaRequired: "enroll", mfaToken, expiresAt };
  }
  return { mfaRequired: "verify", mfaToken, expiresAt };
}

// Phase ADM-2: approval gating now reads runtime settings
// (`registration.requireApproval`, `registration.approvalRoles`).
// See lib/settings.ts. Defaults preserve the original hard-coded
// behaviour so a missing/empty settings table is safe.

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
  const approvalRoles = await getApprovalRequiredRoles(db);
  const requiresApproval = approvalRoles.includes(role);
  try {
    // P1 bundle 3: PII columns get a cipher copy on insert. Plaintext
    // stays populated for the legacy login paths (login-by-phone,
    // login-by-email) until a sweep migrates them. Failures here would
    // block registration — encryption is best-effort so a transient
    // crypto error doesn't lock users out.
    const emailPiiValue = await encryptPii(c.env, email || null).catch(() => null);
    const phonePiiValue = await encryptPii(c.env, phone || null).catch(() => null);
    const nicPiiValue = await encryptPii(c.env, nic ? normalizeNic(nic) : null).catch(() => null);
    const [u] = await db
      .insert(users)
      .values({
        supabaseId: crypto.randomUUID(),
        email: email || null,
        phone: phone || null,
        emailPii: emailPiiValue,
        phonePii: phonePiiValue,
        name,
        role,
        nic: nic ? normalizeNic(nic) : null,
        nicPii: nicPiiValue,
        nicHash,
        dateOfBirth: dob || null,
        nicVerificationLevel: nicLevel === "none" ? null : nicLevel,
        passwordHash,
        // Phase ADM-1: gated roles start in 'pending'; everyone else stays
        // 'active' (the DB default).
        status: requiresApproval ? "pending" : "active",
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

  // Phase ADM-1: if the role needs approval, do NOT issue a JWT. Notify
  // every super_admin so they see the new application in their queue.
  if (requiresApproval) {
    try {
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "super_admin"), eq(users.status, "active")));
      if (admins.length > 0) {
        await db.insert(notifications).values(
          admins.map((a) => ({
            id: crypto.randomUUID(),
            userId: a.id,
            type: "account_pending_review",
            title: `New ${role.replace("_", " ")} application`,
            body: `${name} (${email || phone || "no contact"}) registered and is awaiting approval.`,
            data: JSON.stringify({ pendingUserId: dbUser.id, role }),
            read: 0,
          }))
        );
      }
    } catch (notifyErr: any) {
      // Notification failure must not block registration.
      logger.error("auth.register", "admin notification insert failed", {
        err: notifyErr?.message,
      });
    }
    return c.json({
      user: { id: dbUser.id, email: dbUser.email, phone: dbUser.phone, name: dbUser.name, role: dbUser.role, status: dbUser.status },
      requiresApproval: true,
      message: "Your account is pending administrator approval. You will be notified once reviewed.",
    }, 202);
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

  // Dev mode bypass for developer login
  if (c.env.DEV_MODE === "true" && email === "dev-doctor@healthhub.local") {
    const DEV_DOCTOR_USER_ID = "dev-doctor-user-001";
    const { hospitals, hospitalDoctors, clinics, clinicDoctors } = await import("@healthcare/db");

    // 1. Ensure user exists
    [dbUser] = await db.select().from(users).where(eq(users.id, DEV_DOCTOR_USER_ID)).limit(1);
    if (!dbUser) {
      [dbUser] = await db.insert(users).values({
        id: DEV_DOCTOR_USER_ID,
        supabaseId: DEV_DOCTOR_USER_ID,
        email: "dev-doctor@healthhub.local",
        name: "Dr. Dev",
        role: "doctor",
      }).returning();
    }

    // 2. Ensure doctor entry exists
    let [dbDoctor] = await db.select().from(doctors).where(eq(doctors.userId, DEV_DOCTOR_USER_ID)).limit(1);
    if (!dbDoctor) {
      [dbDoctor] = await db.insert(doctors).values({
        id: "dev-doctor-001",
        userId: DEV_DOCTOR_USER_ID,
        specialization: "General Practice",
        registrationNumber: "SLMC-12345",
        slmcRegistrationNo: "SLMC-12345",
        slmcVerifiedAt: new Date().toISOString(),
      }).returning();
    }

    // 3. Ensure hospital exists and link doctor
    let [dbHospital] = await db.select().from(hospitals).where(eq(hospitals.id, "dev-hospital-001")).limit(1);
    if (!dbHospital) {
      await db.insert(hospitals).values({
        id: "dev-hospital-001",
        userId: DEV_DOCTOR_USER_ID,
        name: "City General Hospital (Dev)",
        license: "LIC-DEV-001",
        address: "Colombo, Sri Lanka",
      });
    }

    let [dbHospitalDoctor] = await db.select().from(hospitalDoctors).where(and(eq(hospitalDoctors.hospitalId, "dev-hospital-001"), eq(hospitalDoctors.doctorId, "dev-doctor-001"))).limit(1);
    if (!dbHospitalDoctor) {
      await db.insert(hospitalDoctors).values({
        id: "dev-hdoc-001",
        hospitalId: "dev-hospital-001",
        doctorId: "dev-doctor-001",
        role: "admin",
        status: "active",
      });
    }

    // 4. Ensure clinic exists and link doctor
    let [dbClinic] = await db.select().from(clinics).where(eq(clinics.id, "dev-clinic-001")).limit(1);
    if (!dbClinic) {
      await db.insert(clinics).values({
        id: "dev-clinic-001",
        userId: DEV_DOCTOR_USER_ID,
        name: "Test clinic (Dev)",
        license: "LIC-CL-DEV-001",
        address: "Kandy, Sri Lanka",
      });
    }

    let [dbClinicDoctor] = await db.select().from(clinicDoctors).where(and(eq(clinicDoctors.clinicId, "dev-clinic-001"), eq(clinicDoctors.doctorId, "dev-doctor-001"))).limit(1);
    if (!dbClinicDoctor) {
      await db.insert(clinicDoctors).values({
        id: "dev-cdoc-001",
        clinicId: "dev-clinic-001",
        doctorId: "dev-doctor-001",
        role: "owner",
        ownershipPct: 100,
        status: "active",
      });
    }

    // Generate JWT token
    const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
    const token = await generateToken(dbUser.id, jwtSecret, {
      nic: null,
      dob: null,
      nicVerificationLevel: null,
      isMinor: false,
    });

    return c.json({
      user: dbUser,
      session: {
        access_token: token,
        refresh_token: "dummy-refresh-token",
      },
    });
  }

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

  // Phase ADM-1: refuse login for accounts that aren't active.
  // 403 keeps the credential check honest (200 wouldn't differentiate
  // wrong-password from suspended-account to a probing client).
  const userStatus = (dbUser as any).status ?? "active";
  if (userStatus !== "active") {
    const code =
      userStatus === "pending" ? "account_pending" :
      userStatus === "suspended" ? "account_suspended" :
      userStatus === "rejected" ? "account_rejected" :
      "account_inactive";
    return c.json(
      {
        error:
          userStatus === "pending" ? "Your account is pending administrator approval." :
          userStatus === "suspended" ? "Your account has been suspended. Contact support." :
          userStatus === "rejected" ? "Your application was rejected." :
          "Your account is not active.",
        code,
        status: userStatus,
        reason: (dbUser as any).rejectionReason || (dbUser as any).suspendedReason || null,
      },
      403
    );
  }

  // Generate JWT token
  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";

  // MFA branch (Round 2 P0): doctors with MFA enabled (or still pending
  // enrollment) get a short-lived mfaToken instead of a full session.
  const mfa = await maybeIssueMfaToken(c, db, dbUser);
  if (mfa) {
    return c.json({
      mfaRequired: mfa.mfaRequired,
      mfaToken: mfa.mfaToken,
      expiresAt: mfa.expiresAt,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
      },
    });
  }

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

  // Phase ADM-1: refuse for non-active accounts.
  const nicUserStatus = (dbUser as any).status ?? "active";
  if (nicUserStatus !== "active") {
    return c.json(
      {
        error:
          nicUserStatus === "pending" ? "Your account is pending administrator approval." :
          nicUserStatus === "suspended" ? "Your account has been suspended. Contact support." :
          nicUserStatus === "rejected" ? "Your application was rejected." :
          "Your account is not active.",
        code: nicUserStatus === "pending" ? "account_pending" :
              nicUserStatus === "suspended" ? "account_suspended" :
              nicUserStatus === "rejected" ? "account_rejected" :
              "account_inactive",
        status: nicUserStatus,
      },
      403
    );
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

  // MFA branch (Round 2 P0): doctors with MFA pending/enrolled
  // receive a short-lived mfaToken instead of a full session.
  const mfa = await maybeIssueMfaToken(c, db, dbUser);
  if (mfa) {
    return c.json({
      mfaRequired: mfa.mfaRequired,
      mfaToken: mfa.mfaToken,
      expiresAt: mfa.expiresAt,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
      },
      nextStep: "mfa",
    });
  }

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
    logger.error("auth.login-phone", "sms send failed", { err: smsResult.error });
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
      logger.error("auth.otp", "sms send failed", { err: smsResult.error });
    }
  } else {
    // Email channel — wire Resend/Cloudflare/SES via EMAIL_PROVIDER.
    const email = createEmailProvider(c.env);
    const { subject, text, html } = formatOtpEmail(code, purpose);
    const emailResult = await email.sendEmail({
      to: destination,
      subject,
      text,
      html,
    });
    if (!emailResult.success) {
      logger.error("auth.otp", "email send failed", { err: emailResult.error });
    }
    // Dev-only plaintext OTP logging. Logger still scrubs but we keep
    // the redaction-by-exclusion property: in prod this branch is dead.
    if (c.env.DEV_MODE === "true" || c.env.ENVIRONMENT === "development") {
      logger.info("auth.otp", "dev: otp issued", {
        channel,
        target: maskTarget(destination),
        purpose,
        expiresAt,
      });
    }
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

  // Phase ADM-1: same status gate as /auth/login. /login-by-phone hands
  // the caller a userId; the actual session token is minted here.
  const otpUserStatus = (dbUser as any).status ?? "active";
  if (otpUserStatus !== "active") {
    return c.json(
      {
        error:
          otpUserStatus === "pending" ? "Your account is pending administrator approval." :
          otpUserStatus === "suspended" ? "Your account has been suspended. Contact support." :
          otpUserStatus === "rejected" ? "Your application was rejected." :
          "Your account is not active.",
        code: otpUserStatus === "pending" ? "account_pending" :
              otpUserStatus === "suspended" ? "account_suspended" :
              otpUserStatus === "rejected" ? "account_rejected" :
              "account_inactive",
        status: otpUserStatus,
      },
      403
    );
  }

  const jwtSecret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";

  // MFA branch (Round 2 P0): doctors with MFA pending/enrolled get a
  // short-lived mfaToken instead of a full session JWT. The mobile app
  // posts the mfaToken + TOTP to /mfa/challenge to finish.
  const mfa = await maybeIssueMfaToken(c, db, dbUser);
  if (mfa) {
    return c.json({
      verified: true,
      channel,
      mfaRequired: mfa.mfaRequired,
      mfaToken: mfa.mfaToken,
      expiresAt: mfa.expiresAt,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
      },
    });
  }

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

// ─── HOS-0: Tenant self-registration (hospital or clinic) ───
// Public endpoint; creates:
//   - one user row with role=super_admin|admin (pending until approved)
//   - one row in `hospitals` or `clinics` linked to that user
// Super admins review via admin queue and approve → flip both
// users.status="active" + emit a notification so the applicant can sign in.
auth.post("/register-tenant", async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = tenantRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const d = parsed.data;

  // Reject duplicate email early (phone is optional in this flow).
  if (d.email) {
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, d.email))
      .limit(1);
    if (exists) {
      return c.json({ error: "This email is already registered" }, 409);
    }
  }

  const passwordHash = await hashPassword(d.password);

  // Pick a role that the RBAC middleware already accepts for the portal.
  // Hospital_admin maps directly; for clinics we reuse hospital_admin so
  // the same portal layout covers both until a clinic_admin role exists.
  const userRole = "hospital_admin";

  const [user] = await db
    .insert(users)
    .values({
      supabaseId: crypto.randomUUID(),
      email: d.email,
      phone: d.phone ?? null,
      name: d.ownerName,
      role: userRole,
      passwordHash,
      status: "pending",
    })
    .returning();

  // Specialty string list (JSON-encoded for the SQLite TEXT column).
  const specializationsJson = d.specializations?.length
    ? JSON.stringify(d.specializations)
    : null;

  if (d.tenantType === "hospital") {
    const { hospitals } = await import("@healthcare/db");
    await db.insert(hospitals).values({
      userId: user.id,
      name: d.facilityName,
      license: d.licenseNumber,
      address: d.address ?? null,
      phone: d.facilityPhone ?? d.phone ?? null,
      location: d.location ?? null,
      specializations: specializationsJson,
    });
  } else {
    const { clinics } = await import("@healthcare/db");
    await db.insert(clinics).values({
      userId: user.id,
      name: d.facilityName,
      license: d.licenseNumber,
      address: d.address ?? null,
      phone: d.facilityPhone ?? d.phone ?? null,
      location: d.location ?? null,
      specializations: specializationsJson,
    });
  }

  // Notify super admins so the queue picks it up.
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "super_admin"), eq(users.status, "active")));
    if (admins.length > 0) {
      await db.insert(notifications).values(
        admins.map((a) => ({
          id: crypto.randomUUID(),
          userId: a.id,
          type: "tenant_pending_review",
          title: `New ${d.tenantType} application`,
          body: `${d.facilityName} (${d.email}) registered by ${d.ownerName} and awaits approval.`,
          data: JSON.stringify({ pendingUserId: user.id, tenantType: d.tenantType, facilityName: d.facilityName }),
          read: 0,
        }))
      );
    }
  } catch (notifyErr: any) {
    logger.error("auth.register-tenant", "admin notify failed", {
      err: notifyErr?.message,
    });
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    tenantType: d.tenantType,
    requiresApproval: true,
    message: "Your facility registration is pending administrator approval.",
  }, 202);
});
