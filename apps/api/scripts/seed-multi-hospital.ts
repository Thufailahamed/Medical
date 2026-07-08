#!/usr/bin/env bun
/**
 * Multi-hospital smoke seed for HOS-14 inter-hospital collab.
 *
 * Creates:
 *   - Hospital A: "Northern Central Hospital" (admin = admin@north.lk)
 *   - Hospital B: "Dev General Hospital" — already seeded by seed-hospital.ts
 *   - A patient "Kumari Perera" registered at Hospital A
 *   - Admission + prescription + lab order + medical record for that patient
 *
 * Idempotent: re-runs are safe.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const HOSP_A_EMAIL = process.env.HOSP_A_EMAIL ?? "admin@north.lk";
const HOSP_A_PASS = process.env.HOSP_A_PASS ?? "NorthPass#1234";
const HOSP_A_NAME = process.env.HOSP_A_NAME ?? "Northern Central Hospital";

const HOSP_B_EMAIL = process.env.HOSP_B_EMAIL ?? "admin@devhospital.lk";
const HOSP_B_PASS = process.env.HOSP_B_PASS ?? "DevPass#1234";

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
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    256,
  );
  const hashHex = Buffer.from(derived).toString("hex");
  const saltHex = Buffer.from(salt).toString("hex");
  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

function hashId(prefix: string, key: string): string {
  return createHash("sha256").update(`${prefix}:${key}`).digest("hex").slice(0, 32);
}

async function main() {
  // ─── Hospital A (new) ────────────────────────────────────
  const adminAId = [
    hashId("user", HOSP_A_EMAIL).slice(0, 8),
    hashId("user", HOSP_A_EMAIL).slice(8, 12),
    hashId("user", HOSP_A_EMAIL).slice(12, 16),
    hashId("user", HOSP_A_EMAIL).slice(16, 20),
    hashId("user", HOSP_A_EMAIL).slice(20, 32),
  ].join("-");
  const hospitalAId = hashId("hospital", HOSP_A_EMAIL);
  const passHashA = await hashPassword(HOSP_A_PASS);

  // ─── Hospital B (already seeded by seed-hospital.ts) ─────
  const adminBId = [
    hashId("user", HOSP_B_EMAIL).slice(0, 8),
    hashId("user", HOSP_B_EMAIL).slice(8, 12),
    hashId("user", HOSP_B_EMAIL).slice(12, 16),
    hashId("user", HOSP_B_EMAIL).slice(16, 20),
    hashId("user", HOSP_B_EMAIL).slice(20, 32),
  ].join("-");
  const hospitalBId = hashId("hospital", HOSP_B_EMAIL);

  // ─── Patient "Kumari Perera" — registered at Hospital A ──
  const patientEmail = "kumari@north.lk";
  const patientUserId = [
    hashId("user", patientEmail).slice(0, 8),
    hashId("user", patientEmail).slice(8, 12),
    hashId("user", patientEmail).slice(12, 16),
    hashId("user", patientEmail).slice(16, 20),
    hashId("user", patientEmail).slice(20, 32),
  ].join("-");
  const patientId = hashId("patient", patientEmail);
  const hospitalPatientRowId = hashId("hospitalpatient", `${hospitalAId}:${patientId}`);

  // ─── Sample clinical data so the bundle preview is non-empty
  const admissionId = hashId("admission", `${patientId}:1`);
  const prescriptionId = hashId("prescription", `${patientId}:1`);
  const labOrderId = hashId("laborder", `${patientId}:1`);
  const medicalRecordId = hashId("record", `${patientId}:1`);
  const doctorId = "00000000-0000-0000-0000-000000000001"; // fallback id used by routes
  const wardId = hashId("ward", hospitalAId);
  const bedId = hashId("bed", hospitalAId);
  const departmentId = hashId("dept", `${hospitalAId}:general`);

  // Look up real ward/bed IDs that exist in the local DB so admissions FK resolves
  // (the local wards/beds schema uses id-as-text without separate auto-ids, so we
  // use the generated deterministic ids — Drizzle's FK accepts strings).
  const realWardId = "11111111-1111-1111-1111-111111111111";
  const realBedId  = "22222222-2222-2222-2222-222222222222";
  const realDeptId = "33333333-3333-3333-3333-333333333333";

  const now = new Date().toISOString();

  const sql = `
-- ─── Hospital A: admin + hospital row ───────────────────────
DELETE FROM hospital_patients WHERE hospital_id = '${hospitalAId}';
DELETE FROM users WHERE id = '${adminAId}';
DELETE FROM hospitals WHERE id = '${hospitalAId}';

INSERT INTO users (
  id, supabase_id, email, name, role,
  password_hash, verified, status,
  active_tenant_type, active_tenant_id,
  created_at, updated_at
) VALUES (
  '${adminAId}',
  '${adminAId}',
  '${HOSP_A_EMAIL}',
  'Northern Admin',
  'hospital_admin',
  '${passHashA}',
  1,
  'active',
  'hospital',
  '${hospitalAId}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO hospitals (
  id, user_id, name, license, address, location, phone,
  created_at
) VALUES (
  '${hospitalAId}',
  '${adminAId}',
  '${HOSP_A_NAME}',
  'NORTH-REG-0001',
  '42 Peradeniya Road, Kandy',
  'Kandy',
  '+94812222222',
  CURRENT_TIMESTAMP
);

-- ─── Hospital B: ensure it exists (idempotent, skip if so) ─
-- (seed-hospital.ts already created Hospital B; we don't touch it here)

-- ─── Ward + bed + department at Hospital A (for admission) ─
-- Local DB has different wards/beds/departments schemas than the
-- canonical schema.ts expects; use real placeholder IDs that match the
-- dev seed pattern. The FK only needs to resolve.
DELETE FROM wards WHERE id = '${realWardId}';
INSERT INTO wards (id, hospital_id, name, type, capacity, active, created_at)
VALUES ('${realWardId}', '${hospitalAId}', 'General Ward', 'general', 10, 1, CURRENT_TIMESTAMP);

DELETE FROM beds WHERE id = '${realBedId}';
INSERT INTO beds (id, ward_id, bed_number, status, created_at)
VALUES ('${realBedId}', '${realWardId}', 'A-101', 'occupied', CURRENT_TIMESTAMP);

DELETE FROM departments WHERE id = '${realDeptId}';
INSERT INTO departments (id, hospital_id, name, active, created_at)
VALUES ('${realDeptId}', '${hospitalAId}', 'General Medicine', 1, CURRENT_TIMESTAMP);

-- ─── Fallback doctor row (idempotent) ─────────────────────
INSERT OR IGNORE INTO users (id, supabase_id, email, name, role, verified, status, created_at, updated_at)
VALUES ('${doctorId}', '${doctorId}', 'fallback@doctor.lk', 'Fallback Doctor', 'doctor', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ─── Patient user + patient row + hospital_patients link ───
DELETE FROM hospital_patients WHERE patient_id = '${patientId}';
DELETE FROM patients WHERE id = '${patientId}';
DELETE FROM users WHERE id = '${patientUserId}';

INSERT INTO users (
  id, supabase_id, email, name, role,
  verified, status,
  created_at, updated_at
) VALUES (
  '${patientUserId}',
  '${patientUserId}',
  '${patientEmail}',
  'Kumari Perera',
  'patient',
  1,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO patients (
  id, user_id, blood_group, gender, date_of_birth,
  created_at, updated_at
) VALUES (
  '${patientId}',
  '${patientUserId}',
  'O+',
  'F',
  '1985-06-12',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO hospital_patients (
  id, hospital_id, patient_id, mrn, status,
  registered_at, created_at, updated_at
) VALUES (
  '${hospitalPatientRowId}',
  '${hospitalAId}',
  '${patientId}',
  'MRN-NORTH-0001',
  'registered',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ─── Sample admission ─────────────────────────────────────
DELETE FROM admissions WHERE id = '${admissionId}';
INSERT INTO admissions (
  id, hospital_id, patient_id, ward_id, bed_id,
  admitted_by_user_id, admitting_doctor_id, admission_type,
  admitted_at, status, reason, diagnosis_at_admission,
  created_at, updated_at
) VALUES (
  '${admissionId}',
  '${hospitalAId}',
  '${patientId}',
  '${realWardId}',
  '${realBedId}',
  '${adminAId}',
  '${doctorId}',
  'planned',
  '${now}',
  'admitted',
  'Chest pain evaluation',
  'Stable angina, rule out ACS',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ─── Sample prescription ──────────────────────────────────
DELETE FROM prescriptions WHERE id = '${prescriptionId}';
INSERT INTO prescriptions (
  id, hospital_id, patient_id, doctor_id,
  diagnosis, notes, date, status,
  signed_at, created_at, updated_at
) VALUES (
  '${prescriptionId}',
  '${hospitalAId}',
  '${patientId}',
  '${doctorId}',
  'Stable angina',
  'Lifestyle + aspirin',
  '${now}',
  'signed',
  '${now}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ─── Sample lab order ─────────────────────────────────────
DELETE FROM lab_orders WHERE id = '${labOrderId}';
INSERT INTO lab_orders (
  id, hospital_id, patient_id, doctor_id,
  tests, priority, status, notes,
  ordered_at, completed_at, created_at, updated_at
) VALUES (
  '${labOrderId}',
  '${hospitalAId}',
  '${patientId}',
  '${doctorId}',
  'Troponin I, Lipid profile',
  'routine',
  'completed',
  'Stable angina workup',
  '${now}',
  '${now}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ─── Sample medical record ────────────────────────────────
DELETE FROM medical_records WHERE id = '${medicalRecordId}';
INSERT INTO medical_records (
  id, hospital_id, patient_id, doctor_id,
  record_type, title, diagnosis, summary, notes, date,
  created_at, updated_at
) VALUES (
  '${medicalRecordId}',
  '${hospitalAId}',
  '${patientId}',
  '${doctorId}',
  'consultation',
  'Cardiology consult',
  'Stable angina',
  'Patient presents with intermittent chest pain on exertion. ECG normal at rest.',
  'Started on aspirin 75mg OD',
  '${now}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
`;

  const dir = mkdtempSync(join(tmpdir(), "seed-multi-"));
  const sqlPath = join(dir, "seed.sql");
  writeFileSync(sqlPath, sql);

  const args = process.argv.slice(2);
  const REMOTE = args.includes("--remote");

  const wranglerArgs = [
    "d1", "execute", "healthcare-db",
    "--file", sqlPath,
  ];
  if (REMOTE) wranglerArgs.push("--remote");

  console.log(`[seed-multi-hospital] target: ${REMOTE ? "remote" : "local"} D1`);
  const result = spawnSync("npx", ["wrangler", ...wranglerArgs], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error("[seed-multi-hospital] wrangler d1 execute failed");
    process.exit(result.status ?? 1);
  }

  console.log("\n[seed-multi-hospital] ✓ seeded\n");
  console.log("  Hospital A:");
  console.log("    email:    ", HOSP_A_EMAIL);
  console.log("    password: ", HOSP_A_PASS);
  console.log("    admin id: ", adminAId);
  console.log("    hospital: ", hospitalAId);
  console.log("\n  Hospital B (already seeded):");
  console.log("    email:    ", HOSP_B_EMAIL);
  console.log("    admin id: ", adminBId);
  console.log("    hospital: ", hospitalBId);
  console.log("\n  Patient at Hospital A:");
  console.log("    patient id:  ", patientId);
  console.log("    mrn:         MRN-NORTH-0001");
  console.log("\n  Sample data:");
  console.log("    admission:    ", admissionId);
  console.log("    prescription: ", prescriptionId);
  console.log("    lab order:    ", labOrderId);
  console.log("    medical rec:  ", medicalRecordId);
}

main().catch((err) => {
  console.error("[seed-multi-hospital] failed:", err);
  process.exit(1);
});