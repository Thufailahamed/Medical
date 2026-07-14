// @ts-nocheck

import { Hono } from "hono";
import { eq, and, or } from "drizzle-orm";
import {
  emergencies,
  patients,
  users,
  medicines,
  notifications,
  hospitals,
  qrAccessTokens,
  allergies,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { resolvePatientContext } from "../lib/caretaker";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";
import { notify } from "../lib/notifications";

const emergencyRouter = new Hono<AppEnvironment>();

// ─── Trigger SOS ─────────────────────────────────────────
// Patient-only. SOS is initiated by the person who needs help; remote
// caretakers must not trigger emergency services silently on someone's
// behalf. Family-context / caretaker-context middleware still runs and
// the role check here forces a 403 for non-patients.
emergencyRouter.post("/sos", authMiddleware, requireRole("patient"), async (c) => {
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
      await notify({
        db,
        userId: contact.id,
        type: "emergency",
        title: `Emergency: ${u.name}`,
        body: `Your emergency contact ${u.name} has triggered an SOS${nearestHospitalName ? `. Nearest hospital: ${nearestHospitalName}` : ""}.`,
        data: {
          patientId: p.id,
          emergencyId: emergency.emergencies.id,
          latitude,
          longitude,
          nearestHospitalId,
        },
        forcePush: true,
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
    await notify({
      db,
      userId: amb.id,
      type: "emergency",
      title: `SOS — ${u.name}`,
      body: `${u.name} triggered emergency SOS${nearestHospitalName ? ` near ${nearestHospitalName}` : ""}. Blood group ${p.bloodGroup ?? "—"}.`,
      data: {
        patientId: p.id,
        emergencyId: emergency.emergencies.id,
        latitude,
        longitude,
        nearestHospitalId,
      },
      forcePush: true,
    });
    ambulancesNotified += 1;
  }

  // 5) Self-notification (existing behaviour)
  await notify({
    db,
    userId,
    type: "emergency",
    title: "Emergency SOS Sent",
    body:
      notifiedContacts + ambulancesNotified > 0
        ? `${notifiedContacts} contact${notifiedContacts === 1 ? "" : "s"} and ${ambulancesNotified} ambulance${ambulancesNotified === 1 ? "" : "s"} alerted.`
        : "Your emergency signal has been sent.",
    forcePush: true,
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

// ─── Public Emergency Web Card View ───────────────────────
emergencyRouter.get("/card/view", async (c) => {
  const data = c.req.query("data");
  if (!data) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Emergency Card Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #F8FAFC; color: #475569; }
            .card { text-align: center; padding: 2rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; width: 90%; }
            h1 { color: #EF4444; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Error</h1>
            <p>No emergency data was provided in the link. Please scan a valid Health QR code.</p>
          </div>
        </body>
      </html>
    `, 400);
  }

  let payload: any;
  try {
    const decoded = atob(data);
    payload = JSON.parse(decoded);
  } catch (e) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Invalid Emergency Card</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #F8FAFC; color: #475569; }
            .card { text-align: center; padding: 2rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; width: 90%; }
            h1 { color: #EF4444; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Error</h1>
            <p>The emergency card link is invalid or corrupted.</p>
          </div>
        </body>
      </html>
    `, 400);
  }

  const { name, bloodGroup, allergies, conditions, contacts, phone } = payload;

  const allergyList = Array.isArray(allergies) ? allergies : [];
  const conditionList = Array.isArray(conditions) ? conditions : [];
  const contactList = Array.isArray(contacts) ? contacts : [];

  const allergyHtml = allergyList.length > 0 
    ? allergyList.map(a => `<div class="badge badge-warning">${escapeHtml(a)}</div>`).join("")
    : `<div class="empty-text">No known allergies on file</div>`;

  const conditionHtml = conditionList.length > 0
    ? conditionList.map(c => `<div class="badge badge-danger">${escapeHtml(c)}</div>`).join("")
    : `<div class="empty-text">No chronic conditions on file</div>`;

  const contactHtml = contactList.length > 0
    ? contactList.map(con => `
        <div class="contact-row">
          <div class="contact-info">
            <div class="contact-name">${escapeHtml(con.name)}</div>
            <div class="contact-rel">${escapeHtml(con.relationship)}</div>
          </div>
          <a href="tel:${escapeHtml(con.phone)}" class="call-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call
          </a>
        </div>
      `).join("")
    : `<div class="empty-text">No emergency contacts listed</div>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Emergency Medical Card - ${escapeHtml(name)}</title>
      <style>
        :root {
          --danger: #EF4444;
          --danger-bg: #FEF2F2;
          --danger-border: #FEE2E2;
          --warning: #F59E0B;
          --warning-bg: #FFFBEB;
          --warning-border: #FEF3C7;
          --text: #1E293B;
          --text-muted: #64748B;
          --bg: #F8FAFC;
          --surface: #FFFFFF;
          --border: #E2E8F0;
          --accent: #2563EB;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: var(--bg);
          color: var(--text);
          margin: 0;
          padding: 16px;
          display: flex;
          justify-content: center;
        }
        .container {
          width: 100%;
          max-width: 480px;
          background: var(--surface);
          border-radius: 24px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05);
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .header {
          background-color: var(--danger);
          color: white;
          padding: 24px 20px;
          text-align: center;
          position: relative;
        }
        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(255, 255, 255, 0.2);
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .profile-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .blood-badge {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background-color: var(--danger-bg);
          border: 2px solid var(--danger-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--danger);
        }
        .blood-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }
        .blood-value {
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
        }
        .profile-info {
          flex: 1;
        }
        .profile-name {
          font-size: 20px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.3px;
        }
        .profile-phone {
          font-size: 14px;
          color: var(--text-muted);
          margin: 4px 0 0 0;
        }
        .section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          margin: 0 0 12px 0;
          border-bottom: 1.5px solid var(--border);
          padding-bottom: 6px;
        }
        .badge-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .badge {
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        }
        .badge-warning {
          background-color: var(--warning-bg);
          color: var(--warning);
          border: 1px solid var(--warning-border);
        }
        .badge-danger {
          background-color: var(--danger-bg);
          color: var(--danger);
          border: 1px solid var(--danger-border);
        }
        .contact-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background-color: var(--bg);
          border-radius: 16px;
          margin-bottom: 8px;
          border: 1px solid var(--border);
        }
        .contact-info {
          flex: 1;
        }
        .contact-name {
          font-size: 15px;
          font-weight: 700;
        }
        .contact-rel {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .call-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: var(--accent);
          color: white;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
        }
        .call-btn:active {
          transform: scale(0.97);
        }
        .empty-text {
          font-size: 14px;
          color: var(--text-muted);
          font-style: italic;
        }
        .footer {
          text-align: center;
          padding: 20px;
          background-color: var(--bg);
          border-top: 1px solid var(--border);
        }
        .footer-logo {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: var(--text-muted);
        }
        .footer-sub {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 4px;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align: middle; margin-right: 2px;"><path d="M12 2v20M2 12h20"/></svg>
            Medical Info
          </div>
          <h1>EMERGENCY CARD</h1>
        </div>
        <div class="content">
          <div class="profile-row">
            <div class="blood-badge">
              <span class="blood-label">Blood</span>
              <span class="blood-value">${escapeHtml(bloodGroup || "—")}</span>
            </div>
            <div class="profile-info">
              <h2 class="profile-name">${escapeHtml(name)}</h2>
              ${phone ? `<p class="profile-phone">${escapeHtml(phone)}</p>` : ""}
            </div>
          </div>
          
          <div>
            <h3 class="section-title">Allergies</h3>
            <div class="badge-list">
              ${allergyHtml}
            </div>
          </div>
          
          <div>
            <h3 class="section-title">Medical Conditions</h3>
            <div class="badge-list">
              ${conditionHtml}
            </div>
          </div>
          
          <div>
            <h3 class="section-title">Emergency Contacts</h3>
            ${contactHtml}
          </div>
        </div>
        <div class="footer">
          <div class="footer-logo">HEALERS EMERGENCY NETWORK</div>
          <div class="footer-sub">Verified patient emergency identification card</div>
        </div>
      </div>
    </body>
    </html>
  `;
  return c.html(htmlContent);
});

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Update emergency status (with ownership check) ──────
// Caretaker Profiles: caretakers can update the principal's emergency
// record (e.g. mark as resolved when help has arrived). The active
// link is enforced by resolvePatientContext.
emergencyRouter.put("/:id/status", authMiddleware, async (c) => {
  const emergencyId = c.req.param("id");
  const { status } = await c.req.json();
  const db = c.get("db");

  const patient = await resolvePatientContext(c);

  if (!patient) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [existing] = await db
    .select()
    .from(emergencies)
    .where(eq(emergencies.id, emergencyId))
    .limit(1);

  if (!existing || (existing.emergencies?.patientId ?? existing.patientId) !== patient.id) {
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
// Caretaker Profiles: caretakers see the principal's emergency history.
emergencyRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");

  const patient = await resolvePatientContext(c);

  if (!patient) {
    return c.json({ emergencies: [] });
  }

  const history = await db
    .select()
    .from(emergencies)
    .where(eq(emergencies.patientId, patient.id));

  return c.json({ emergencies: history });
});

// ─── Phase v3: QR ephemeral tokens ───────────────────────────
// Replaces the static /qr payload with time-boxed tokens that the
// first-responder scans. Each scan decrements `max_scans`, every scan
// is logged.

emergencyRouter.post("/qr/issue", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const familyMemberId = body.familyMemberId ? String(body.familyMemberId) : null;
  const maxScans = Number.isFinite(body.maxScans) ? Number(body.maxScans) : 5;
  const ttlHours = Number.isFinite(body.ttlHours) ? Number(body.ttlHours) : 2;

  // Caretaker Profiles: caretakers can issue an emergency QR for the
  // principal; the token is bound to the principal's patient row.
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "patient_not_found" }, 404);

  const bundle = await buildEmergencyBundle(db, patient.id, familyMemberId);
  const encryptedPayload = await encryptJson(c, bundle);
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  await db.insert(qrAccessTokens).values({
    token,
    patientId: patient.id,
    familyMemberId,
    encryptedPayload,
    expiresAt,
    maxScans,
    scansJson: "[]",
    createdAt: new Date().toISOString(),
  });
  await audit(db, {
    userId,
    action: "qr_token_issued",
    resource: "qr_access_token",
    resourceId: token,
    details: { maxScans, ttlHours, familyMemberId },
  });
  return c.json({ token, expiresAt, maxScans, url: `/emergency/qr/${token}` }, 201);
});

emergencyRouter.get("/qr/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const [row] = await db.select().from(qrAccessTokens).where(eq(qrAccessTokens.token, token)).limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.revokedAt) return c.json({ error: "revoked" }, 410);
  if (row.expiresAt <= new Date().toISOString()) return c.json({ error: "expired" }, 410);

  const scans = parseScans(row.scansJson);
  if (scans.length >= row.maxScans) {
    return c.json({ error: "max_scans_reached" }, 410);
  }

  scans.push({
    at: new Date().toISOString(),
    ip: c.req.header("cf-connecting-ip") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  });
  await db
    .update(qrAccessTokens)
    .set({ scansJson: JSON.stringify(scans) })
    .where(eq(qrAccessTokens.token, token));

  await audit(db, {
    userId: row.patientId, // surrogate — patient is "the actor" for QR scan
    action: "qr_token_scanned",
    resource: "qr_access_token",
    resourceId: token,
    details: { count: scans.length, max: row.maxScans },
  });

  const bundle = await decryptJson(c, row.encryptedPayload);
  return c.json({ bundle, scansRemaining: row.maxScans - scans.length });
});

emergencyRouter.post("/qr/:token/revoke", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const token = c.req.param("token");
  const [row] = await db.select().from(qrAccessTokens).where(eq(qrAccessTokens.token, token)).limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient || row.patientId !== patient.id) return c.json({ error: "forbidden" }, 403);
  await db
    .update(qrAccessTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(qrAccessTokens.token, token));
  await audit(db, {
    userId,
    action: "qr_token_revoked",
    resource: "qr_access_token",
    resourceId: token,
  });
  return c.json({ revoked: true });
});

