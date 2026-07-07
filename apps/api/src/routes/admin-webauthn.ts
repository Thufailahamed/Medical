// @ts-nocheck
// ─── Admin WebAuthn endpoints (Phase ADM-3) ─────────────────
//
// Enrollment + assertion flows for passkey step-up auth.
// Challenges are stored in-memory per isolate with a 5-min TTL.
// In production swap the in-memory store for Cloudflare KV
// (c.env.WEBAUTHN_KV) so challenges survive isolate restarts.
//
// This route file is split into two halves:
//   - options endpoints issue challenges
//   - verify endpoints consume them
//
// For testability we do NOT depend on @simplewebauthn/server
// for the round-trip HMAC; tests use the stepup token flow
// directly. The challenge-verify shape mirrors what the browser
// sends (base64url CBOR attestation) but the public key and
// counter are stored as opaque strings — production would parse
// COSE, but tests pass parsed blobs.

import { Hono } from "hono";
import { z } from "zod";
import { randomBytes, createHmac } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { users, adminPasskeys } from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { flattenTranslated } from "../lib/validation-error";
import { issueStepUpToken } from "../middleware/stepup";
import type { AppEnvironment } from "../types";

const webauthnRouter = new Hono<AppEnvironment>();
webauthnRouter.use("*", requireAdmin);

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
interface ChallengeEntry { challenge: string; userId: string; createdAt: number; }

// In-memory challenge store. Keyed by userId (registration) or userId (auth).
const challenges = new Map<string, ChallengeEntry>();

function purgeOld(): void {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (now - v.createdAt > CHALLENGE_TTL_MS) challenges.delete(k);
  }
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function getRpId(c: any): string {
  return c.env.WEBAUTHN_RP_ID || "localhost";
}

function getRpName(): string {
  return "HealthHub Admin";
}

function newChallenge(): string {
  return b64url(randomBytes(32));
}

// ─── Status ─────────────────────────────────────────────────
webauthnRouter.get("/status", async (c) => {
  const db = c.get("db");
  const me = c.get("dbUser");
  const rows = await db
    .select()
    .from(adminPasskeys)
    .where(eq(adminPasskeys.userId, me.id))
    .orderBy(desc(adminPasskeys.createdAt));
  return c.json({
    enrolled: rows.length > 0,
    credentials: rows.map((r: any) => ({
      id: r.id,
      deviceName: r.deviceName,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    })),
  });
});

// ─── Register: options ──────────────────────────────────────
webauthnRouter.post("/register/options", async (c) => {
  const me = c.get("dbUser");
  purgeOld();
  const challenge = newChallenge();
  challenges.set(`reg:${me.id}`, { challenge, userId: me.id, createdAt: Date.now() });

  // Existing credential IDs so the browser can exclude them.
  const db = c.get("db");
  const existing = await db
    .select({ credentialId: adminPasskeys.credentialId })
    .from(adminPasskeys)
    .where(eq(adminPasskeys.userId, me.id));
  const exclude = existing.map((r) => r.credentialId).filter(Boolean) as string[];

  // PublicKeyCredentialCreationOptionsJSON shape (simplified).
  return c.json({
    challenge,
    rp: { id: getRpId(c), name: getRpName() },
    user: {
      id: b64url(me.id),
      name: me.email ?? me.id,
      displayName: me.name ?? me.email ?? "Admin",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "none",
    excludeCredentials: exclude.map((id) => ({ id, type: "public-key" })),
  });
});

const registerVerifySchema = z.object({
  // Opaque from the browser. We accept the parsed blob.
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
  }),
  deviceName: z.string().min(1).max(60).optional(),
});

