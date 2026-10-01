#!/usr/bin/env bun
// @ts-nocheck
/**
 * Standalone seed script for a dev laboratory account.
 *
 * Inserts the user + lab_profiles row directly with status="active" so
 * you can immediately log into /lab-portal/* via the unified /login (Facility tab).
 *
 * Usage:
 *   bun apps/api/scripts/seed-laboratory.ts          # → local D1
 *   bun apps/api/scripts/seed-laboratory.ts --remote # → remote D1
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const EMAIL        = process.env.DEV_LAB_EMAIL        ?? "lab@devhospital.lk";
const PASSWORD     = process.env.DEV_LAB_PASSWORD     ?? "DevPass#1234";
const LAB_NAME     = process.env.DEV_LAB_NAME         ?? "Central Diagnostic Laboratory";
const LICENSE      = process.env.DEV_LAB_LICENSE      ?? "LAB-REG-0001";
const ACCREDITATION= process.env.DEV_LAB_ACCREDITATION?? "ISO 15189 / MOH SL";
const ADDRESS      = process.env.DEV_LAB_ADDRESS      ?? "45 Ward Place, Colombo 07";
const CITY         = process.env.DEV_LAB_CITY         ?? "Colombo";
const HOURS        = process.env.DEV_LAB_HOURS        ?? "24/7 Service";
const PHONE        = process.env.DEV_LAB_PHONE        ?? "+94112345678";

const args = process.argv.slice(2);
const REMOTE = args.includes("--remote");

async function hashPassword(password: string): Promise<string> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );
  const hashHex = Buffer.from(derived).toString("hex");
  const saltHex = Buffer.from(salt).toString("hex");
  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

async function main() {
  const userIdHash = createHash("sha256").update(`user:${EMAIL}`).digest("hex").slice(0, 32);
  const userId = [
    userIdHash.slice(0, 8),
    userIdHash.slice(8, 12),
    userIdHash.slice(12, 16),
    userIdHash.slice(16, 20),
    userIdHash.slice(20, 32),
  ].join("-");
  const passwordHash = await hashPassword(PASSWORD);

  const sql = `
CREATE TABLE IF NOT EXISTS lab_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lab_name TEXT NOT NULL,
  license_number TEXT NOT NULL UNIQUE,
  accreditation TEXT,
  address TEXT NOT NULL,
  city TEXT,
  operating_hours TEXT,
  bank_name TEXT,
  bank_account TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DELETE FROM lab_profiles WHERE user_id = '${userId}';
DELETE FROM users WHERE id = '${userId}';

INSERT INTO users (
  id, supabase_id, email, phone, name, role,
  password_hash, verified, status,
  created_at, updated_at
) VALUES (
  '${userId}',
  '${userId}',
  '${EMAIL}',
  '${PHONE}',
  '${LAB_NAME.replace(/'/g, "''")}',
  'laboratory',
  '${passwordHash}',
  1,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO lab_profiles (
  user_id, lab_name, license_number, accreditation,
  address, city, operating_hours, created_at, updated_at
) VALUES (
  '${userId}',
  '${LAB_NAME.replace(/'/g, "''")}',
  '${LICENSE.replace(/'/g, "''")}',
  '${ACCREDITATION.replace(/'/g, "''")}',
  '${ADDRESS.replace(/'/g, "''")}',
  '${CITY.replace(/'/g, "''")}',
  '${HOURS.replace(/'/g, "''")}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
`;

  const dir = mkdtempSync(join(tmpdir(), "seed-laboratory-"));
  const sqlPath = join(dir, "seed.sql");
  writeFileSync(sqlPath, sql);

  const wranglerArgs = [
    "d1",
    "execute",
    "healthcare-db",
    "--file",
    sqlPath,
  ];
  if (REMOTE) wranglerArgs.push("--remote", "-y");

  console.log(`[seed-laboratory] target: ${REMOTE ? "remote D1" : "local D1"}`);
  const result = spawnSync("npx", ["wrangler", ...wranglerArgs], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error("[seed-laboratory] wrangler d1 execute failed");
    process.exit(result.status ?? 1);
  }

  console.log("\n[seed-laboratory] ✓ dev laboratory account ready\n");
  console.log("  email:    ", EMAIL);
  console.log("  password: ", PASSWORD);
  console.log("  lab name: ", LAB_NAME);
  console.log("  license:  ", LICENSE);
  console.log("  userId:   ", userId);
  console.log("\n  → Sign in at /login?port=facility (or /lab-portal/login) with the credentials above");
}

main().catch((err) => {
  console.error("[seed-laboratory] failed:", err);
  process.exit(1);
});
