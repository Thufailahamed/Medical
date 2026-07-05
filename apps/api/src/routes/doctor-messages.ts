// @ts-nocheck

import { Hono } from "hono";
import { and, eq, desc, asc, gt, sql } from "drizzle-orm";
import {
  messagesConversations,
  messages,
  doctors,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { txWrite } from "../lib/tx";
import { atomicIncrement, upsertActiveCareTeam } from "../lib/status-guard";
import type { AppEnvironment } from "../types";

const doctorMessagesRouter = new Hono<AppEnvironment>();

doctorMessagesRouter.use("*", authMiddleware, requireRole("doctor"));

async function getDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

// ─── List conversations ──────────────────────────────────
// GET /doctor-messages/conversations
// Returns the doctor's 1:1 threads ordered by last_message_at desc.
// Joins the patient's user row for name + photo for the inbox list.
doctorMessagesRouter.get("/conversations", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const rows = await db
    .select({
      id: messagesConversations.id,
      patientId: messagesConversations.patientId,
      lastMessageAt: messagesConversations.lastMessageAt,
      lastMessagePreview: messagesConversations.lastMessagePreview,
      lastMessageSender: messagesConversations.lastMessageSender,
      doctorUnread: messagesConversations.doctorUnread,
      patientUnread: messagesConversations.patientUnread,
      status: messagesConversations.status,
      createdAt: messagesConversations.createdAt,
      patientUserId: patients.userId,
      patientName: users.name,
      patientPhoto: users.photo,
    })
    .from(messagesConversations)
    .innerJoin(patients, eq(patients.id, messagesConversations.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(messagesConversations.doctorId, doctor.id))
    .orderBy(desc(messagesConversations.lastMessageAt));

  const totalUnread = rows.reduce(
    (sum: number, r: any) => sum + (r.doctorUnread || 0),
    0
  );

  return c.json({
    conversations: rows.map((r: any) => ({
      id: r.id,
      patientId: r.patientId,
      patient: { id: r.patientId, userId: r.patientUserId, name: r.patientName, photo: r.patientPhoto || null },
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
      lastMessageSender: r.lastMessageSender,
      doctorUnread: r.doctorUnread,
      patientUnread: r.patientUnread,
      status: r.status ?? "open",
      createdAt: r.createdAt,
    })),
    totalUnread,
  });
});

// ─── Get-or-create conversation ──────────────────────────
// POST /doctor-messages/conversations  { patientId }
// Upserts the (doctor, patient) thread. Both sides can call this and get
// the same row back.
doctorMessagesRouter.post("/conversations", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const patientId = String(body?.patientId || "").trim();
  if (!patientId) return c.json({ error: "patientId required" }, 400);

  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  // Look up existing.
  const [existing] = await db
    .select()
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.doctorId, doctor.id),
        eq(messagesConversations.patientId, patientId)
      )
    )
    .limit(1);

  if (existing) return c.json({ conversation: existing, created: false });

  const [created] = await db
    .insert(messagesConversations)
    .values({ doctorId: doctor.id, patientId } as any)
    .returning();

  // Phase 1: backfill care team. Messaging counts as a relationship —
  // give the doctor "primary_care" role on the team (patient can
  // adjust later via PATCH /care-team).
  await upsertActiveCareTeam(db, {
    patientId,
    doctorId: doctor.id,
    role: "primary_care",
    invitedByUserId: userId,
  });

  return c.json({ conversation: created, created: true }, 201);
});

