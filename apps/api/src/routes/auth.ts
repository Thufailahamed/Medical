import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { users, patients } from "@healthcare/db";
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

  const { email, phone, name, role, password, nic } = parsed.data;

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

  // Insert into users table
  const [dbUser] = await db
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

  // If patient, create patient profile
  if (role === "patient") {
    await db.insert(patients).values({
      userId: dbUser.id,
    });
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

export default auth;
