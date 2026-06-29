// @ts-nocheck
// Unified chronological timeline across records, vitals, symptoms,
// medicines (start/stop), appointments, and clinical notes.

import { Hono } from "hono";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import {
  medicalRecords,
  vitals,
  symptoms,
  medicines,
  appointments,
  patients,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { canAccessPatient } from "../lib/access";
import type { AppEnvironment } from "../types";

const timelineRouter = new Hono<AppEnvironment>();

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  record: { icon: "file-text", color: "primary", label: "Record" },
  vital: { icon: "activity", color: "info", label: "Vital" },
  symptom: { icon: "alert-triangle", color: "warning", label: "Symptom" },
  medicine_start: { icon: "pill", color: "success", label: "Started" },
  medicine_stop: { icon: "pill", color: "neutral", label: "Stopped" },
  appointment: { icon: "calendar", color: "primary", label: "Visit" },
  note: { icon: "sticky-note", color: "info", label: "Note" },
};

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

timelineRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ events: [] });

  const type = c.req.query("type"); // optional filter: "vital", "record", etc.
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = Math.min(parseInt(c.req.query("limit") || "200", 10), 500);

  const events: any[] = [];

  // Helper: a filter so we can gate
  const keep = (kind: string) => !type || type === kind;

  if (keep("record")) {
    const conds = [eq(medicalRecords.patientId, patient.id)];
    if (from) conds.push(gte(medicalRecords.recordDate, from));
    if (to) conds.push(lte(medicalRecords.recordDate, to));
    const rows = await db
      .select()
      .from(medicalRecords)
      .where(and(...conds));
    for (const r of rows) {
      events.push({
        id: `rec-${r.id}`,
        kind: "record",
        date: r.recordDate || r.createdAt,
        title: r.title || r.recordType,
        subtitle: r.description || r.provider || null,
        meta: {
          recordType: r.recordType,
          provider: r.provider,
        },
      });
    }
  }

  if (keep("vital")) {
    const conds = [eq(vitals.patientId, patient.id)];
    if (from) conds.push(gte(vitals.recordedAt, from));
    if (to) conds.push(lte(vitals.recordedAt, to));
    const rows = await db
      .select()
      .from(vitals)
      .where(and(...conds));
    for (const v of rows) {
      events.push({
        id: `vit-${v.id}`,
        kind: "vital",
        date: v.recordedAt || v.createdAt,
        title: `${v.type.replace(/_/g, " ")}: ${
          v.secondaryValue != null ? `${v.value}/${v.secondaryValue}` : v.value
        } ${v.unit || ""}`.trim(),
        subtitle: v.notes || null,
        meta: { type: v.type, value: v.value, secondary: v.secondaryValue, unit: v.unit },
      });
    }
  }

  if (keep("symptom")) {
    const conds = [eq(symptoms.patientId, patient.id)];
    if (from) conds.push(gte(symptoms.startedAt, from));
    if (to) conds.push(lte(symptoms.startedAt, to));
    const rows = await db
      .select()
      .from(symptoms)
      .where(and(...conds));
    for (const s of rows) {
      events.push({
        id: `sym-${s.id}`,
        kind: "symptom",
        date: s.startedAt || s.createdAt,
        title: s.symptom,
        subtitle:
          s.severity && s.severity !== "mild"
            ? `${s.severity}${s.notes ? " • " + s.notes : ""}`
            : s.notes || null,
        meta: { severity: s.severity, endedAt: s.endedAt },
      });
    }
  }

  if (keep("medicine_start") || keep("medicine_stop")) {
    const rows = await db
      .select()
      .from(medicines)
      .where(eq(medicines.patientId, patient.id));
    for (const m of rows) {
      if (keep("medicine_start") && m.startDate) {
        events.push({
          id: `med-start-${m.id}`,
          kind: "medicine_start",
          date: m.startDate,
          title: `Started ${m.name}`,
          subtitle: `${m.dosage || ""} ${m.frequency || ""}`.trim() || null,
          meta: { medicineId: m.id },
        });
      }
      if (keep("medicine_stop") && m.endDate) {
        events.push({
          id: `med-stop-${m.id}`,
          kind: "medicine_stop",
          date: m.endDate,
          title: `Stopped ${m.name}`,
          subtitle: m.reason || null,
          meta: { medicineId: m.id },
        });
      }
    }
  }

  if (keep("appointment")) {
    const rows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.patientId, patient.id));
    for (const a of rows) {
      events.push({
        id: `apt-${a.id}`,
        kind: "appointment",
        date: a.scheduledAt || a.createdAt,
        title: a.reason || a.type || "Appointment",
        subtitle: a.location || a.providerName || null,
        meta: {
          status: a.status,
          type: a.type,
          appointmentId: a.id,
        },
      });
    }
  }

  if (keep("note")) {
    const rows = await db
      .select()
      .from(medicalRecords)
      .where(and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "clinical_note")
      ));
    for (const n of rows) {
      events.push({
        id: `note-${n.id}`,
        kind: "note",
        date: n.date || n.createdAt,
        title: n.title || "Clinical note",
        subtitle: n.notes ? String(n.notes).slice(0, 140) : null,
        meta: { authorRole: "doctor", noteId: n.id },
      });
    }
  }

  // Sort desc by date
  events.sort((a, b) => {
    const ta = new Date(a.date || 0).getTime();
    const tb = new Date(b.date || 0).getTime();
    return tb - ta;
  });

  // Decorate with type meta (icon/color/label)
  const decorated = events.slice(0, limit).map((e) => ({
    ...e,
    ...(TYPE_META[e.kind] || { icon: "circle", color: "neutral", label: e.kind }),
  }));

  return c.json({
    events: decorated,
    counts: events.reduce((acc: Record<string, number>, e) => {
      acc[e.kind] = (acc[e.kind] || 0) + 1;
      return acc;
    }, {}),
  });
});

export default timelineRouter;
