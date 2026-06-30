// @ts-nocheck

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { patients, users, familyMembers } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { patientProfileSchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const patientsRouter = new Hono<AppEnvironment>();

// ─── Get my profile ──────────────────────────────────────
patientsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient profile not found" }, 404);
  }

  return c.json({ patient });
});

// ─── Update my profile (with ownership verification) ─────
patientsRouter.put("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = patientProfileSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const data = parsed.data;

  // Verify the patient belongs to this user
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  // Double check: the patient record must belong to this user
  if ((patient.patients?.userId ?? patient.userId) !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [updated] = await db
    .update(patients)
    .set({
      bloodGroup: data.bloodGroup,
      height: data.height,
      weight: data.weight,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      allergies: data.allergies ? JSON.stringify(data.allergies) : undefined,
      medicalConditions: data.medicalConditions ? JSON.stringify(data.medicalConditions) : undefined,
      emergencyContacts: data.emergencyContacts ? JSON.stringify(data.emergencyContacts) : undefined,
      lifestyle: data.lifestyle ? JSON.stringify(data.lifestyle) : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(patients.id, (patient.patients?.id ?? patient.id)))
    .returning();

  return c.json({ patient: updated });
});

// ─── Get patient by ID (doctors, hospitals) ──────────────
patientsRouter.get("/:id", authMiddleware, requireRole("doctor", "hospital_admin", "hospital_staff"), async (c) => {
  const patientId = c.req.param("id");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  return c.json({ patient });
});

// ─── Family Members ──────────────────────────────────────
patientsRouter.get("/me/family", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const family = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.patientId, (patient.patients?.id ?? patient.id)));

  return c.json({ family });
});

patientsRouter.post("/me/family", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const [member] = await db
    .insert(familyMembers)
    .values({
      patientId: (patient.patients?.id ?? patient.id),
      name: body.name,
      relationship: body.relationship,
      dateOfBirth: body.dateOfBirth,
      bloodGroup: body.bloodGroup,
      allergies: body.allergies ? JSON.stringify(body.allergies) : undefined,
      medicalConditions: body.medicalConditions ? JSON.stringify(body.medicalConditions) : undefined,
      phone: body.phone,
      conditions: body.conditions ? JSON.stringify(body.conditions) : null,
      isDeceased: body.isDeceased ? 1 : 0,
      causeOfDeath: body.causeOfDeath || null,
      notes: body.notes || null,
    })
    .returning();

  return c.json({ member }, 201);
});

// ─── Delete family member (with ownership check) ─────────
patientsRouter.delete("/me/family/:memberId", authMiddleware, requireRole("patient"), async (c) => {
  const memberId = c.req.param("memberId");
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  // Verify the family member belongs to this patient
  const [member] = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.id, memberId),
        eq(familyMembers.patientId, (patient.patients?.id ?? patient.id))
      )
    )
    .limit(1);

  if (!member) {
    return c.json({ error: "Family member not found or access denied" }, 404);
  }

  await db.delete(familyMembers).where(eq(familyMembers.id, memberId));

  return c.json({ message: "Family member removed" });
});

export default patientsRouter;