// ─── List messages in a conversation ─────────────────────
// GET /doctor-messages/conversations/:id/messages?limit=50&beforeId=
// Marks doctor-side unread as read on fetch (caller controls when via
// the `?markRead=false` flag).
doctorMessagesRouter.get("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const limit = Math.min(
    parseInt(c.req.query("limit") || "50", 10) || 50,
    200
  );
  const beforeId = c.req.query("beforeId") || null;
  const markRead = c.req.query("markRead") !== "false";

  // Ensure the conversation belongs to this doctor.
  const [conv] = await db
    .select()
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.doctorId, doctor.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  // Build WHERE for messages: older than `beforeId` if paginating.
  const whereParts: any[] = [eq(messages.conversationId, conversationId)];
  if (beforeId) {
    const [pivot] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, beforeId))
      .limit(1);
    if (pivot) whereParts.push(gt(messages.createdAt, pivot.createdAt));
    // ↑ ascending fetch + .reverse() below gives "page before beforeId"
    // Simpler: just fetch latest N every time; chat windows are tiny.
  }
  // For simplicity we always return the latest `limit`. The client
  // reverse-paginates only if needed.
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const ordered = rows.slice().reverse();

  // Mark doctor-side as read.
  if (markRead && conv.doctorUnread > 0) {
    await db
      .update(messagesConversations)
      .set({ doctorUnread: 0 })
      .where(eq(messagesConversations.id, conversationId));
    await db
      .update(messages)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderRole, "patient")
        )
      );
  }

  // Patient header.
  const [headerPatient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, conv.patientId))
    .limit(1);

  return c.json({
    conversation: { ...conv, doctorUnread: markRead ? 0 : conv.doctorUnread, status: conv.status ?? "open" },
    patient: headerPatient
      ? {
          id: headerPatient.patient.id,
          userId: headerPatient.user.id,
          name: headerPatient.user.name,
          photo: headerPatient.user.photo || null,
          phone: headerPatient.user.phone || null,
        }
      : null,
    messages: ordered,
  });
});

// ─── Send a message ──────────────────────────────────────
// POST /doctor-messages/conversations/:id/messages  { body }
//
// P2 atomicity: previously this endpoint did a read-modify-write on
// `patientUnread` (`(conv.patientUnread || 0) + 1`) — two concurrent
// sends would both read the same value and both write back the same
// incremented value, losing one of the increments. Now we use SQL
// arithmetic (`patientUnread = patientUnread + 1`) inside the same
// transaction that inserts the message, so the unread counter is
// race-free. The lastMessageAt / lastMessagePreview fields are
// updated in the same transaction.
doctorMessagesRouter.post("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const messageBody = String(body?.body || "").trim();
  if (!messageBody) return c.json({ error: "body required" }, 400);
  if (messageBody.length > 4000) {
    return c.json({ error: "body exceeds 4000 chars" }, 400);
  }

  const [conv] = await db
    .select({ id: messagesConversations.id, patientId: messagesConversations.patientId })
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.doctorId, doctor.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  const now = new Date().toISOString();

  const inserted = await txWrite(db, async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderRole: "doctor",
        senderId: userId,
        body: messageBody,
        createdAt: now,
      } as any)
      .returning();

    // SQL-side atomic increment — no lost updates under concurrent sends.
    await atomicIncrement(
      tx,
      messagesConversations,
      conversationId,
      { patientUnread: 1 }
    );
    await tx
      .update(messagesConversations)
      .set({
        lastMessageAt: now,
        lastMessagePreview: messageBody.slice(0, 140),
        lastMessageSender: "doctor",
      })
      .where(eq(messagesConversations.id, conversationId));

    return m;
  });

  // Notify the patient (best-effort, outside the tx).
  const [patientRow] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, conv.patientId))
    .limit(1);
  if (patientRow) {
    await notify({
      db,
      userId: patientRow.userId,
      type: "general",
      title: "New message from your doctor",
      body: messageBody.slice(0, 140),
      data: { conversationId, senderRole: "doctor" },
    });
  }

  return c.json({ message: inserted }, 201);
});

// ─── Mark conversation read (manual) ────────────────────
// POST /doctor-messages/conversations/:id/read
doctorMessagesRouter.post("/conversations/:id/read", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [conv] = await db
    .select()
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.doctorId, doctor.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  await db
    .update(messagesConversations)
    .set({ doctorUnread: 0 })
    .where(eq(messagesConversations.id, conversationId));
  await db
    .update(messages)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderRole, "patient")
      )
    );

  return c.json({ ok: true });
});

// ─── Close / Reopen conversation ─────────────────────────
// PATCH /doctor-messages/conversations/:id  { status: "open" | "closed" }
doctorMessagesRouter.patch("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const status = body?.status;
  if (status !== "open" && status !== "closed") {
    return c.json({ error: "status must be 'open' or 'closed'" }, 400);
  }

  const [conv] = await db
    .select()
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.doctorId, doctor.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  await db
    .update(messagesConversations)
    .set({ status })
    .where(eq(messagesConversations.id, conversationId));

  return c.json({ ok: true, status });
});

export default doctorMessagesRouter;
