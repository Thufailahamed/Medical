// @ts-nocheck

import { Hono } from "hono";
import { eq, or, like, desc, and, sql } from "drizzle-orm";
import { doctors, patients, users, medicalRecords, appointments, medicines, prescriptions, labOrders, walkIns, messagesConversations, hospitals, doctorAvailability, doctorTimeOff, prescriptionSignatures } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { topSeverity } from "../lib/safety-engine";
import { runSafetyCheck } from "../lib/safety-runner";
import { accessiblePatientsFor } from "../lib/access";
import { upsertActiveCareTeam, withStatusGuard } from "../lib/status-guard";
import { assertRxTransition } from "../lib/rxStatus";
import { renderPrescriptionPdf } from "../lib/prescription-pdf";
import { prescriptionPatchSchema, prescriptionCancelSchema } from "@healthcare/shared/validators";
import type { AppEnvironment } from "../types";

const doctorRouter = new Hono<AppEnvironment>();

// ─── Doctor dashboard ────────────────────────────────────
doctorRouter.get("/dashboard", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor profile not found" }, 404);
  }

  const today = new Date().toISOString().split("T")[0];

  const todaysAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctor.id),
        eq(appointments.date, today)
      )
    )
    .orderBy(appointments.queueNumber);

  // P0 audit fix + Phase 1 care team: previously this only counted
  // patients with a medical_records row authored by THIS doctor.
  // Now uses accessiblePatientsFor() which unions care_team_members
  // (active) with the six evidence tables. Care-team-only patients
  // (no appointments yet, but added to team) now show up.
  const patientIds = await accessiblePatientsFor(db, userId, "doctor");

  return c.json({
    doctor,
    stats: {
      todayAppointments: todaysAppointments.length,
      totalPatients: patientIds.length,
    },
    todaysAppointments,
  });
});

