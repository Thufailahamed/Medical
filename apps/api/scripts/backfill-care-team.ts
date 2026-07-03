// @ts-nocheck
//
// Backfill care_team_members from existing relationship evidence.
//
// Run AFTER migration 0024 has been applied to the remote D1 database.
// Idempotent: every insert is OR IGNORE'd via the partial UNIQUE index
// `care_team_active_unique` (active rows only).
//
// Usage:
//   npx wrangler d1 execute healthcare-db --file=./scripts/backfill.sql
//   OR via node:
//     tsx scripts/backfill-care-team.ts
//
// Strategy:
//   1. For every distinct (patient_id, doctor_id) pair appearing in
//      appointments, prescriptions, lab_orders, medical_records,
//      walk_ins, messages_conversations, insert a 'primary_care' row
//      with scope='full', status='active', invited_by_user_id = the
//      patient (so the partial UNIQUE doesn't trip on duplicates —
//      patient_id is constant per row).
//
//   2. The OR IGNORE pattern means re-running is safe — already-active
//      rows are skipped silently.

import { createClient } from "@libsql/client";

const DB_URL =
  process.env.D1_URL ||
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT>/d1/database/<DB_ID>";

const sql = createClient({ url: DB_URL, authToken: process.env.CF_TOKEN });

async function main() {
  console.log("Backfilling care_team_members from existing relationship rows…");

  // Appointments
  let r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       a.patient_id, a.doctor_id, 'primary_care', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = a.patient_id),
       CURRENT_TIMESTAMP
     FROM appointments a
     WHERE NOT EXISTS (
       SELECT 1 FROM care_team_members c
       WHERE c.patient_id = a.patient_id
         AND c.doctor_id   = a.doctor_id
         AND c.role        = 'primary_care'
         AND c.status      = 'active'
     )
     GROUP BY a.patient_id, a.doctor_id;`
  );
  console.log("appointments:", r.rowsAffected ?? "n/a");

  // Prescriptions
  r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       p.patient_id, p.doctor_id, 'primary_care', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = p.patient_id),
       CURRENT_TIMESTAMP
     FROM prescriptions p
     WHERE NOT EXISTS (
       SELECT 1 FROM care_team_members c
       WHERE c.patient_id = p.patient_id
         AND c.doctor_id   = p.doctor_id
         AND c.role        = 'primary_care'
         AND c.status      = 'active'
     )
     GROUP BY p.patient_id, p.doctor_id;`
  );
  console.log("prescriptions:", r.rowsAffected ?? "n/a");

  // Lab orders
  r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       l.patient_id, l.doctor_id, 'primary_care', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = l.patient_id),
       CURRENT_TIMESTAMP
     FROM lab_orders l
     WHERE NOT EXISTS (
       SELECT 1 FROM care_team_members c
       WHERE c.patient_id = l.patient_id
         AND c.doctor_id   = l.doctor_id
         AND c.role        = 'primary_care'
         AND c.status      = 'active'
     )
     GROUP BY l.patient_id, l.doctor_id;`
  );
  console.log("lab_orders:", r.rowsAffected ?? "n/a");

  // Medical records
  r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       m.patient_id, m.doctor_id, 'primary_care', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = m.patient_id),
       CURRENT_TIMESTAMP
     FROM medical_records m
     WHERE m.doctor_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM care_team_members c
         WHERE c.patient_id = m.patient_id
           AND c.doctor_id   = m.doctor_id
           AND c.role        = 'primary_care'
           AND c.status      = 'active'
       )
     GROUP BY m.patient_id, m.doctor_id;`
  );
  console.log("medical_records:", r.rowsAffected ?? "n/a");

  // Walk-ins (role = 'covering' since walk-in doctors may not be the
  // patient's primary care).
  r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       w.patient_id, w.doctor_id, 'covering', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = w.patient_id),
       CURRENT_TIMESTAMP
     FROM walk_ins w
     WHERE NOT EXISTS (
       SELECT 1 FROM care_team_members c
       WHERE c.patient_id = w.patient_id
         AND c.doctor_id   = w.doctor_id
         AND c.role        = 'covering'
         AND c.status      = 'active'
     )
     GROUP BY w.patient_id, w.doctor_id;`
  );
  console.log("walk_ins (covering):", r.rowsAffected ?? "n/a");

  // Messages conversations (also primary_care — if a doctor and
  // patient have chatted, that's an active relationship).
  r = await sql.execute(
    `INSERT OR IGNORE INTO care_team_members
       (id, patient_id, doctor_id, role, scope, status, invited_by_user_id, accepted_at)
     SELECT
       lower(hex(randomblob(16))) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)),
       mc.patient_id, mc.doctor_id, 'primary_care', 'full', 'active',
       (SELECT user_id FROM patients WHERE id = mc.patient_id),
       CURRENT_TIMESTAMP
     FROM messages_conversations mc
     WHERE NOT EXISTS (
       SELECT 1 FROM care_team_members c
       WHERE c.patient_id = mc.patient_id
         AND c.doctor_id   = mc.doctor_id
         AND c.role        = 'primary_care'
         AND c.status      = 'active'
     )
     GROUP BY mc.patient_id, mc.doctor_id;`
  );
  console.log("messages_conversations:", r.rowsAffected ?? "n/a");

  // Final count.
  const cnt = await sql.execute(
    `SELECT COUNT(*) AS n FROM care_team_members WHERE status='active';`
  );
  console.log("Total active care team members:", cnt.rows[0]?.n ?? "?");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});