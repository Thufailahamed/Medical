#!/usr/bin/env bun
// @ts-nocheck
//
// Standalone seed script for a dev hospital admin account.
//
// Bypasses the `register-tenant` pending→approval flow and inserts the
// user + hospital row directly with status="active" so you can log in
// to /hospital/* immediately. Idempotent on email.
//
// Usage from repo root:
//   bun apps/api/scripts/seed-hospital.ts          # → wrangler d1 --local
//   bun apps/api/scripts/seed-hospital.ts --remote
//
//   # Customise:
//   DEV_HOSPITAL_EMAIL=admin@dev.lk \
//   DEV_HOSPITAL_PASSWORD='DevPass#1234' \
//   DEV_HOSPITAL_NAME='Dev General Hospital' \
//   bun apps/api/scripts/seed-hospital.ts
//
// We pipe the SQL into `wrangler d1 execute` so we hit the exact same
// DB the Workers runtime uses (local D1 by default, remote with --remote).

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const EMAIL    = process.env.DEV_HOSPITAL_EMAIL    ?? "admin@devhospital.lk";
const PASSWORD = process.env.DEV_HOSPITAL_PASSWORD ?? "DevPass#1234";
const NAME     = process.env.DEV_HOSPITAL_NAME     ?? "Dev General Hospital";
const OWNER    = process.env.DEV_HOSPITAL_OWNER    ?? "Dev Hospital Admin";
const LICENSE  = process.env.DEV_HOSPITAL_LICENSE  ?? "DEV-REG-0001";
const ADDRESS  = process.env.DEV_HOSPITAL_ADDRESS  ?? "123 Galle Road, Colombo 03";
const LOCATION = process.env.DEV_HOSPITAL_LOCATION ?? "Colombo";
const PHONE    = process.env.DEV_HOSPITAL_PHONE    ?? "+94770000000";

const args = process.argv.slice(2);
const REMOTE = args.includes("--remote");

// ─── PBKDF2 hash — must mirror apps/api/src/lib/crypto.ts so the hash
//     verifies at login. ─────────────────────────────────────────────────
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
  // Stable UUIDs so re-runs idempotently update the same rows.
  const userIdHash = createHash("sha256").update(`user:${EMAIL}`).digest("hex").slice(0, 32);
  const userId = [
    userIdHash.slice(0, 8),
    userIdHash.slice(8, 12),
    userIdHash.slice(12, 16),
    userIdHash.slice(16, 20),
    userIdHash.slice(20, 32),
  ].join("-");
  const hospitalId = createHash("sha256").update(`hospital:${EMAIL}`).digest("hex").slice(0, 32);
  const passwordHash = await hashPassword(PASSWORD);

  // SQL is idempotent — deletes any prior rows with the same id first.
  const sql = `
DELETE FROM hospitals WHERE user_id = '${userId}';
DELETE FROM users WHERE id = '${userId}';

INSERT INTO users (
  id, supabase_id, email, name, role,
  password_hash, verified, status,
  active_tenant_type, active_tenant_id,
  created_at, updated_at
) VALUES (
  '${userId}',
  '${userId}',
  '${EMAIL}',
  '${OWNER.replace(/'/g, "''")}',
  'hospital_admin',
  '${passwordHash}',
  1,
  'active',
  'hospital',
  '${hospitalId.replace(/-/g, "").slice(0, 32)}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO hospitals (
  id, user_id, name, license, address, location, phone,
  created_at
) VALUES (
  '${hospitalId}',
  '${userId}',
  '${NAME.replace(/'/g, "''")}',
  '${LICENSE.replace(/'/g, "''")}',
  '${ADDRESS.replace(/'/g, "''")}',
  '${LOCATION.replace(/'/g, "''")}',
  '${PHONE.replace(/'/g, "''")}',
  CURRENT_TIMESTAMP
);
`;

  const dir = mkdtempSync(join(tmpdir(), "seed-hospital-"));
  const sqlPath = join(dir, "seed.sql");
  writeFileSync(sqlPath, sql);

  const wranglerArgs = [
    "d1",
    "execute",
    "healthcare-db",
    "--file",
    sqlPath,
  ];
  if (REMOTE) wranglerArgs.push("--remote");

  console.log(`[seed-hospital] target: ${REMOTE ? "remote D1" : "local D1"}`);
  const result = spawnSync("npx", ["wrangler", ...wranglerArgs], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error("[seed-hospital] wrangler d1 execute failed");
    process.exit(result.status ?? 1);
  }

  console.log("\n[seed-hospital] ✓ dev hospital ready\n");
  console.log("  email:    ", EMAIL);
  console.log("  password: ", PASSWORD);
  console.log("  hospital: ", NAME);
  console.log("  userId:   ", userId);
  console.log("  hospitalId:", hospitalId);
  console.log("\n  → Login at /hospital/login with the credentials above");
}

main().catch((err) => {
  console.error("[seed-hospital] failed:", err);
  process.exit(1);
});