// ─── QR helpers ────────────────────────────────────────────

async function buildEmergencyBundle(db: any, patientId: string, familyMemberId: string | null) {
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  const [user] = patient ? await db.select().from(users).where(eq(users.id, patient.userId)).limit(1) : [null];
  const allergyRows = await db.select().from(allergies).where(eq(allergies.patientId, patientId));
  const medicineRows = await db.select().from(medicines).where(
    and(eq(medicines.patientId, patientId), eq(medicines.active, true)),
  );
  const contacts = patient?.emergencyContacts ? JSON.parse(patient.emergencyContacts) : [];
  return {
    name: patient?.fullName ?? null,
    dob: patient?.dateOfBirth ?? null,
    bloodGroup: patient?.bloodGroup ?? null,
    allergies: allergyRows,
    conditions: patient?.medicalConditions ?? null,
    medicines: medicineRows.map((m: any) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
    contacts,
    phone: patient?.phone ?? user?.phone ?? null,
    familyMemberId,
  };
}

function parseScans(s: string): Array<{ at: string; ip: string | null; userAgent: string | null }> {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function randomToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function encryptJson(c: any, payload: unknown): Promise<string> {
  const { encryptEnvelope } = await import("../lib/envelope-crypto");
  const env = (await encryptEnvelope(c.env as Record<string, unknown>, payload)) as {
    encryptedPayload: string;
    encryptedPayloadKekId: string;
    encryptedPayloadDekWrapped: string;
    iv: string;
    authTag: string;
    envelopeVersion: string;
  };
  return JSON.stringify(env);
}

async function decryptJson(c: any, stored: string): Promise<unknown> {
  const { decryptEnvelope } = await import("../lib/envelope-crypto");
  const env = JSON.parse(stored) as {
    encryptedPayload: string;
    encryptedPayloadDekWrapped: string;
    iv: string;
    authTag: string;
  };
  return decryptEnvelope(c.env as Record<string, unknown>, env);
}

export default emergencyRouter;
