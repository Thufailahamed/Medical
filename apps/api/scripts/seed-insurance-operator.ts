#!/usr/bin/env bun
// @ts-nocheck
/**
 * Standalone seed script for an insurance provider operator account.
 *
 * Seeds:
 * 1. An active operator user linked to Ceylinco Insurance (role="insurance").
 * 2. Active enrollments and pending claims so the claims queue and dashboard are populated.
 *
 * Usage:
 *   bun apps/api/scripts/seed-insurance-operator.ts          # → local D1
 *   bun apps/api/scripts/seed-insurance-operator.ts --remote # → remote D1
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const EMAIL = process.env.DEV_INSURANCE_EMAIL ?? "operator@insurance.lk";
const PASSWORD = process.env.DEV_INSURANCE_PASSWORD ?? "DevPass#1234";
const OPERATOR_NAME = process.env.DEV_INSURANCE_NAME ?? "Ceylinco Claims Adjudicator";
const PHONE = process.env.DEV_INSURANCE_PHONE ?? "+94112445566";
const ORG_ID = "52a24b54-0b24-b5ec-ff3f-0697506eae5f"; // Ceylinco Insurance
const PROVIDER_ID = "4604fdc9-ef49-692a-ab37-a04677f81d01"; // Ceylinco Insurance
const PLAN_ID = "eee4c1ed-23a3-fd2a-dae6-2e77b85796cb"; // Health Individual

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

  const now = new Date().toISOString();

  const enrollment1Id = "enr-dev-ceylinco-001";
  const enrollment2Id = "enr-dev-ceylinco-002";
  const claim1Id = "clm-dev-ceylinco-001";
  const claim2Id = "clm-dev-ceylinco-002";

  const sql = `
-- Ensure operator org exists
INSERT OR IGNORE INTO operator_orgs (id, name, kind, contact_phone, status, created_at)
VALUES ('${ORG_ID}', 'Ceylinco Insurance', 'insurance', '${PHONE}', 'active', '${now}');

-- Remove any old operator user with this ID or email
DELETE FROM users WHERE id = '${userId}' OR email = '${EMAIL}';

-- Insert active insurance operator user
INSERT INTO users (
  id, supabase_id, email, phone, name, role,
  password_hash, verified, status, operator_org_id,
  created_at, updated_at
) VALUES (
  '${userId}',
  '${userId}',
  '${EMAIL}',
  '${PHONE}',
  '${OPERATOR_NAME.replace(/'/g, "''")}',
  'insurance',
  '${passwordHash}',
  1,
  'active',
  '${ORG_ID}',
  '${now}',
  '${now}'
);

-- Delete existing test enrollments / claims if present
DELETE FROM insurance_marketplace_claims WHERE id IN ('${claim1Id}', '${claim2Id}');
DELETE FROM insurance_enrollments WHERE id IN ('${enrollment1Id}', '${enrollment2Id}');

-- Insert active test enrollments
INSERT INTO insurance_enrollments (
  id, user_id, plan_id, provider_id, policy_number,
  status, billing_cycle, premium_amount_lkr, coverage_amount_lkr,
  start_date, kyc_status, created_at, updated_at
) VALUES 
(
  '${enrollment1Id}',
  'usr_pat_1',
  '${PLAN_ID}',
  '${PROVIDER_ID}',
  'POL-CEY-2026-0089',
  'active',
  'monthly',
  3200,
  2500000,
  '2026-01-01',
  'verified',
  '${now}',
  '${now}'
),
(
  '${enrollment2Id}',
  'usr_pat_2',
  '${PLAN_ID}',
  '${PROVIDER_ID}',
  'POL-CEY-2026-0090',
  'active',
  'annual',
  35000,
  2500000,
  '2026-01-15',
  'verified',
  '${now}',
  '${now}'
);

-- Insert sample pending claims for the operator claims queue
INSERT INTO insurance_marketplace_claims (
  id, enrollment_id, user_id, provider_id,
  incurring_facility, treatment_type, diagnosis,
  amount_requested_lkr, status, insurer_remarks, patient_remarks,
  created_at, updated_at
) VALUES
(
  '${claim1Id}',
  '${enrollment1Id}',
  'usr_pat_1',
  '${PROVIDER_ID}',
  'Asiri Central Hospital',
  'hospitalization',
  'Acute Appendicitis laparoscopic surgery',
  145000,
  'submitted',
  NULL,
  'Admitted through emergency ward at Asiri Central.',
  '${now}',
  '${now}'
),
(
  '${claim2Id}',
  '${enrollment2Id}',
  'usr_pat_2',
  '${PROVIDER_ID}',
  'Durdans Hospital',
  'opd',
  'Cardiac stress test and echocardiogram',
  38500,
  'under_review',
  'Awaiting final discharge summary and itemized pharmacy bills.',
  'Prescribed by Dr. Kasun Perera.',
  '${now}',
  '${now}'
);
`;

  const statements = sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`[seed-insurance-operator] Executing ${statements.length} statements on ${REMOTE ? "REMOTE" : "LOCAL"} D1...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const wranglerArgs = [
      "wrangler",
      "d1",
      "execute",
      "healthcare-db",
      "-y",
      "--command",
      stmt + ";",
    ];
    if (REMOTE) wranglerArgs.push("--remote");

    const r = spawnSync("npx", wranglerArgs, {
      cwd: join(import.meta.dir, ".."),
      stdio: "pipe",
      encoding: "utf-8",
    });

    if (r.status !== 0) {
      console.error(`[seed-insurance-operator] Statement ${i + 1} failed:`, r.stderr || r.stdout);
      process.exit(r.status ?? 1);
    }
    console.log(`[seed-insurance-operator] Statement ${i + 1}/${statements.length} OK`);
  }

  console.log("\n========================================================");
  console.log(" Insurance Operator Account Seeded Successfully!       ");
  console.log("========================================================");
  console.log(` Target DB:        ${REMOTE ? "REMOTE Cloudflare D1" : "LOCAL D1"}`);
  console.log(` Email:            ${EMAIL}`);
  console.log(` Password:         ${PASSWORD}`);
  console.log(` Role:             insurance`);
  console.log(` Organization:     Ceylinco Insurance (${ORG_ID})`);
  console.log(` Provider ID:      ${PROVIDER_ID}`);
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("[seed-insurance-operator] Fatal error:", err);
  process.exit(1);
});
