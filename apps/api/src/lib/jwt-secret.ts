// lib/jwt-secret.ts
//
// P0 fail-closed guard for the JWT signing secret.
//
// Background: three middlewares (auth, stepup, tenant-context) used
// to fall back to the literal string
// `"super-secret-key-change-me-in-prod"` when JWT_SECRET was unset.
// A misconfigured production deploy (e.g. someone forgot to run
// `wrangler secret put JWT_SECRET`) would silently accept any token
// signed with that public, well-known key. That's a known-key
// vulnerability rather than a hard failure.
//
// This helper centralises the resolution logic and fails closed in
// production-like environments. Dev/preview keep the legacy default
// so local `wrangler dev` and test suites stay unblocked.

export type SecretResult =
  | { ok: true; secret: string }
  | { ok: false; reason: "missing_in_production" };

const LEGACY_DEV_FALLBACK = "super-secret-key-change-me-in-prod";

export function resolveJwtSecret(env: {
  JWT_SECRET?: string | undefined;
  ENVIRONMENT?: string | undefined;
}): SecretResult {
  const envName = String(env.ENVIRONMENT ?? "").toLowerCase();
  const isProdLike = envName === "production" || envName === "prod";

  const raw = env.JWT_SECRET;
  if (typeof raw === "string" && raw.length > 0) {
    return { ok: true, secret: raw };
  }

  if (isProdLike) {
    return { ok: false, reason: "missing_in_production" };
  }

  // Dev / preview / unset ENVIRONMENT — preserve the legacy default
  // so local `wrangler dev` and the test suite (which sets neither)
  // keep working without ceremony.
  return { ok: true, secret: LEGACY_DEV_FALLBACK };
}