// ─── Search patients ─────────────────────────────────────
//
// P0 audit fix: this endpoint previously returned up to 20 arbitrary
// patients matching the LIKE query, regardless of whether the doctor
// had ever treated them. Now we restrict results to patients the
// doctor has at least one of: appointment, prescription, lab order,
// medical record, walk-in, active messaging conversation, OR an
// active care-team row pointing at this doctor. Hospital admin/staff
// still get the unscoped search via /walk-ins/search.
doctorRouter.get("/search-patients", authMiddleware, requireRole("doctor"), async (c) => {
  const query = c.req.query("q");
  const db = c.get("db");
  const userId = c.get("userId");
  const recent = c.req.query("recent") === "1";
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10) || 20));

  // Recent mode: return the doctor's most-recently-visited accessible patients.
  if (recent) {
    const accessibleIds = await accessiblePatientsFor(db, userId, "doctor");
    if (accessibleIds.length === 0) return c.json({ patients: [] });

    const rows = await db
      .select({
        patient: patients,
        user: users,
        lastVisitAt: sql<string | null>`MAX(${appointments.createdAt})`.as("lastVisitAt"),
      })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .leftJoin(
        appointments,
        and(
          eq(appointments.patientId, patients.id),
          eq(appointments.doctorId, sql`(SELECT id FROM doctors WHERE user_id = ${userId} LIMIT 1)`)
        )
      )
      .where(
        sql`${patients.id} IN (${sql.join(
          accessibleIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .groupBy(patients.id, users.id)
      .orderBy(sql`MAX(${appointments.createdAt}) DESC NULLS LAST, ${users.name} ASC`)
      .limit(limit);

    return c.json({ patients: rows, count: rows.length });
  }

  if (!query || query.length < 2) {
    return c.json({ patients: [] });
  }

  // Sanitize query to prevent injection
  const safeQuery = query.replace(/[%_]/g, "\\$&");

  // Phase 1 care team: include care_team_members in the access set so
  // patients who added this doctor but haven't visited yet are still
  // findable by name/NIC/phone.
  const accessibleIds = await accessiblePatientsFor(db, userId, "doctor");
  if (accessibleIds.length === 0) return c.json({ patients: [] });

  const results = await db
    .select({
      patient: patients,
      user: users,
    })
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      and(
        or(
          like(users.name, `%${safeQuery}%`),
          like(users.nic, `%${safeQuery}%`),
          like(users.phone, `%${safeQuery}%`)
        ),
        sql`${patients.id} IN (${sql.join(
          accessibleIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .limit(20);

  return c.json({ patients: results });
});

// ─── Create prescription ─────────────────────────────────
//
// Body accepts BOTH item shapes so the two clients stay compatible:
//   - web composer sends `items` (shared prescriptionCreateSchema:
//     durationDays / ongoing / instructions)
//   - mobile composer sends `medicines` (startDate / endDate / notes)
// Both are normalized into `medicines` rows linked to the new
// prescription.
doctorRouter.post("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));

  if (!body.patientId || typeof body.patientId !== "string") {
    return c.json({ error: "patientId is required" }, 400);
  }

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  // Normalize items → the medicines-row shape. `items` (web) carries
  // durationDays/ongoing/instructions; `medicines` (mobile) carries
  // startDate/endDate directly.
  const today = new Date().toISOString().split("T")[0];
  const rawItems: any[] = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.medicines)
      ? body.medicines
      : [];
  const normalizedMeds = rawItems
    .filter((it: any) => it && typeof it.name === "string" && it.name.trim())
    .map((it: any) => {
      const startDate = it.startDate || today;
      const endDate =
        it.endDate ??
        (it.ongoing
          ? null
          : typeof it.durationDays === "number" && it.durationDays > 0
            ? addDays(startDate, it.durationDays)
            : null);
      return {
        name: String(it.name).trim(),
        dosage: it.dosage ? String(it.dosage) : "",
        frequency: it.frequency ? String(it.frequency) : null,
        timing: it.timing ? String(it.timing) : null,
        startDate,
        endDate,
        notes: it.instructions ? String(it.instructions) : null,
        masterMedicineId: it.masterMedicineId ?? null,
      };
    });

  // Phase E-Rx 3: safety pre-flight. Mirrors the pattern in
  // `medicines.ts POST /` so doctors see the same 409 confirmation
  // when a candidate Rx would hit a critical allergy, severe
  // interaction, or duplicate-therapy wall. X-Confirm-Warning carries
  // the explicit override after the doctor acknowledges in the UI.
  const candidateMeds = normalizedMeds.map((m) => ({
    name: m.name,
    dosage: m.dosage || undefined,
    masterMedicineId: m.masterMedicineId,
  }));
  const safetyWarnings = await runSafetyCheck(db, body.patientId, candidateMeds);
  const safetyTop = topSeverity(safetyWarnings);
  const override = c.req.header("X-Confirm-Warning") === "true";
  const BLOCKING = (w: { severity: string }) =>
    w.severity === "severe" || w.severity === "critical";
  if (safetyTop && BLOCKING({ severity: safetyTop }) && !override) {
    return c.json(
      {
        error: "Safety warning",
        requiresConfirmation: true,
        warnings: safetyWarnings,
        severity: safetyTop,
        message: `Severe safety warning detected (${safetyTop}). Confirm to proceed.`,
      },
      409
    );
  }

  // Create prescription record in prescriptions table
  const [prescription] = await db
    .insert(prescriptions)
    .values({
      doctorId: doctor.id,
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: today,
      // Phase E-Rx 6: lifecycle default. The route always writes
      // "draft" — only POST /sign can flip to "signed"; clients cannot
      // supply `status`.
    })
    .returning();

  // Phase E-Rx 3: audit when the doctor overrode safety warnings.
  // Captures the full warning set in `details` so reviewers can audit
  // overrides without re-running the engine against stale state.
  if (override && safetyWarnings.length) {
    await audit(db, {
      userId,
      action: "prescription.create_with_warnings",
      resource: "prescription",
      resourceId: prescription?.id,
      details: {
        severity: safetyTop,
        warnings: safetyWarnings,
      },
    });
  }

  // Create medical record (prescription type) linked to the patient
  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      doctorId: doctor.id,
      recordType: "prescription",
      title: `Prescription - ${body.diagnosis || "General"}`,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: today,
    })
    .returning();

  // Create medicines linked to the prescription
  if (normalizedMeds.length > 0) {
    await db.insert(medicines).values(
      normalizedMeds.map((med) => ({
        patientId: body.patientId,
        prescriptionId: prescription.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        timing: med.timing,
        startDate: med.startDate,
        endDate: med.endDate,
        notes: med.notes,
        // Phase E-Rx 1: optional master FK. Doctors picking from the
        // autocomplete carry this; free-text entries stay NULL.
        masterMedicineId: med.masterMedicineId,
      }))
    );
  }

  // Phase 1: backfill care team. Idempotent — won't overwrite an
  // existing primary_care or specialist row.
  await upsertActiveCareTeam(db, {
    patientId: body.patientId,
    doctorId: doctor.id,
    role: "primary_care",
    invitedByUserId: userId,
  });

  return c.json({ prescription }, 201);
});

