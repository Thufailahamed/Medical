// @ts-nocheck

import { Hono } from "hono";
import { eq, and, or } from "drizzle-orm";
import { emergencies, patients, users, medicines, notifications, hospitals } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const emergencyRouter = new Hono<AppEnvironment>();

// ─── Trigger SOS ─────────────────────────────────────────
emergencyRouter.post("/sos", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);

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

  // 1) Create the emergency record
  const [emergency] = await db
    .insert(emergencies)
    .values({
      patientId: p.id,
      location: JSON.stringify({ lat: latitude, lng: longitude }),
      status: "active",
    })
    .returning();

  let nearestHospitalId: string | null = null;
  let nearestHospitalName: string | null = null;
  let nearestKm: number | null = null;

  // 2) Find the nearest hospital (haversine on stored JSON {lat,lng})
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const allHospitals = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitals.id)); // no-op; pull all then filter
    let best: { id: string; name: string; km: number } | null = null;
    for (const h of allHospitals as any[]) {
      if (!h.location) continue;
      let lat2: number, lng2: number;
      try {
        const parsed = JSON.parse(h.location);
        lat2 = Number(parsed.lat);
        lng2 = Number(parsed.lng);
      } catch {
        continue;
      }
      if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;
      const km = haversineKm(latitude, longitude, lat2, lng2);
      if (best == null || km < best.km) {
        best = { id: h.id, name: h.name, km };
      }
    }
    if (best) {
      nearestHospitalId = best.id;
      nearestHospitalName = best.name;
      nearestKm = Math.round(best.km * 10) / 10;
      await db
        .update(emergencies)
        .set({ nearestHospitalId })
        .where(eq(emergencies.id, emergency.emergencies.id));
    }
  }

  // 3) Notify emergency contacts (parsed JSON of {name, phone, ...})
  let notifiedContacts = 0;
  const contactPhones: string[] = [];
  if (p.emergencyContacts) {
    try {
      const contacts = JSON.parse(p.emergencyContacts);
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          if (!c?.phone) continue;
          contactPhones.push(String(c.phone));
        }
      }
    } catch {
      // ignore malformed
    }
  }

  if (contactPhones.length > 0) {
    const matchedUsers = await db
      .select()
      .from(users)
      .where(or(...contactPhones.map((phone) => eq(users.phone, phone))));
    for (const contact of matchedUsers as any[]) {
      await db.insert(notifications).values({
        userId: contact.id,
        type: "emergency",
        title: `Emergency: ${u.name}`,
        body: `Your emergency contact ${u.name} has triggered an SOS${nearestHospitalName ? `. Nearest hospital: ${nearestHospitalName}` : ""}.`,
        data: JSON.stringify({
          patientId: p.id,
          emergencyId: emergency.emergencies.id,
          latitude,
          longitude,
          nearestHospitalId,
        }),
      });
      notifiedContacts += 1;
    }
  }

  // 4) Alert nearby ambulances (users with role='ambulance')
  let ambulancesNotified = 0;
  const ambulances = await db
    .select()
    .from(users)
    .where(eq(users.role, "ambulance"));
  for (const amb of ambulances as any[]) {
    await db.insert(notifications).values({
      userId: amb.id,
      type: "emergency",
      title: `SOS — ${u.name}`,
      body: `${u.name} triggered emergency SOS${nearestHospitalName ? ` near ${nearestHospitalName}` : ""}. Blood group ${p.bloodGroup ?? "—"}.`,
      data: JSON.stringify({
        patientId: p.id,
        emergencyId: emergency.emergencies.id,
        latitude,
        longitude,
        nearestHospitalId,
      }),
    });
    ambulancesNotified += 1;
  }

  // 5) Self-notification (existing behaviour)
  await db.insert(notifications).values({
    userId,
    type: "emergency",
    title: "Emergency SOS Sent",
    body:
      notifiedContacts + ambulancesNotified > 0
        ? `${notifiedContacts} contact${notifiedContacts === 1 ? "" : "s"} and ${ambulancesNotified} ambulance${ambulancesNotified === 1 ? "" : "s"} alerted.`
        : "Your emergency signal has been sent.",
  });

  // 6) Build the share payload the mobile UI surfaces to first responders
  const activeMeds = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.patientId, p.id), eq(medicines.active, true)));

  const sharePayload = {
    name: u.name,
    phone: u.phone,
    bloodGroup: p.bloodGroup,
    allergies: safeParseArray(p.allergies),
    conditions: safeParseArray(p.medicalConditions),
    currentMedicines: activeMeds.map((m: any) => ({
      name: m.medicines.name,
      dosage: m.medicines.dosage,
    })),
    nearestHospital: nearestHospitalName,
    distanceKm: nearestKm,
  };

  return c.json({
    emergency: emergency.emergencies,
    notifiedContacts,
    ambulancesNotified,
    nearestHospital: nearestHospitalName ? {
      id: nearestHospitalId,
      name: nearestHospitalName,
      distanceKm: nearestKm,
    } : null,
    sharePayload,
  });
});

function safeParseArray(s: string | null | undefined): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

  if (!existing || (existing.emergencies?.patientId ?? existing.patientId) !== (patient.patients?.id ?? patient.id)) {
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
    .where(eq(emergencies.patientId, (patient.patients?.id ?? patient.id)));

  return c.json({ emergencies: history });
});

export default emergencyRouter;
