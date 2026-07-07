// @ts-nocheck
// ─── Seed default system_settings rows (Phase ADM-2) ─────────
//
// Idempotent. Inserts rows for any missing key. Preserves admin
// edits across redeploys — does not overwrite.

import { eq } from "drizzle-orm";
import { systemSettings } from "@healthcare/db";

type ValueType = "string" | "number" | "boolean" | "json";

export interface SettingSeed {
  key: string;
  value: string | number | boolean | unknown[];
  valueType: ValueType;
  category: string;
  description: string;
  isSensitive?: boolean;
}

export const DEFAULT_SETTINGS: ReadonlyArray<SettingSeed> = [
  // ── Registration ──────────────────────────────────────────
  {
    key: "registration.requireApproval",
    value: true,
    valueType: "boolean",
    category: "registration",
    description: "When true, new gated-role registrations require super_admin approval before login.",
  },
  {
    key: "registration.approvalRoles",
    value: ["doctor", "hospital_admin", "pharmacy", "laboratory", "insurance", "ambulance"],
    valueType: "json",
    category: "registration",
    description: "Roles whose registrations require admin approval.",
  },
  {
    key: "registration.allowPatientSelfSignup",
    value: true,
    valueType: "boolean",
    category: "registration",
    description: "Allow patients to register without admin intervention. Turn off to make patients invite-only.",
  },

  // ── Uploads ───────────────────────────────────────────────
  {
    key: "uploads.maxFileSizeMb",
    value: 25,
    valueType: "number",
    category: "uploads",
    description: "Maximum size in megabytes for a single uploaded file.",
  },
  {
    key: "uploads.allowedMimeTypes",
    value: ["image/*", "application/pdf"],
    valueType: "json",
    category: "uploads",
    description: "MIME type whitelist for uploads. Wildcards supported.",
  },

  // ── Operations ────────────────────────────────────────────
  {
    key: "operations.maintenanceMode",
    value: false,
    valueType: "boolean",
    category: "operations",
    description: "Block all non-admin logins with 503. Existing sessions unaffected.",
    isSensitive: true,
  },
  {
    key: "operations.auditRetentionDays",
    value: 365,
    valueType: "number",
    category: "operations",
    description: "Auto-purge audit log rows older than this many days. Set to 0 to disable.",
  },

  // ── Feature flags ─────────────────────────────────────────
  {
    key: "featureFlags.broadcastsEnabled",
    value: true,
    valueType: "boolean",
    category: "feature_flags",
    description: "Master switch for admin notification broadcasts.",
  },
  {
    key: "featureFlags.bulkOpsEnabled",
    value: true,
    valueType: "boolean",
    category: "feature_flags",
    description: "Master switch for bulk admin operations (approve, suspend, delete).",
  },
];

function encodeValue(s: SettingSeed): string {
  switch (s.valueType) {
    case "string":
      return JSON.stringify(s.value);
    case "number":
    case "boolean":
      return JSON.stringify(s.value);
    case "json":
      return JSON.stringify(s.value);
    default:
      return JSON.stringify(s.value);
  }
}

/**
 * Insert any missing setting rows. Existing rows are untouched.
 */
export async function seedSettings(db: any, adminUserId?: string | null): Promise<{
  inserted: string[];
  skipped: string[];
}> {
  const inserted: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  for (const s of DEFAULT_SETTINGS) {
    const [existing] = await db
      .select({ key: systemSettings.key })
      .from(systemSettings)
      .where(eq(systemSettings.key, s.key))
      .limit(1);
    if (existing) {
      skipped.push(s.key);
      continue;
    }
    await db.insert(systemSettings).values({
      key: s.key,
      value: encodeValue(s),
      valueType: s.valueType,
      category: s.category,
      description: s.description,
      isSensitive: s.isSensitive ?? false,
      updatedAt: now,
      updatedByUserId: adminUserId ?? null,
    } as any);
    inserted.push(s.key);
  }
  return { inserted, skipped };
}