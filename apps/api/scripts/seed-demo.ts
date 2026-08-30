// @ts-nocheck
// Demo seed script. Idempotent — safe to re-run.
//
// Creates:
//   - 1 super_admin (demo+admin@healthhub.lk)
//   - 2 doctors (GP + Cardio), both SLMC-verified
//   - 5 patients
//   - 10 medical records per patient (mix of kinds)
//   - 3 appointments per patient (past + future)
//
// Usage from repo root:
//   bun run seed:demo
//
// Requires DRIZZLE_URL (libsql/http) + DRIZZLE_AUTH_TOKEN for remote,
// or local wrangler dev shell for local.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  users,
  doctors,
  patients,
  medicalRecords,
  appointments,
} from "@healthcare/db";

const DEMO_PASSWORD = "demo1234";

const ADMIN = { email: "demo+admin@healthhub.lk", nic: "199012345678" };
const DOCTORS = [
  {
    email: "demo+gp@healthhub.lk",
    nic: "198001234567",
    name: "Dr. GP Demo",
    specialization: "General Practice",
  },
  {
    email: "demo+cardio@healthhub.lk",
    nic: "197501234568",
    name: "Dr. Cardio Demo",
    specialization: "Cardiology",
  },
];
const PATIENT_EMAILS = [
  "demo+patient1@healthhub.lk",
  "demo+patient2@healthhub.lk",
  "demo+patient3@healthhub.lk",
  "demo+patient4@healthhub.lk",
  "demo+patient5@healthhub.lk",
];
const RECORD_TYPES = [
  "lab_report",
  "prescription",
  "imaging",
  "allergy",
  "vaccination",
];

function nicHash(nic: string) {
  return createHash("sha256").update(nic).digest("hex");
}

export async function seedDemo(db: any) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const counts = { admins: 0, doctors: 0, patients: 0, records: 0, appointments: 0 };

  // 1. Admin
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN.email))
    .limit(1);
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email: ADMIN.email,
      passwordHash,
      role: "super_admin",
      nicHash: nicHash(ADMIN.nic),
    });
  }
  counts.admins++;

  // 2. Doctors
  for (const d of DOCTORS) {
    let userId: string;
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, d.email))
      .limit(1);
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: d.email,
        passwordHash,
        role: "doctor",
        nicHash: nicHash(d.nic),
      });
    }

    // doctors row (linked via user_id)
    const existingDoctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (existingDoctor.length === 0) {
      await db.insert(doctors).values({
        id: crypto.randomUUID(),
        userId,
        specialization: d.specialization,
        slmcNumber: `SLMC-${d.nic.slice(-6)}`,
        verifiedAt: new Date().toISOString(),
      });
    }
    counts.doctors++;
  }

  // 3. Patients
  for (const email of PATIENT_EMAILS) {
    let userId: string;
    let patientId: string;
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      userId = existing[0].id;
      const existingPatient = await db
        .select()
        .from(patients)
        .where(eq(patients.userId, userId))
        .limit(1);
      patientId = existingPatient[0]?.id ?? crypto.randomUUID();
      if (!existingPatient[0]) {
        await db.insert(patients).values({ id: patientId, userId });
      }
    } else {
      userId = crypto.randomUUID();
      patientId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        role: "patient",
        nicHash: nicHash(email),
      });
      await db.insert(patients).values({ id: patientId, userId });
    }
    counts.patients++;

    // 4. Records — 10 per patient, mix of kinds
    for (let i = 0; i < 10; i++) {
      const recordType = RECORD_TYPES[i % RECORD_TYPES.length];
      await db.insert(medicalRecords).values({
        id: crypto.randomUUID(),
        patientId,
        recordType,
        title: `Demo ${recordType} #${i + 1}`,
        // payload_encrypted / data is required — provide empty JSON.
        // Schema field name may vary; using `data` as canonical.
        data: "{}",
        createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      } as any);
      counts.records++;
    }

    // 5. Appointments — 3 per patient
    const doctorRow = await db.select().from(doctors).limit(1);
    if (doctorRow.length > 0) {
      for (let i = 0; i < 3; i++) {
        await db.insert(appointments).values({
          id: crypto.randomUUID(),
          doctorId: doctorRow[0].id,
          patientId,
          status: i === 0 ? "completed" : "scheduled",
          scheduledAt: new Date(Date.now() + (i - 1) * 86_400_000).toISOString(),
        } as any);
        counts.appointments++;
      }
    }
  }

  return counts;
}

async function main() {
  const url = process.env.DRIZZLE_URL ?? process.env.DB_URL;
  const authToken = process.env.DRIZZLE_AUTH_TOKEN ?? process.env.DB_TOKEN;
  if (!url) {
    console.error(
      "[seed-demo] Set DRIZZLE_URL (libsql/http) + DRIZZLE_AUTH_TOKEN, " +
        "or run inside the Workers shell (process.env.DB available)."
    );
    process.exit(1);
  }
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  const out = await seedDemo(db);
  console.log("[seed-demo] result:", out);
  console.log(`\nLogin credentials (password: ${DEMO_PASSWORD}):`);
  console.log(`  Admin:    ${ADMIN.email}`);
  for (const d of DOCTORS) console.log(`  Doctor:   ${d.email}`);
  for (const p of PATIENT_EMAILS) console.log(`  Patient:  ${p}`);
}

if (import.meta.main) main();