// ─── Edit draft prescription (Phase E-Rx 8) ────────────────
//
// PATCH /doctor/prescriptions/:id
//   role=doctor. Allowed source state: ["draft"] only — once the
//   prescription is signed, the payload hash on the signature row
//   would no longer match the row contents, so the edit surface must
//   be closed. Doctors wanting to "change" a signed Rx have to cancel
//   it and write a new one.
//
//   Body: { diagnosis?, notes?, items? } validated against
//   prescriptionPatchSchema from @healthcare/shared/validators.
//   Re-runs the safety pre-flight against the patientId (immutable
//   on the row) + the patched items; returns 409 with
//   `requiresConfirmation: true` if the patched item list hits a
//   severe/critical warning and the client didn't ack via
//   X-Confirm-Warning.
//
//   On success: updates the prescriptions row, mirrors the changes
//   onto the linked medical_records row, deletes+re-inserts the
//   medicines rows (so previous doses + safety runs are clean),
//   and writes a `prescription.edited` audit row with the diff
//   summary in `details`.
doctorRouter.patch(
  "/prescriptions/:id",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const parsed = prescriptionPatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid patch body", issues: parsed.error.flatten() },
        400
      );
    }
    const patch = parsed.data;

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ error: "Doctor not found" }, 404);

    const [existing] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Prescription not found" }, 404);
    if (existing.doctorId !== doctor.id) {
      return c.json({ error: "Not your prescription" }, 403);
    }
    if (existing.status !== "draft") {
      return c.json(
        {
          error: "Only draft prescriptions can be edited",
          status: existing.status,
          prescriptionId: id,
        },
        409
      );
    }

    // Build the merged medicines list so safety re-runs against the
    // final state. If the client didn't touch `items`, re-use the
    // existing ones.
    let nextItems: Array<{
      name: string;
      dosage?: string;
      frequency: string;
      timing?: string;
      durationDays?: number;
      ongoing?: boolean;
      instructions?: string;
      masterMedicineId?: string | null;
    }> = [];
    if (patch.items) {
      nextItems = patch.items;
    } else {
      const existingMeds = await db
        .select()
        .from(medicines)
        .where(eq(medicines.prescriptionId, id));
      nextItems = existingMeds.map((m: any) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency ?? "OD",
        timing: m.timing,
        durationDays: undefined,
        ongoing: !m.endDate,
        instructions: m.notes,
        masterMedicineId: m.masterMedicineId,
      }));
    }

    // Safety re-run when items are present.
    if (patch.items && nextItems.length > 0) {
      const candidateMeds = nextItems.map((i) => ({
        name: i.name,
        dosage: i.dosage,
        masterMedicineId: i.masterMedicineId ?? null,
      }));
      const safetyWarnings = await runSafetyCheck(
        db,
        existing.patientId,
        candidateMeds
      );
      const safetyTop = topSeverity(safetyWarnings);
      const override = c.req.header("X-Confirm-Warning") === "true";
      const BLOCKING = (w: { severity: string }) =>
        w.severity === "severe" || w.severity === "critical";
      if (safetyTop && BLOCKING({ severity: safetyTop }) && !override) {
        return c.json(
          {
            error: "Safety warning",
            requiresConfirmation: true,
            warnings: safetyWarnings,
            severity: safetyTop,
            message: `Severe safety warning detected (${safetyTop}). Confirm to proceed.`,
          },
          409
        );
      }
      if (override && safetyWarnings.length) {
        await audit(db, {
          userId,
          action: "prescription.edit_with_warnings",
          resource: "prescription",
          resourceId: id,
          details: { severity: safetyTop, warnings: safetyWarnings },
        });
      }
    }

    // Compose the prescription update.
    const update: Record<string, any> = {};
    if (patch.diagnosis !== undefined) update.diagnosis = patch.diagnosis;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (Object.keys(update).length > 0) {
      update.updatedAt = new Date().toISOString();
      await db
        .update(prescriptions)
        .set(update)
        .where(eq(prescriptions.id, id));
    }

    // The medical_records row created in POST /prescriptions has no FK
    // back to the prescription (intentional — it's a parallel chart
    // log). We don't try to mirror edits to it; the doctor can always
    // look at the prescription directly. Audit row carries the diff.

    // If items changed, replace them. Otherwise leave the original rows.
    if (patch.items) {
      await db.delete(medicines).where(eq(medicines.prescriptionId, id));
      const today = new Date().toISOString().slice(0, 10);
      await db.insert(medicines).values(
        nextItems.map((it) => {
          const startDate = today;
          const endDate = it.ongoing
            ? null
            : it.durationDays
              ? addDays(today, it.durationDays)
              : null;
          return {
            patientId: existing.patientId,
            prescriptionId: id,
            name: it.name,
            dosage: it.dosage || null,
            frequency: it.frequency,
            timing: it.timing || null,
            startDate,
            endDate,
            masterMedicineId: it.masterMedicineId ?? null,
            notes: it.instructions || null,
          };
        })
      );
    }

    await audit(db, {
      userId,
      action: "prescription.edited",
      resource: "prescription",
      resourceId: id,
      details: {
        diagnosisChanged: patch.diagnosis !== undefined,
        notesChanged: patch.notes !== undefined,
        itemsChanged: patch.items !== undefined,
        itemCount: nextItems.length,
      },
    });

    return c.json({ prescriptionId: id, ok: true });
  }
);

