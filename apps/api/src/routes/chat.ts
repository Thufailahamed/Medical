// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  chatSessions,
  chatMessages,
  patients,
  users,
  medicines,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { flattenTranslated } from "../lib/validation-error";
import { chatSessionSchema, chatMessageSchema } from "@healthcare/shared";
import {
  aiComplete,
  systemPrompt,
  fallbackChat,
  type ChatMsg,
} from "../lib/ai";
import type { AppEnvironment } from "../types";

const chatRouter = new Hono<AppEnvironment>();
chatRouter.use("*", authMiddleware);

// ─── List sessions ───────────────────────────────────────
// GET /chat/sessions
chatRouter.get("/sessions", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);
  return c.json({ sessions: rows });
});

// ─── Create session ──────────────────────────────────────
// POST /chat/sessions  { title, patientId? }
chatRouter.post("/sessions", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = chatSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const [row] = await db
    .insert(chatSessions)
    .values({
      userId,
      patientId: parsed.data.patientId || null,
      title: parsed.data.title,
    })
    .returning();
  return c.json({ session: row }, 201);
});

// ─── Get messages ────────────────────────────────────────
// GET /chat/sessions/:id/messages
chatRouter.get("/sessions/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const id = c.req.param("id");

  const [sess] = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, id), eq(chatSessions.userId, userId))
    )
    .limit(1);
  if (!sess) return c.json({ error: "Session not found" }, 404);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(chatMessages.createdAt);

  // Bump updatedAt
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(chatSessions.id, id));

  return c.json({ session: sess, messages: rows });
});

// ─── Send message ────────────────────────────────────────
// POST /chat/sessions/:id/messages  { content }
chatRouter.post("/sessions/:id/messages", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = chatMessageSchema.safeParse({ ...body, sessionId: id });
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [sess] = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, id), eq(chatSessions.userId, userId))
    )
    .limit(1);
  if (!sess) return c.json({ error: "Session not found" }, 404);

  // Persist user message
  const [userMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId: id,
      role: "user",
      content: parsed.data.content,
    })
    .returning();

  // Build context if session has patientId
  let context: any = null;
  if (sess.patientId) {
    const [p] = await db
      .select({ patient: patients, user: users })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.id, sess.patientId))
      .limit(1);
    if (p) {
      const meds = await db
        .select()
        .from(medicines)
        .where(
          and(eq(medicines.patientId, sess.patientId), eq(medicines.active, true))
        )
        .limit(20);
      const allergies = (() => {
        try {
          return p.patient.allergies ? JSON.parse(p.patient.allergies) : [];
        } catch {
          return [];
        }
      })();
      const conditions = (() => {
        try {
          return p.patient.medicalConditions
            ? JSON.parse(p.patient.medicalConditions)
            : [];
        } catch {
          return [];
        }
      })();
      context = {
        name: p.user.name,
        allergies,
        conditions,
        activeMedicines: meds.map((m) => ({ name: m.name, dosage: m.dosage })),
      };
    }
  }

  // Recent history (excluding the message we just inserted)
  const recent = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(20);
  const history: ChatMsg[] = recent.reverse().slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Answer health questions for a patient. Be brief, recommend seeing a doctor for serious issues, never claim to be a doctor."
        ) +
        (context
          ? ` Patient context: ${JSON.stringify(context).slice(0, 1500)}.`
          : ""),
    },
    ...history,
    { role: "user", content: parsed.data.content },
  ];

  let replyText: string;
  try {
    replyText =
      (await aiComplete(aiBinding, messages, {
        maxTokens: 500,
        temperature: 0.4,
      })) || fallbackChat(parsed.data.content);
  } catch (err) {
    console.error("[chat] ai failed", err);
    replyText = fallbackChat(parsed.data.content);
  }

  const [assistantMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId: id,
      role: "assistant",
      content: replyText,
    })
    .returning();

  // Auto-title the session from the first user message
  if (sess.title === "New chat" || sess.title === "Health Q&A") {
    const title = parsed.data.content.slice(0, 60).trim() || "Health Q&A";
    await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(chatSessions.id, id));
  } else {
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(chatSessions.id, id));
  }

  return c.json({ userMessage: userMsg, assistantMessage: assistantMsg });
});

// ─── Delete session ──────────────────────────────────────
// DELETE /chat/sessions/:id
chatRouter.delete("/sessions/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const id = c.req.param("id");

  const [sess] = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, id), eq(chatSessions.userId, userId))
    )
    .limit(1);
  if (!sess) return c.json({ error: "Session not found" }, 404);

  // Cascade delete messages
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
  await db.delete(chatSessions).where(eq(chatSessions.id, id));
  return c.json({ ok: true });
});

export default chatRouter;