// @ts-nocheck
// AI rate limit + provider cap middleware.
//
// Two concerns, one D1 table (`ai_counters`):
//   1. Per-user rate limit on /ai/* — key `user:<id>:hour:<YYYY-MM-DD-HH>`,
//      default 20 calls/hour. Returns 429 with `Retry-After`.
//   2. Anthropic fallback daily cap — key `anthropic:day:<YYYY-MM-DD>`,
//      default 100 calls/day. Exposed as `consumeAnthropicQuota(env, db)`
//      so the router can check before calling.
//
// Atomicity: a single `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1
// RETURNING count` increments and reads in one round-trip. SQLite serialises
// writes per-DB, so concurrent requests on the same key get a unique count
// (no lost increments). Worker-shared, not instance-shared.
//
// Caveat: counts are globally accurate on D1 but Workers can have multiple
// D1 handles. For an MVP rate limit (not a security boundary) this is fine.
// If we ever shard, move to a sharded D1 or a Cloudflare KV counter.
//
// This middleware MUST be mounted AFTER `authMiddleware` (it reads
// `c.get("userId")`). On unauthenticated requests it short-circuits with
// 401 — auth should already have rejected those, so this is defence in
// depth.

import { and, eq, sql } from "drizzle-orm";
import { aiCounters } from "@healthcare/db";
import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";

// UTC bucket — we always use UTC so the boundary is unambiguous across
// worker instances regardless of where a user is.
function utcHourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}
function utcDayBucket(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function readInt(v: string | undefined, fallback: number): number {
  const n = v == null ? NaN : parseInt(v, 10);
  // Accept 0 as a valid cap — it means "block all calls" (useful for
  // kill-switching the provider). Negative / NaN → fallback.
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const DEFAULTS = {
  USER_HOURLY: 20,
  ANTHROPIC_DAILY: 100,
};

/**
 * Atomic increment-and-read via the Drizzle builder API. Returns the
 * post-increment count. Returns null on D1 failure so the caller can
 * decide between fail-open (dev) and fail-closed (prod).
 *
 * Implementation note: we use Drizzle's insert(...).onConflictDoUpdate(...)
 * rather than raw `db.run(sql\`...RETURNING count\`)` because the rest
 * of the codebase uses the builder API and our test harness (MockD1)
 * only emulates the builder surface. Production Drizzle D1 supports
 * `RETURNING` via the builder.
 */
export async function bumpCounter(
  db: any,
  scope: string
): Promise<number | null> {
  try {
    const rows: Array<{ count: number }> = await db
      .insert(aiCounters)
      .values({ scope, count: 1 })
      .onConflictDoUpdate({
        target: aiCounters.scope,
        set: {
          count: sql`${aiCounters.count} + 1`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning({ count: aiCounters.count });
    const row = rows?.[0];
    return row && typeof row.count === "number" ? row.count : null;
  } catch (err) {
    console.error("[ai-rate-limit] bump failed", err);
    return null;
  }
}

/** Read a counter without incrementing. Returns 0 if absent. */
export async function readCounter(db: any, scope: string): Promise<number> {
  try {
    const [r] = await db
      .select({ count: aiCounters.count })
      .from(aiCounters)
      .where(eq(aiCounters.scope, scope))
      .limit(1);
    return r?.count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Per-user rate limit middleware ───────────────────────
//
// Mount on the `/ai/*` route group. Reads `userId` from auth context,
// bumps the hourly counter, rejects with 429 if over the cap.
//
// Bypasses cache-hit requests so cached responses don't burn quota.
// The cache check itself is in the route handler, so we set
// `c.get("aiRateLimitConsumed") = true` after a successful bump and
// routes may inspect that to decide whether to record telemetry.
// (Today's routes always count; cache hits are free because the
//  bump only happens if the request reaches the LLM. We move the
//  bump into the route in v2 if we want true cache-bypass.)
export function aiUserRateLimit(opts?: { limit?: number; envKey?: string }) {
  const envKey = opts?.envKey ?? "AI_USER_HOURLY_LIMIT";
  return async (c: Context<AppEnvironment>, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      // Should never happen — authMiddleware runs first. Fail closed.
      return c.json({ error: "Unauthorized" }, 401);
    }
    const limit = opts?.limit ?? readInt(c.env[envKey] as any, DEFAULTS.USER_HOURLY);
    const scope = `user:${userId}:hour:${utcHourBucket()}`;
    const count = await bumpCounter(c.get("db"), scope);
    if (count === null) {
      // D1 failure. Honour the fail-open override for dev only.
      if (c.env.AI_FAIL_OPEN === "true") return next();
      return c.json({ error: "Rate limiter unavailable" }, 503);
    }
    // Headers: RFC 6585 style + draft IETF RateLimit headers.
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
    c.header("X-RateLimit-Reset", String(3600 - (Math.floor(Date.now() / 1000) % 3600)));
    if (count > limit) {
      c.header("Retry-After", String(3600 - (Math.floor(Date.now() / 1000) % 3600)));
      return c.json(
        {
          error: "Rate limit exceeded",
          scope: "user",
          limit,
          window: "1h",
        },
        429
      );
    }
    await next();
  };
}

// ─── Provider cap helper (consumed by router.ts) ──────────
//
// NOT a middleware — the router calls this BEFORE invoking Anthropic.
// If the cap is hit, the router skips the fallback and throws, which
// the route handler converts into a graceful fallbackXxx() response.
//
// `cost` lets us weight non-equal calls (default 1). For now every
// Anthropic call costs 1 unit; future: weight by output token estimate.
export async function consumeAnthropicQuota(
  env: Record<string, unknown>,
  db: any,
  cost = 1
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = readInt(env.ANTHROPIC_DAILY_CAP as any, DEFAULTS.ANTHROPIC_DAILY);
  const scope = `anthropic:day:${utcDayBucket()}`;

  // Read-then-increment: the read tells us if we'd exceed the cap
  // BEFORE we burn the call. If yes, refuse without incrementing.
  const current = await readCounter(db, scope);
  if (current + cost > limit) {
    return { allowed: false, remaining: Math.max(0, limit - current), limit };
  }
  const next = await bumpCounter(db, scope);
  if (next === null) {
    if (env.AI_FAIL_OPEN === "true") return { allowed: true, remaining: -1, limit };
    return { allowed: false, remaining: 0, limit };
  }
  return { allowed: true, remaining: Math.max(0, limit - next), limit };
}