// ─── Cancel prescription (Phase E-Rx 8) ───────────────────
//
// POST /doctor/prescriptions/:id/cancel
//   role=doctor. Allowed source states: ["draft", "signed"]. We
//   intentionally do NOT allow cancelling a `dispensed` Rx — once a
//   pharmacy has logged a dispense event, the audit chain is fixed.
//
//   Body: { reason? } validated by prescriptionCancelSchema. Audit
//   row `prescription.cancelled` carries the reason so reviewers can
//   see why the doctor voided the prescription.
doctorRouter.post(
  "/prescriptions/:id/cancel",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const parsed = prescriptionCancelSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid cancel body", issues: parsed.error.flatten() },
        400
      );
    }

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ error: "Doctor not found" }, 404);

    const [existing] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Prescription not found" }, 404);
    if (existing.doctorId !== doctor.id) {
      return c.json({ error: "Not your prescription" }, 403);
    }
    if (existing.status === "cancelled") {
      return c.json({ error: "Already cancelled", prescriptionId: id }, 409);
    }
    if (existing.status === "dispensed") {
      return c.json(
        {
          error: "Cannot cancel a dispensed prescription",
          status: existing.status,
          prescriptionId: id,
        },
        409
      );
    }

    // Atomic status guard accepts both draft and signed as source
    // states. If a concurrent request already moved past them, the
    // guard returns changed=false and we 409.
    const guard = await withStatusGuard(
      db,
      prescriptions,
      id,
      ["draft", "signed"],
      {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancellationReason: parsed.data.reason ?? null,
      }
    );
    if (!guard.changed) {
      return c.json(
        { error: "Prescription state changed during request", prescriptionId: id },
        409
      );
    }

    await audit(db, {
      userId,
      action: "prescription.cancelled",
      resource: "prescription",
      resourceId: id,
      details: { from: existing.status, reason: parsed.data.reason ?? null },
    });

    return c.json({ prescriptionId: id, status: "cancelled", ok: true });
  }
);

