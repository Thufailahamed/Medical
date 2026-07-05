// @ts-nocheck
//
// Patient-side secure messaging.
// Only a doctor can START a conversation (via doctor-messages router).
// A patient can READ and REPLY only while conversation.status === "open".
// If the doctor has closed the thread, reads still work but sends are 403.

import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import {
  messagesConversations,
  messages,
  patients,
  doctors,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { txWrite } from "../lib/tx";
import { atomicIncrement } from "../lib/status-guard";
import type { AppEnvironment } from "../types";

const patientMessagesRouter = new Hono<AppEnvironment>();
patientMessagesRouter.use("*", authMiddleware, requireRole("patient"));

async function getPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p;
}

// ─── List open conversations ─────────────────────────────
// GET /patient-messages/conversations
// Returns only conversations with status = "open" so the patient
// only sees threads the doctor has actively opened for them.
patientMessagesRouter.get("/conversations", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getPatient(db, userId);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const rows = await db
    .select({
      id: messagesConversations.id,
      doctorId: messagesConversations.doctorId,
      lastMessageAt: messagesConversations.lastMessageAt,
      lastMessagePreview: messagesConversations.lastMessagePreview,
      lastMessageSender: messagesConversations.lastMessageSender,
      patientUnread: messagesConversations.patientUnread,
      status: messagesConversations.status,
      createdAt: messagesConversations.createdAt,
      doctorUserId: users.id,
      doctorName: users.name,
      doctorPhoto: users.photo,
    })
    .from(messagesConversations)
    .innerJoin(doctors, eq(doctors.id, messagesConversations.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(
      and(
        eq(messagesConversations.patientId, patient.id),
        eq(messagesConversations.status, "open")
      )
    )
    .orderBy(desc(messagesConversations.lastMessageAt));

  const totalUnread = rows.reduce(
    (sum: number, r: any) => sum + (r.patientUnread || 0),
    0
  );

  return c.json({
    conversations: rows.map((r: any) => ({
      id: r.id,
      doctorId: r.doctorId,
      doctor: { id: r.doctorId, userId: r.doctorUserId, name: r.doctorName, photo: r.doctorPhoto || null },
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
      lastMessageSender: r.lastMessageSender,
      patientUnread: r.patientUnread,
      status: r.status ?? "open",
      createdAt: r.createdAt,
    })),
    totalUnread,
  });
});

// ─── Get messages in a conversation ─────────────────────
// GET /patient-messages/conversations/:id/messages
patientMessagesRouter.get("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const patient = await getPatient(db, userId);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const markRead = c.req.query("markRead") !== "false";

  const [conv] = await db
    .select()
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.patientId, patient.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const ordered = rows.slice().reverse();

  // Mark patient-side as read.
  if (markRead && conv.patientUnread > 0) {
    await db
      .update(messagesConversations)
      .set({ patientUnread: 0 })
      .where(eq(messagesConversations.id, conversationId));
    await db
      .update(messages)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderRole, "doctor")
        )
      );
  }

  // Doctor header.
  const [headerDoctor] = await db
    .select({ doctor: doctors, user: users })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, conv.doctorId))
    .limit(1);

  return c.json({
    conversation: { ...conv, patientUnread: markRead ? 0 : conv.patientUnread, status: conv.status ?? "open" },
    doctor: headerDoctor
      ? {
          id: headerDoctor.doctor.id,
          userId: headerDoctor.user.id,
          name: headerDoctor.user.name,
          photo: headerDoctor.user.photo || null,
        }
      : null,
    messages: ordered,
  });
});

// ─── Send a reply ────────────────────────────────────────
// POST /patient-messages/conversations/:id/messages  { body }
// Returns 403 if the conversation is closed.
patientMessagesRouter.post("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const conversationId = c.req.param("id");
  const patient = await getPatient(db, userId);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const messageBody = String(body?.body || "").trim();
  if (!messageBody) return c.json({ error: "body required" }, 400);
  if (messageBody.length > 4000) return c.json({ error: "body exceeds 4000 chars" }, 400);

  const [conv] = await db
    .select({
      id: messagesConversations.id,
      doctorId: messagesConversations.doctorId,
      status: messagesConversations.status,
    })
    .from(messagesConversations)
    .where(
      and(
        eq(messagesConversations.id, conversationId),
        eq(messagesConversations.patientId, patient.id)
      )
    )
    .limit(1);
  if (!conv) return c.json({ error: "Conversation not found" }, 404);

  // Enforce doctor-gated messaging.
  if (conv.status === "closed") {
    return c.json({ error: "conversation_closed", message: "This conversation has been closed by your doctor." }, 403);
  }

  const now = new Date().toISOString();

  const inserted = await txWrite(db, async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderRole: "patient",
        senderId: userId,
        body: messageBody,
        createdAt: now,
      } as any)
      .returning();

    await atomicIncrement(tx, messagesConversations, conversationId, { doctorUnread: 1 });
    await tx
      .update(messagesConversations)
      .set({
        lastMessageAt: now,
        lastMessagePreview: messageBody.slice(0, 140),
        lastMessageSender: "patient",
      })
      .where(eq(messagesConversations.id, conversationId));

    return m;
  });

  // Notify the doctor (best-effort).
  const [doctorRow] = await db
    .select({ userId: users.id })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, conv.doctorId))
    .limit(1);
  if (doctorRow) {
    await notify({
      db,
      userId: doctorRow.userId,
      type: "general",
      title: "New reply from your patient",
      body: messageBody.slice(0, 140),
      data: { conversationId, senderRole: "patient" },
    });
  }

  return c.json({ message: inserted }, 201);
});

export default patientMessagesRouter;
