// @ts-nocheck
// HOS-14: Doctor-to-doctor consult notes. Mounted at /consult-notes.

import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import {
  consultNotes,
  doctors,
  hospitals,
  hospitalShareRequests,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

router.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "doctor", "super_admin")
);

function genId(): string {
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function myHospitalId(c: any): string | null {
  return c.get("activeHospitalId") || null;
}

function safeParseArray<T>(s: string | null | undefined, fb: T[]): T[] {
  if (!s) return fb;
  try {
    return JSON.parse(s) as T[];
  } catch {
    return fb;
  }
}

const FALLBACK_DOCTOR_ID = "00000000-0000-0000-0000-000000000001";

// POST / — open new consult
router.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const { patientId, toHospitalId, toDoctorId, question } = body || {};
  if (!patientId || !toHospitalId || !question) {
    return c.json({ error: "patientId, toHospitalId, question are required" }, 400);
  }
  if (toHospitalId === myId) {
    return c.json({ error: "Cannot consult within the same hospital" }, 400);
  }

  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  const id = genId();
  const initialThread = [
    {
      userId,
      body: question,
      createdAt: new Date().toISOString(),
      kind: "question",
    },
  ];

  await db.insert(consultNotes).values({
    id,
    patientId,
    fromDoctorId: doc?.id ?? FALLBACK_DOCTOR_ID,
    toDoctorId: toDoctorId || null,
    fromHospitalId: myId,
    toHospitalId,
    question: String(question).slice(0, 2000),
    thread: JSON.stringify(initialThread),
    status: "open",
  });

  // Auto-create linked share request (so target doctor can read chart).
  const shareId = genId();
  const token = genToken();
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
  await db.insert(hospitalShareRequests).values({
    id: shareId,
    requesterHospitalId: toHospitalId,
    sourceHospitalId: myId,
    patientId,
    requestedByUserId: userId,
    scope: "full",
    reason: `Consult #${id.slice(0, 8)}`,
    status: "approved",
    token,
    expiresAt: expires,
    approvedByUserId: userId,
    approvedAt: new Date().toISOString(),
  });
  await db
    .update(consultNotes)
    .set({ linkedShareRequestId: shareId })
    .where(eq(consultNotes.id, id));

  // Notify target hospital admin.
  const [admin] = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, toHospitalId))
    .limit(1);
  if (admin?.userId) {
    await notify({
      db,
      userId: admin.userId,
      type: "hospital_request",
      title: "Consult request received",
      body: "A doctor at another hospital is asking for your input.",
      data: {
        kind: "consult_note_received",
        consultId: id,
        fromHospitalId: myId,
        patientId,
        shareRequestId: shareId,
      },
    });
  }

  await writeAudit(db, {
    userId,
    action: "consult.create",
    resource: "consult_note",
    resourceId: id,
    details: { toHospitalId, patientId },
  });

  return c.json({ id, status: "open", shareRequestId: shareId }, 201);
});

// GET /incoming — consults targeting my hospital
router.get("/incoming", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      note: consultNotes,
      from: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(consultNotes)
    .innerJoin(hospitals, eq(hospitals.id, consultNotes.fromHospitalId))
    .innerJoin(patients, eq(patients.id, consultNotes.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(consultNotes.toHospitalId, myId))
    .orderBy(desc(consultNotes.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /outgoing — consults I sent
router.get("/outgoing", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      note: consultNotes,
      to: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(consultNotes)
    .innerJoin(hospitals, eq(hospitals.id, consultNotes.toHospitalId))
    .innerJoin(patients, eq(patients.id, consultNotes.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(consultNotes.fromHospitalId, myId))
    .orderBy(desc(consultNotes.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /:id
router.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [note] = await db
    .select()
    .from(consultNotes)
    .where(eq(consultNotes.id, id))
    .limit(1);
  if (!note) return c.json({ error: "not_found" }, 404);
  if (
    myId &&
    note.fromHospitalId !== myId &&
    note.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }

  const [fromH] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, note.fromHospitalId))
    .limit(1);
  const [toH] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, note.toHospitalId))
    .limit(1);
  const [patient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, note.patientId))
    .limit(1);

  return c.json({
    note,
    thread: safeParseArray(note.thread, []),
    from: fromH,
    to: toH,
    patient: patient?.patient ?? null,
    user: patient?.user ?? null,
  });
});

// POST /:id/reply
router.post("/:id/reply", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const reply = String(body?.body ?? "").trim();
  if (!reply) return c.json({ error: "body is required" }, 400);

  const [note] = await db
    .select()
    .from(consultNotes)
    .where(eq(consultNotes.id, id))
    .limit(1);
  if (!note) return c.json({ error: "not_found" }, 404);
  if (
    myId &&
    note.fromHospitalId !== myId &&
    note.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (note.status === "closed") {
    return c.json({ error: "consult is closed" }, 409);
  }

  const thread = safeParseArray<any>(note.thread, []);
  thread.push({
    userId,
    body: reply.slice(0, 4000),
    createdAt: new Date().toISOString(),
    kind: "reply",
  });

  await db
    .update(consultNotes)
    .set({
      thread: JSON.stringify(thread),
      status: note.status === "open" ? "answered" : note.status,
      lastReplyAt: new Date().toISOString(),
    })
    .where(eq(consultNotes.id, id));

  // Notify the OTHER side.
  const otherHospitalId =
    note.fromHospitalId === myId ? note.toHospitalId : note.fromHospitalId;
  const [admin] = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, otherHospitalId))
    .limit(1);
  if (admin?.userId) {
    await notify({
      db,
      userId: admin.userId,
      type: "hospital_request",
      title: "New reply on consult",
      body: reply.slice(0, 120),
      data: {
        kind: "consult_note_reply",
        consultId: id,
        fromHospitalId: myId,
      },
    });
  }

  await writeAudit(db, {
    userId,
    action: "consult.reply",
    resource: "consult_note",
    resourceId: id,
  });

  return c.json({ ok: true });
});

// POST /:id/close — auto-revoke linked share
router.post("/:id/close", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [note] = await db
    .select()
    .from(consultNotes)
    .where(eq(consultNotes.id, id))
    .limit(1);
  if (!note) return c.json({ error: "not_found" }, 404);
  if (
    myId &&
    note.fromHospitalId !== myId &&
    note.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (note.status === "closed") return c.json({ ok: true });

  await db
    .update(consultNotes)
    .set({ status: "closed" })
    .where(eq(consultNotes.id, id));

  // Revoke linked share.
  if (note.linkedShareRequestId) {
    await db
      .update(hospitalShareRequests)
      .set({
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedByUserId: userId,
      })
      .where(eq(hospitalShareRequests.id, note.linkedShareRequestId));
  }

  await writeAudit(db, {
    userId,
    action: "consult.close",
    resource: "consult_note",
    resourceId: id,
  });

  return c.json({ ok: true });
});

export default router;