// ─── Dispense prescription (Phase E-Rx 8) ────────────────
//
// POST /doctor/prescriptions/:id/dispense
//   role=doctor. In production this would be `requireRole("pharmacy")`
//   but the pharmacy role is not yet wired into the client surfaces,
//   so doctor-only is the conservative default — the schema enum
//   already supports it. Allowed source: ["signed"] only.
//
//   Body: empty. Audit row `prescription.dispensed` carries the
//   timestamp; the existing signature row remains valid so the
//   verify endpoint keeps working post-dispense.
doctorRouter.post(
  "/prescriptions/:id/dispense",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ error: "Doctor not found" }, 404);

    const [existing] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Prescription not found" }, 404);
    if (existing.doctorId !== doctor.id) {
      return c.json({ error: "Not your prescription" }, 403);
    }

    const guard = await withStatusGuard(db, prescriptions, id, ["signed"], {
      status: "dispensed",
      dispensedAt: new Date().toISOString(),
    });
    if (!guard.changed) {
      return c.json(
        {
          error: "Prescription is not in 'signed' state",
          status: existing.status,
          prescriptionId: id,
        },
        409
      );
    }

    await audit(db, {
      userId,
      action: "prescription.dispensed",
      resource: "prescription",
      resourceId: id,
      details: { dispensedAt: guard.row?.dispensedAt },
    });

    return c.json({
      prescriptionId: id,
      status: "dispensed",
      ok: true,
    });
  }
);

/** Helper: add `n` days to a YYYY-MM-DD string, return YYYY-MM-DD. */
function addDays(yyyymmdd: string, n: number): string {
  const d = new Date(yyyymmdd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Get doctor's prescriptions ──────────────────────────
//
// Reads the canonical `prescriptions` table (NOT the medical_records
// chart mirror) so the row `id` matches what the detail / sign /
// cancel / PDF endpoints expect, `status` uses the real Rx lifecycle
// enum (draft|signed|cancelled|dispensed), and medicine counts join
// on the right foreign key.
doctorRouter.get("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patientId = c.req.query("patientId") || undefined;
  const status = c.req.query("status") || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query("limit") || "200", 10) || 200));

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  const conditions: any[] = [eq(prescriptions.doctorId, doctor.id)];
  if (patientId) {
    conditions.push(eq(prescriptions.patientId, patientId));
  }
  if (status) {
    conditions.push(eq(prescriptions.status, status));
  }

  const rows = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      doctorId: prescriptions.doctorId,
      diagnosis: prescriptions.diagnosis,
      notes: prescriptions.notes,
      date: prescriptions.date,
      createdAt: prescriptions.createdAt,
      status: prescriptions.status,
      signedAt: prescriptions.signedAt,
      patientName: users.name,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(patients.id, prescriptions.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(...conditions))
    .orderBy(desc(prescriptions.date), desc(prescriptions.createdAt))
    .limit(limit);

  // Medicine count per prescription in one grouped query.
  let medCountMap = new Map<string, number>();
  if (rows.length) {
    const medRows = await db
      .select({
        prescriptionId: medicines.prescriptionId,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(medicines)
      .where(
        sql`${medicines.prescriptionId} IN (${sql.join(
          rows.map((r) => sql`${r.id}`),
          sql`, `
        )})`
      )
      .groupBy(medicines.prescriptionId);
    for (const m of medRows) {
      if (m.prescriptionId) medCountMap.set(m.prescriptionId, Number(m.count) || 0);
    }
  }

  const enriched = rows.map(({ patientName, ...r }) => ({
    ...r,
    // `title` kept for clients that render medical-record-style rows.
    title: r.diagnosis ? `Prescription - ${r.diagnosis}` : "Prescription",
    patient: { id: r.patientId, name: patientName },
    medicineCount: medCountMap.get(r.id) ?? 0,
  }));

  return c.json({ prescriptions: enriched, count: enriched.length });
});

