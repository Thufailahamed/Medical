import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { emergencies, patients, users, medicines, notifications } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const emergencyRouter = new Hono<AppEnvironment>();

// ─── Trigger SOS ─────────────────────────────────────────
emergencyRouter.post("/sos", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const { latitude, longitude } = await c.req.json();

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  // Create emergency record
  const [emergency] = await db
    .insert(emergencies)
    .values({
      patientId: patient.patients.id,
      location: JSON.stringify({ lat: latitude, lng: longitude }),
      status: "active",
    })
    .returning();

  // TODO: Find nearest hospital using coordinates
  // TODO: Send push notification to emergency contacts
  // TODO: Alert nearby ambulances
  // TODO: Share medical history (blood group, allergies, medicines)

  // Create notification for the patient
  await db.insert(notifications).values({
    userId,
    type: "emergency",
    title: "Emergency SOS Sent",
    body: "Your emergency signal has been sent. Help is on the way.",
  });

  return c.json({
    emergency,
    message: "Emergency signal sent. Help is on the way.",
  });
});

// ─── Generate Emergency QR data ──────────────────────────
emergencyRouter.get("/qr", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const p = patient.patients;
  const u = patient.users;

  // Fetch active medicines
  const activeMeds = await db
    .select()
    .from(medicines)
    .where(
      and(
        eq(medicines.patientId, p.id),
        eq(medicines.active, true)
      )
    );

  const qrData = {
    name: u.name,
    bloodGroup: p.bloodGroup,
    allergies: p.allergies ? JSON.parse(p.allergies) : [],
    medicalConditions: p.medicalConditions ? JSON.parse(p.medicalConditions) : [],
    emergencyContacts: p.emergencyContacts ? JSON.parse(p.emergencyContacts) : [],
    currentMedicines: activeMeds.map((m) => ({
      name: m.medicines.name,
      dosage: m.medicines.dosage,
    })),
    dateOfBirth: p.dateOfBirth,
    phone: u.phone,
  };

  return c.json({ qrData });
});

// ─── Update emergency status (with ownership check) ──────
emergencyRouter.put("/:id/status", authMiddleware, async (c) => {
  const emergencyId = c.req.param("id");
  const userId = c.get("userId");
  const { status } = await c.req.json();
  const db = c.get("db");

  // Only the patient who triggered it or ambulance can update
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [existing] = await db
    .select()
    .from(emergencies)
    .where(eq(emergencies.id, emergencyId))
    .limit(1);

  if (!existing || existing.emergencies.patientId !== patient.patients.id) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [updated] = await db
    .update(emergencies)
    .set({ status })
    .where(eq(emergencies.id, emergencyId))
    .returning();

  return c.json({ emergency: updated });
});

// ─── Get my emergencies ──────────────────────────────────
emergencyRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ emergencies: [] });
  }

  const history = await db
    .select()
    .from(emergencies)
    .where(eq(emergencies.patientId, patient.patients.id));

  return c.json({ emergencies: history });
});

export default emergencyRouter;
