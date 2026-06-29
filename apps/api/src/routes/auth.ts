// @ts-nocheck

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { users, patients, doctors } from "@healthcare/db";
import { registerSchema, loginSchema } from "../lib/validators";
import { authMiddleware } from "../middleware/auth";
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

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Create Supabase auth user
  const createPayload: any = {
    password,
    email_confirm: true,
    phone_confirm: true,
  };

  if (email) createPayload.email = email;
  if (phone) createPayload.phone = phone;

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser(createPayload);

  if (authError) {
    return c.json({ error: authError.message }, 400);
  }

  // Atomic: create the users row plus the role-specific profile row
  // in one transaction. If the profile insert fails the users row is
  // rolled back; we then clean up the Supabase auth user so we don't
  // leave an orphan account.
  let dbUser: any = null;
  try {
    const txResult = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          supabaseId: authUser.user.id,
          email: email || null,
          phone: phone || null,
          name,
          role,
          nic,
        })
        .returning();

      if (role === "patient") {
        await tx.insert(patients).values({ userId: u.id });
      } else if (role === "doctor") {
        if (!doctorProfile) {
          // Should be blocked by Zod refine, but guard anyway.
          throw new Error("Missing doctor profile");
        }
        await tx.insert(doctors).values({
          userId: u.id,
          specialization: doctorProfile.specialization.trim(),
          registrationNumber: doctorProfile.registrationNumber?.trim() || null,
          hospitalId: doctorProfile.hospitalId || null,
        });
      }
      return u;
    });
    dbUser = txResult;
  } catch (err: any) {
    // Best-effort cleanup of the Supabase auth record. Don't surface
    // cleanup errors to the caller — the real cause is the DB failure.
    try {
      await supabase.auth.admin.deleteUser(authUser.user.id);
    } catch {}
    return c.json(
      { error: err?.message || "Could not create account" },
      500
    );
  }

  // Sign in to get session
  if (email) {
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError) {
      return c.json({ user: dbUser, message: "Account created but login failed" }, 201);
    }

    return c.json({
      user: dbUser,
      session: session.session,
    }, 201);
  }

  // Phone-only registration: no session returned
  return c.json({
    user: dbUser,
    message: "Account created. Please sign in with your phone.",
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

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY
  );

  // Login with email or phone
  let authResult;

  if (email) {
    authResult = await supabase.auth.signInWithPassword({ email, password });
  } else if (phone) {
    // For phone login, Supabase needs OTP, not password.
    // For now, we use the phone email proxy pattern.
    const loginEmail = `${phone}@phone.auth`;
    authResult = await supabase.auth.signInWithPassword({ email: loginEmail, password });
  } else {
    return c.json({ error: "Email or phone required" }, 400);
  }

  const { data, error } = authResult;

  if (error) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Get DB user
  const db = c.get("db");
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, data.user.id))
    .limit(1);

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: dbUser,
    session: data.session,
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
  const supabase = c.get("supabase");
  await supabase.auth.signOut();
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