// ─── Single prescription detail (Phase 3.1 slice 2) ─────────
// Powers /doctor/prescription-detail on mobile. Mirrors the PDF route's
// joins so the screen sees the same doctor + patient + medicine shape
// as the rendered document. Ordered BEFORE the :id/pdf route so Hono
// matches the literal "/:id" before the longer "/:id/pdf" pattern.
doctorRouter.get(
  "/prescriptions/:id",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");

    const [row] = await db
      .select({
        id: prescriptions.id,
        patientId: prescriptions.patientId,
        hospitalId: prescriptions.hospitalId,
        diagnosis: prescriptions.diagnosis,
        notes: prescriptions.notes,
        date: prescriptions.date,
        createdAt: prescriptions.createdAt,
        status: prescriptions.status,
        signedAt: prescriptions.signedAt,
        signedPayloadHash: prescriptions.signedPayloadHash,
        doctorUserId: doctors.userId,
        doctorName: users.name,
        doctorSpecialization: doctors.specialization,
        doctorSlmcNo: doctors.slmcRegistrationNo,
        doctorSlmcVerifiedAt: doctors.slmcVerifiedAt,
      })
      .from(prescriptions)
      .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(eq(prescriptions.id, id))
      .limit(1);

    if (!row) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (row.doctorUserId !== userId) {
      return c.json({ error: "Not your prescription" }, 403);
    }

    const [patientUser] = await db
      .select({ name: users.name, nic: users.nic })
      .from(users)
      .innerJoin(patients, eq(patients.userId, users.id))
      .where(eq(patients.id, row.patientId))
      .limit(1);

    const medRows = await db
      .select()
      .from(medicines)
      .where(eq(medicines.prescriptionId, id));

    return c.json({
      prescription: {
        ...row,
        patient: patientUser
          ? { name: patientUser.name, nic: patientUser.nic }
          : null,
        // `instructions` aliases the medicines.notes column — the web
        // composer/detail read that name (shared validator field).
        medicines: medRows.map((m: any) => ({ ...m, instructions: m.notes })),
      },
    });
  }
);

// ─── Prescription PDF (Phase 3.1 slice 2) ─────────────────
// Server-rendered A4 PDF streamed back as application/pdf. Re-rendered
// per request — pdf-lib output is cheap and we have no retention use
// case yet. When the patient-side "view my prescriptions" flow lands in
// Phase 3.2 we'll add a "first-render" cache.
doctorRouter.get(
  "/prescriptions/:id/pdf",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");

    const [owner] = await db
      .select({ doctorUserId: doctors.userId })
      .from(prescriptions)
      .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
      .where(eq(prescriptions.id, id))
      .limit(1);

    if (!owner) {
      return c.json({ error: "Prescription not found" }, 404);
    }
    if (owner.doctorUserId !== userId) {
      return c.json({ error: "Not your prescription" }, 403);
    }

    const publicUrl =
      c.env.PUBLIC_URL || "https://app.healthhub.app";
    const result = await renderPrescriptionPdf(db, id, publicUrl);
    if (!result.ok) {
      return c.json(
        { error: result.error, ...(result.details ?? {}) },
        result.status
      );
    }

    return c.body(result.bytes, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="prescription-${result.shortId}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  }
);

// ─── Doctor profile ──────────────────────────────────────
doctorRouter.get("/me", authMiddleware, requireRole("doctor"), async (c) => {
  const dbUser = c.get("dbUser");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.userId, dbUser.id))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  return c.json({ doctor });
});

// ─── Search doctors (public to logged-in users) ──────────
// Used by the patient booking flow to find a doctor by name / specialization.
doctorRouter.get("/search", authMiddleware, async (c) => {
  const db = c.get("db");
  const query = (c.req.query("query") || "").trim();
  const specialization = (c.req.query("specialization") || "").trim();
  const hospitalId = (c.req.query("hospitalId") || "").trim();

  const conditions: any[] = [];
  if (query) {
    const safe = query.replace(/[%_]/g, "\\$&");
    conditions.push(like(users.name, `%${safe}%`));
  }
  if (specialization) {
    conditions.push(eq(doctors.specialization, specialization));
  }
  if (hospitalId) {
    conditions.push(eq(doctors.hospitalId, hospitalId));
  }

  const baseQuery = db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      photo: users.photo,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id));

  const rows = conditions.length
    ? await baseQuery.where(and(...conditions)).limit(50)
    : await baseQuery.limit(50);

  return c.json({ doctors: rows });
});

