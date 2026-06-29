// @ts-nocheck
// Time-limited shareable links for a patient's record.
// POST /share/links                  create
// GET  /share/links                  list mine
// DELETE /share/links/:id            revoke
// GET  /share/links/:id              fetch summary (no auth)

import { Hono } from "hono";
import { eq, and, desc, gt } from "drizzle-orm";
import {
  shareLinks,
  shareLinkViews,
  patients,
  medicalRecords,
  allergies,
  medicines,
  vitals,
  appointments,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const shareRouter = new Hono<AppEnvironment>();

const SCOPE_PRESETS: Record<string, string> = {
  all: "all",
  recent6m: "last6m",
};

function generateToken(): string {
  // 32-char URL-safe token
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// ─── Create share link ──────────────────────────────────
shareRouter.post("/links", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const expiresInHours = Math.min(
    Math.max(parseInt(body.expiresInHours || "168", 10), 1),
    24 * 30 // cap 30 days
  );
  const label = (body.label || "Shared record").toString().slice(0, 100);
  const scopeValue = body.scope || "all";
  const scope = JSON.stringify({ kind: scopeValue });

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(shareLinks)
    .values({
      patientId: patient.id,
      token,
      scope,
      label,
      expiresAt,
      revoked: false,
      createdBy: userId,
    } as any)
    .returning();

  return c.json({ link: row, token, url: `/share/${token}`, expiresAt }, 201);
});

// ─── List my share links ────────────────────────────────
shareRouter.get("/links", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ links: [] });

  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.patientId, patient.id))
    .orderBy(desc(shareLinks.createdAt));

  return c.json({ links: rows });
});

// ─── Revoke share link ──────────────────────────────────
shareRouter.delete("/links/:id", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(eq(shareLinks.id, id), eq(shareLinks.patientId, patient.id))
    )
    .limit(1);
  if (!existing) return c.json({ error: "Link not found" }, 404);

  await db
    .update(shareLinks)
    .set({ revoked: true })
    .where(eq(shareLinks.id, id));

  return c.json({ message: "Link revoked" });
});

// ─── PUBLIC: fetch by token (no auth) ───────────────────
shareRouter.get("/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);

  if (!link) return c.json({ error: "Invalid link" }, 404);
  if (link.revoked) return c.json({ error: "Link has been revoked" }, 410);
  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Link has expired" }, 410);
  }

  // Log view
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    null;
  const ua = c.req.header("user-agent") || null;
  await db
    .insert(shareLinkViews)
    .values({
      linkId: link.id,
      ip,
      userAgent: ua,
    } as any);

  // Bundle: profile, allergies, medicines, recent records (last 6mo)
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, link.patientId))
    .limit(1);

  const allr = await db
    .select()
    .from(allergies)
    .where(eq(allergies.patientId, link.patientId));

  const meds = await db
    .select()
    .from(medicines)
    .where(eq(medicines.patientId, link.patientId));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recs = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, link.patientId));

  const recentRecs = recs.filter((r: any) => {
    if (!r.recordDate) return true;
    return new Date(r.recordDate) >= sixMonthsAgo;
  });

  const appts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.patientId, link.patientId));

  return c.json({
    label: link.label,
    expiresAt: link.expiresAt,
    generatedAt: new Date().toISOString(),
    patient: patient
      ? {
          name: patient.fullName,
          dob: patient.dateOfBirth,
          bloodGroup: patient.bloodGroup,
          sex: patient.gender || patient.sex,
        }
      : null,
    allergies: allr,
    medicines: meds,
    records: recentRecs,
    appointments: appts,
  });
});

export default shareRouter;