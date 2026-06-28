// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { insurance, insuranceClaims, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const insuranceRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List my insurance policies ──────────────────────────
insuranceRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ insurance: [] });

  const rows = await db
    .select()
    .from(insurance)
    .where(eq(insurance.patientId, patientId))
    .orderBy(desc(insurance.createdAt));

  return c.json({ insurance: rows });
});

insuranceRouter.post("/", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  if (!body.providerName || !body.policyNumber) {
    return c.json({ error: "providerName and policyNumber required" }, 400);
  }

  const [row] = await db
    .insert(insurance)
    .values({
      patientId,
      providerName: body.providerName,
      policyNumber: body.policyNumber,
      coverageType: body.coverageType || null,
      expiryDate: body.expiryDate || null,
      maxCoverage: body.maxCoverage != null ? Number(body.maxCoverage) : null,
      documents: body.documents ? JSON.stringify(body.documents) : null,
    } as any)
    .returning();

  return c.json({ insurance: row }, 201);
});

insuranceRouter.delete("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id") as string;
  const [existing] = await db
    .select()
    .from(insurance)
    .where(and(eq(insurance.id, id), eq(insurance.patientId, patientId)))
    .limit(1);
  if (!existing) return c.json({ error: "Policy not found" }, 404);

  await db.delete(insurance).where(eq(insurance.id, id));
  return c.json({ message: "Policy removed" });
});

// ─── Claims ──────────────────────────────────────────────
insuranceRouter.get("/claims/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ claims: [] });

  const rows = await db
    .select()
    .from(insuranceClaims)
    .where(eq(insuranceClaims.patientId, patientId))
    .orderBy(desc(insuranceClaims.createdAt));

  return c.json({ claims: rows });
});

insuranceRouter.post("/claims", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  if (!body.insuranceId || !body.amount) {
    return c.json({ error: "insuranceId and amount required" }, 400);
  }

  // Verify the insurance belongs to this patient
  const [own] = await db
    .select()
    .from(insurance)
    .where(
      and(eq(insurance.id, body.insuranceId), eq(insurance.patientId, patientId))
    )
    .limit(1);
  if (!own) return c.json({ error: "Insurance policy not found" }, 404);

  const [row] = await db
    .insert(insuranceClaims)
    .values({
      insuranceId: body.insuranceId,
      patientId,
      hospitalId: body.hospitalId || null,
      appointmentId: body.appointmentId || null,
      amount: Number(body.amount),
      status: "submitted",
      documents: body.documents ? JSON.stringify(body.documents) : null,
      notes: body.notes || null,
    } as any)
    .returning();

  return c.json({ claim: row }, 201);
});

export default insuranceRouter;