// ─── List all distinct specializations ───────────────────
doctorRouter.get("/specialties", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .selectDistinct({ specialization: doctors.specialization })
    .from(doctors);
  const specialties = rows
    .map((r: any) => r.specialization)
    .filter((s: string | null | undefined): s is string => !!s && s.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
  return c.json({ specialties });
});

// ─── Doctor detail ───────────────────────────────────────
doctorRouter.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const db = c.get("db");

  const [row] = await db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      photo: users.photo,
      phone: users.phone,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      registrationNumber: doctors.registrationNumber,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
      hospitalAddress: hospitals.address,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .where(eq(doctors.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Doctor not found" }, 404);
  return c.json({ doctor: row });
});

// ─── Doctor availability for a date ──────────────────────
// Reads doctorAvailability rows and counts appointments already booked that
// day, returning a slot list the booking UI can show.
doctorRouter.get("/:id/availability", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];
  const db = c.get("db");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);

  const day = new Date(date + "T00:00:00");
  if (Number.isNaN(day.getTime())) {
    return c.json({ error: "Invalid date" }, 400);
  }
  const dow = day.getDay();

  // Doctor's working hours for that weekday, if set
  const hours = await db
    .select()
    .from(doctorAvailability)
    .where(
      and(
        eq(doctorAvailability.doctorId, id),
        eq(doctorAvailability.dayOfWeek, dow),
        eq(doctorAvailability.active, true)
      )
    );

  // Time-off blocks for that specific date (full-day or partial)
  const offs = await db
    .select()
    .from(doctorTimeOff)
    .where(and(eq(doctorTimeOff.doctorId, id), eq(doctorTimeOff.date, date)));

  // Existing booked appointments that day
  const booked = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, id),
        eq(appointments.date, date)
      )
    );

  const bookedTimes = new Set(
    booked
      .filter((b: any) => b.status !== "cancelled" && b.status !== "no_show")
      .map((b: any) => b.time)
  );

  // Build candidate slots from working hours or default 09:00-17:00
  const slots: {
    time: string;
    available: boolean;
    queueNumber?: number;
    reason?: "time_off" | "past" | "full";
    slotMinutes: number;
  }[] = [];
  const MAX_PER_SLOT = 4;

  // Use the minimum configured slot minutes across the day's working hours
  // (or 30 by default). All ranges share the same granularity per doctor.
  const slotMinutes = hours.length > 0
    ? Math.max(5, Math.min(...hours.map((h: any) => h.slotMinutes || 30)))
    : 30;

  const ranges =
    hours.length > 0
      ? hours.map((h: any) => ({ start: h.startTime, end: h.endTime }))
      : [{ start: "09:00", end: "17:00" }];

  const queueCountFor = (t: string) =>
    booked.filter(
      (b: any) =>
        b.time === t &&
        b.status !== "cancelled" &&
        b.status !== "no_show"
    ).length;

  // Past-time check (only when querying "today")
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;
  const nowMin = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();

  const minutesOf = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const inAnyTimeOff = (t: string): boolean => {
    if (!offs.length) return false;
    const m = minutesOf(t);
    return offs.some((o: any) => {
      if (!o.startTime && !o.endTime) return true; // all day
      const s = o.startTime ? minutesOf(o.startTime) : 0;
      const e = o.endTime ? minutesOf(o.endTime) : 24 * 60;
      return m >= s && m < e;
    });
  };

  for (const r of ranges) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + slotMinutes <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      const t = `${hh}:${mm}`;

      if (inAnyTimeOff(t)) {
        slots.push({ time: t, available: false, reason: "time_off", slotMinutes });
        cur += slotMinutes;
        continue;
      }

      if (isToday && cur <= nowMin) {
        slots.push({ time: t, available: false, reason: "past", slotMinutes });
        cur += slotMinutes;
        continue;
      }

      const count = queueCountFor(t);
      const available = count < MAX_PER_SLOT;
      slots.push({
        time: t,
        available,
        queueNumber: count + 1,
        reason: available ? undefined : "full",
        slotMinutes,
      });
      cur += slotMinutes;
    }
  }

  return c.json({
    date,
    slots,
    bookedTimes: Array.from(bookedTimes),
    slotMinutes,
    offCount: offs.length,
  });
});

export default doctorRouter;