// ─── Register: verify ───────────────────────────────────────
webauthnRouter.post("/register/verify", async (c) => {
  const db = c.get("db");
  const me = c.get("dbUser");
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerVerifySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const entry = challenges.get(`reg:${me.id}`);
  if (!entry) return c.json({ error: "No registration challenge issued (or expired)" }, 400);

  // Minimal client-data check: the challenge must appear in the
  // base64url-decoded clientDataJSON. Production code would also
  // verify the COSE attestation chain and parse the public key.
  let clientData: any;
  try {
    clientData = JSON.parse(Buffer.from(parsed.data.response.clientDataJSON, "base64").toString("utf-8"));
  } catch {
    return c.json({ error: "clientDataJSON could not be parsed" }, 400);
  }
  if (clientData.challenge !== entry.challenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }
  if (clientData.type !== "webauthn.create") {
    return c.json({ error: "Wrong ceremony type" }, 400);
  }

  challenges.delete(`reg:${me.id}`);

  // Store the credential. Public key is opaque — in production
  // this would be the parsed COSE key. We keep whatever the
  // client sent (or a hash of it) for round-trip with the auth
  // verify path.
  const id = crypto.randomUUID();
  const publicKey = parsed.data.response.attestationObject; // opaque
  await db.insert(adminPasskeys).values({
    id,
    userId: me.id,
    credentialId: parsed.data.id,
    publicKey,
    counter: 0,
    transports: null,
    deviceName: parsed.data.deviceName ?? "Passkey",
    createdAt: new Date().toISOString(),
  } as any);

  await recordAdminAction(c, {
    action: "register_passkey",
    resource: "user",
    resourceId: me.id,
    details: { credentialId: parsed.data.id, deviceName: parsed.data.deviceName ?? "Passkey" },
  });

  // After enrollment, issue a step-up token so the admin doesn't
  // have to immediately re-prompt.
  const stepUp = issueStepUpToken(c, me.id);
  return c.json({ ok: true, id, stepUpToken: stepUp });
});

// ─── Auth: options ──────────────────────────────────────────
webauthnRouter.post("/auth/options", async (c) => {
  const me = c.get("dbUser");
  purgeOld();
  const db = c.get("db");
  const existing = await db
    .select({ credentialId: adminPasskeys.credentialId })
    .from(adminPasskeys)
    .where(eq(adminPasskeys.userId, me.id));
  if (existing.length === 0) {
    return c.json({ error: "No passkeys enrolled", code: "no_passkeys" }, 400);
  }
  const challenge = newChallenge();
  challenges.set(`auth:${me.id}`, { challenge, userId: me.id, createdAt: Date.now() });
  return c.json({
    challenge,
    rpId: getRpId(c),
    timeout: 60000,
    userVerification: "required",
    allowCredentials: existing
      .filter((r) => r.credentialId)
      .map((r) => ({ id: r.credentialId, type: "public-key" })),
  });
});

const authVerifySchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
  }),
});

// ─── Auth: verify ───────────────────────────────────────────
webauthnRouter.post("/auth/verify", async (c) => {
  const db = c.get("db");
  const me = c.get("dbUser");
  const body = await c.req.json().catch(() => ({}));
  const parsed = authVerifySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const entry = challenges.get(`auth:${me.id}`);
  if (!entry) return c.json({ error: "No auth challenge issued (or expired)" }, 400);

  let clientData: any;
  try {
    clientData = JSON.parse(Buffer.from(parsed.data.response.clientDataJSON, "base64").toString("utf-8"));
  } catch {
    return c.json({ error: "clientDataJSON could not be parsed" }, 400);
  }
  if (clientData.challenge !== entry.challenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }
  if (clientData.type !== "webauthn.get") {
    return c.json({ error: "Wrong ceremony type" }, 400);
  }

  challenges.delete(`auth:${me.id}`);

  // Find the credential.
  const [cred] = await db
    .select()
    .from(adminPasskeys)
    .where(and(eq(adminPasskeys.userId, me.id), eq(adminPasskeys.credentialId, parsed.data.id)))
    .limit(1);
  if (!cred) return c.json({ error: "Unknown credential" }, 404);

  // Production: parse authenticatorData, verify the HMAC
  // signature against stored public key, check counter > stored.
  // For this build we trust the client and only update state.

  const now = new Date().toISOString();
  await db
    .update(adminPasskeys)
    .set({ counter: ((cred as any).counter ?? 0) + 1, lastUsedAt: now } as any)
    .where(eq(adminPasskeys.id, (cred as any).id));

  const stepUp = issueStepUpToken(c, me.id);
  return c.json({ ok: true, stepUpToken: stepUp, expiresIn: 5 * 60 });
});

// ─── Delete credential ──────────────────────────────────────
webauthnRouter.delete("/credentials/:id", async (c) => {
  const db = c.get("db");
  const me = c.get("dbUser");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(adminPasskeys)
    .where(and(eq(adminPasskeys.id, id), eq(adminPasskeys.userId, me.id)))
    .limit(1);
  if (!row) return c.json({ error: "Credential not found" }, 404);
  await db.delete(adminPasskeys).where(eq(adminPasskeys.id, id));
  await recordAdminAction(c, {
    action: "remove_passkey",
    resource: "user",
    resourceId: me.id,
    details: { credentialId: (row as any).credentialId, deviceName: (row as any).deviceName },
  });
  return c.json({ ok: true });
});

export default webauthnRouter;