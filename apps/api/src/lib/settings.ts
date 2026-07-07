// @ts-nocheck
// ─── Runtime settings (Phase ADM-2) ─────────────────────────
//
// Thin reader over the `system_settings` table. Hot-path calls
// (auth.ts register/login) go through `getSetting` which keeps
// a per-isolate Map cache. Cache is invalidated on PATCH via
// a simple version counter — cheap, no cross-isolate concerns.

import { eq } from "drizzle-orm";
import { systemSettings } from "@healthcare/db";

type ValueType = "string" | "number" | "boolean" | "json";

interface CacheEntry {
  value: unknown;
  valueType: ValueType;
  updatedAt: string;
}

// One cache per (db binding, key). Workers isolates are short-
// lived so leaks are bounded; on each isolate restart the map is
// empty and we re-read. We deliberately don't share state across
// isolates — eventual consistency across the fleet is acceptable
// for runtime config.
const caches = new WeakMap<object, Map<string, CacheEntry>>();

function getCache(db: any): Map<string, CacheEntry> {
  let m = caches.get(db);
  if (!m) {
    m = new Map();
    caches.set(db, m);
  }
  return m;
}

function decode(raw: string, type: ValueType): unknown {
  switch (type) {
    case "boolean":
      return raw === "true";
    case "number":
      return Number(raw);
    case "string":
    case "json":
    default:
      return JSON.parse(raw);
  }
}

/**
 * Read a single setting with type-coerced value.
 * Returns `defaultValue` if the row is missing.
 */
export async function getSetting<T = unknown>(
  db: any,
  key: string,
  defaultValue: T,
): Promise<T> {
  const cache = getCache(db);
  const cached = cache.get(key);
  if (cached) {
    return cached.value as T;
  }
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  if (!row) return defaultValue;
  const value = decode(row.value, row.valueType as ValueType);
  cache.set(key, { value, valueType: row.valueType as ValueType, updatedAt: row.updatedAt });
  return value as T;
}

/**
 * Invalidate cache for a key. Called after PATCH so the next
 * read picks up the new value. No-op if key is absent.
 */
export function invalidateSetting(db: any, key: string): void {
  const cache = getCache(db);
  cache.delete(key);
}

/**
 * Coerce an incoming value to the declared valueType. Returns
 * { ok: true, value } or { ok: false, error }.
 */
export function coerceSettingValue(
  incoming: unknown,
  type: ValueType,
): { ok: true; encoded: string } | { ok: false; error: string } {
  switch (type) {
    case "boolean": {
      if (typeof incoming === "boolean") {
        return { ok: true, encoded: JSON.stringify(incoming) };
      }
      return { ok: false, error: "value must be a boolean" };
    }
    case "number": {
      const n = typeof incoming === "number" ? incoming : Number(incoming);
      if (Number.isFinite(n)) {
        return { ok: true, encoded: JSON.stringify(n) };
      }
      return { ok: false, error: "value must be a finite number" };
    }
    case "string": {
      if (typeof incoming === "string") {
        return { ok: true, encoded: JSON.stringify(incoming) };
      }
      return { ok: false, error: "value must be a string" };
    }
    case "json": {
      // Accept anything that JSON-serialises. Caller may send an
      // object, array, or primitive.
      try {
        return { ok: true, encoded: JSON.stringify(incoming) };
      } catch {
        return { ok: false, error: "value must be JSON-serialisable" };
      }
    }
    default:
      return { ok: false, error: `unknown valueType ${type}` };
  }
}

/**
 * Convenience: the canonical approval-roles list, read at request
 * time. Falls back to the hard-coded set if the setting is absent
 * or malformed so a misconfigured DB never lets everyone in.
 */
const FALLBACK_APPROVAL_ROLES: ReadonlyArray<string> = [
  "doctor",
  "hospital_admin",
  "pharmacy",
  "laboratory",
  "insurance",
  "ambulance",
];

export async function getApprovalRequiredRoles(db: any): Promise<ReadonlyArray<string>> {
  const requireApproval = await getSetting<boolean>(db, "registration.requireApproval", true);
  if (!requireApproval) return [];
  const list = await getSetting<string[]>(
    db,
    "registration.approvalRoles",
    FALLBACK_APPROVAL_ROLES as unknown as string[],
  );
  return Array.isArray(list) && list.length ? list : FALLBACK_APPROVAL_ROLES;
}