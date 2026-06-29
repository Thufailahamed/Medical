// @ts-nocheck

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users, patients, doctors } from "@healthcare/db";
import { registerSchema, loginSchema } from "../lib/validators";
import { authMiddleware } from "../middleware/auth";
import { hashPassword, verifyPassword, generateToken } from "../lib/crypto";
import type { AppEnvironment } from "../types";

const auth = new Hono<AppEnvironment>();

// ─── Register ────────────────────────────────────────────
auth.post("/register", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, phone, name, role, password, nic, doctorProfile } = parsed.data;

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

  // Hash password
  const passwordHash = await hashPassword(password);

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
        nic,
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

  // Generate JWT token
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const token = await generateToken(dbUser.id, secret);

  return c.json({
    user: dbUser,
    session: {
      access_token: token,
      refresh_token: "dummy-refresh-token",
    },
  }, 201);
});

// ─── Login ───────────────────────────────────────────────
auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
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
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const token = await generateToken(dbUser.id, secret);

  return c.json({
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
  const { refresh_token } = await c.req.json();

  if (!refresh_token) {
    return c.json({ error: "Refresh token required" }, 400);
  }

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token,
  });

  if (error) {
    return c.json({ error: "Invalid refresh token" }, 401);
  }

  return c.json({ session: data.session });
});

// ─── Logout ──────────────────────────────────────────────
auth.post("/logout", authMiddleware, async (c) => {
  return c.json({ message: "Logged out" });
});

// ─── Forgot password (always returns the same response) ──
// We don't reveal whether the email exists in our system.
auth.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body?.email || "").trim().toLowerCase();
  if (email) {
    try {
      const supabase = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_ANON_KEY
      );
      const redirectTo = body?.redirectTo || `${body?.origin || ""}/reset-password`;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || undefined,
      });
    } catch {
      // swallow — never leak whether the email exists
    }
  }
  return c.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
});

// ─── Reset password (uses short-lived access token from email link) ─
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

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY
  );

  // Bind the bearer so the updateUser call uses the recovery session
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: "",
  });
  if (sessionErr) {
    return c.json({ error: "Invalid or expired reset token" }, 401);
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) {
    return c.json({ error: updateErr.message }, 400);
  }

  // Sign out the recovery session so the caller must log in fresh
  await supabase.auth.signOut();

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

  const identifier = dbUser?.email || dbUser?.phone;
  if (!identifier) {
    return c.json({ error: "User has no email or phone on file" }, 400);
  }

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY
  );

  // Verify current password — we use the email form for phone-only users
  const loginEmail = identifier.includes("@") ? identifier : `${identifier}@phone.auth`;
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: currentPassword,
  });
  if (verifyErr) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) {
    return c.json({ error: updateErr.message }, 400);
  }

  void userId; // silence unused
  return c.json({ message: "Password changed successfully" });
});

export default auth;
