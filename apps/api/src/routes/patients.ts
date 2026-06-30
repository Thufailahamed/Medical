// @ts-nocheck

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { patients, users, familyMembers } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { patientProfileSchema, familyMemberSchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import { writeAudit } from "../lib/audit";
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

  // Phase 2.3: include active FM so the client can rehydrate its store
  // on boot without an extra round-trip.
  const [u] = await db
    .select({ activeFamilyMemberId: users.activeFamilyMemberId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return c.json({
    patient,
    activeFamilyMemberId: u?.activeFamilyMemberId ?? null,
  });
});

// ─── Update my preferred locale (Phase 2.2.1) ────────────
// Lightweight PATCH so the mobile locale store change can sync up so the
// vaccination-cron push body is localized. Validates against the same
// supported set as `lib/locale.ts`.
patientsRouter.patch("/me/locale", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const raw = typeof body?.locale === "string" ? body.locale : "";
  if (!["en", "si", "ta"].includes(raw)) {
    return c.json({ error: "Unsupported locale" }, 400);
  }

  await db
    .update(users)
    .set({ preferredLocale: raw } as any)
    .where(eq(users.id, userId));

  return c.json({ ok: true, locale: raw });
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
  const body = await c.req.json().catch(() => ({}));

  const parsed = familyMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400,
    );
  }
  const data = parsed.data;

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
      patientId: patient.patients?.id ?? patient.id,
      name: data.name,
      relationship: data.relationship,
      dateOfBirth: data.dateOfBirth || null,
      bloodGroup: data.bloodGroup,
      allergies: data.allergies ? JSON.stringify(data.allergies) : undefined,
      medicalConditions: data.medicalConditions ? JSON.stringify(data.medicalConditions) : undefined,
      phone: data.phone,
      conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      isDeceased: data.isDeceased ? 1 : 0,
      causeOfDeath: data.causeOfDeath || null,
      notes: data.notes || null,
    })
    .returning();

  // Phase 2.3.1: audit self-composed family_members rows so the audit
  // trail includes both self-add (here) and invite-accepted (in
  // routes/family-invites.ts).
  await writeAudit(db, {
    userId,
    action: "family_member_added",
    resource: "family_member",
    resourceId: member?.id ?? null,
    details: { from: "self_compose", name: data.name, relationship: data.relationship },
  });

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

  const removed = member;

  await db.delete(familyMembers).where(eq(familyMembers.id, memberId));

  // Phase 2.3.1: audit removal. `name` + `relationship` are captured for
  // the audit trail even though the row is gone.
  await writeAudit(db, {
    userId,
    action: "family_member_removed",
    resource: "family_member",
    resourceId: removed.id,
    details: { name: removed.name, relationship: removed.relationship },
  });

  return c.json({ message: "Family member removed" });
});

export default patientsRouter;
