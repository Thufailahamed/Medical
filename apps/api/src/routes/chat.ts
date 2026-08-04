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
import { getPatientHealthContext, APP_USER_GUIDE_KNOWLEDGE } from "../lib/ai/knowledge-context";
import { getPatientForUser } from "../lib/access";
import {
  aiComplete,
  systemPrompt,
  fallbackChat,
  streamAiComplete,
  type ChatMsg,
} from "../lib/ai";
import { streamSSE } from "hono/streaming";
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

  // Build context
  let targetPatientId = sess.patientId;
  if (!targetPatientId && userId) {
    const p = await getPatientForUser(db, userId);
    if (p) targetPatientId = p.id;
  }

  let healthSnapshot: any = null;
  if (targetPatientId) {
    healthSnapshot = await getPatientHealthContext(db, targetPatientId);
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

  const chatSystemPrompt =
    "You are an AI Health & System Assistant for a personal health application. " +
    "Answer medical and app questions in friendly, plain conversational text with clear bullet points. " +
    "CRITICAL: Do NOT output raw JSON code blocks or raw JSON objects. Format all lab test explanations, medication reviews, and health answers into easy-to-read text. " +
    "Always advise consulting a licensed physician for diagnosis or emergency symptoms." +
    (healthSnapshot
      ? `\n\nPatient Medical Snapshot: ${JSON.stringify(healthSnapshot).slice(0, 3000)}.`
      : "") +
    `\n\n${APP_USER_GUIDE_KNOWLEDGE}`;

  const messages: ChatMsg[] = [
    {
      role: "system",
      content: chatSystemPrompt,
    },
    ...history,
    { role: "user", content: parsed.data.content },
  ];

  let rawReplyText: string;
  try {
    rawReplyText = await aiComplete(aiBinding, messages, {
      maxTokens: 600,
      temperature: 0.3,
      apiKey: (c.env as any).GEMINI_API_KEY,
    });
  } catch (err) {
    console.error("[chat] ai failed", err);
    rawReplyText = "";
  }

  if (!rawReplyText || rawReplyText.includes("trouble reaching the assistant")) {
    rawReplyText = smartFallbackChat(parsed.data.content, healthSnapshot);
  }

  // Format reply text
  let replyText = rawReplyText.trim();
  if (replyText.startsWith("```json")) {
    replyText = replyText.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (replyText.startsWith("```")) {
    replyText = replyText.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  if (replyText.startsWith("{") && replyText.endsWith("}")) {
    try {
      const obj = JSON.parse(replyText);
      if (obj.summary || obj.explanation || obj.text) {
        let out = (obj.summary || obj.explanation || obj.text) + "\n";
        if (obj.test_results) {
          out += "\nTest Results Summary:\n";
          for (const [cat, items] of Object.entries(obj.test_results)) {
            out += `\n• ${cat.replace(/_/g, " ").toUpperCase()}:\n`;
            if (typeof items === "object" && items !== null) {
              for (const [k, v] of Object.entries(items)) {
                out += `  - ${k.replace(/_/g, " ")}: ${v}\n`;
              }
            }
          }
        }
        if (Array.isArray(obj.abnormalValues) && obj.abnormalValues.length > 0) {
          out += "\nAbnormal Values: " + obj.abnormalValues.join(", ") + "\n";
        }
        if (Array.isArray(obj.recommendations) && obj.recommendations.length > 0) {
          out += "\nRecommendations:\n" + obj.recommendations.map((r: string) => `• ${r}`).join("\n");
        }
        replyText = out.trim();
      }
    } catch {
      /* return clean string */
    }
  }

  // Generate source citations matching patient records
  const msgLower = parsed.data.content.toLowerCase();
  const citations = (healthSnapshot?.recentRecords || [])
    .filter(
      (r: any) =>
        msgLower.includes((r.title || "").toLowerCase()) ||
        msgLower.includes("lab") ||
        msgLower.includes("report") ||
        msgLower.includes("record") ||
        msgLower.includes("blood") ||
        msgLower.includes("test")
    )
    .slice(0, 3)
    .map((r: any) => ({
      recordId: r.id,
      title: r.title,
      kind: r.kind ?? "record",
      date: r.date,
    }));

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

  return c.json({ userMessage: userMsg, assistantMessage: assistantMsg, message: assistantMsg, citations }, 201);
});

// ─── Streaming send ──────────────────────────────────────
// POST /chat/sessions/:id/messages/stream  { content }
//
// Token-streaming variant. Emits `userMessage` first, then incremental
// `delta` events as the model generates the assistant reply, then a
// final `done` event carrying the persisted assistant message. The
// user message is persisted before streaming begins (so a mid-stream
// disconnect still preserves the user's intent); the assistant row is
// inserted after the stream completes with the accumulated text.
chatRouter.post("/sessions/:id/messages/stream", async (c) => {
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
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!sess) return c.json({ error: "Session not found" }, 404);

  const [userMsg] = await db
    .insert(chatMessages)
    .values({ sessionId: id, role: "user", content: parsed.data.content })
    .returning();

  // Build context (same as non-streaming)
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
        .where(and(eq(medicines.patientId, sess.patientId), eq(medicines.active, true)))
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
        (context ? ` Patient context: ${JSON.stringify(context).slice(0, 1500)}.` : ""),
    },
    ...history,
    { role: "user", content: parsed.data.content },
  ];

  return streamSSE(c, async (stream) => {
    const signal = stream.abortSignal;
    let replyText = "";

    // Emit the user message first so the client can render immediately.
    await stream.writeSSE({
      event: "user",
      data: JSON.stringify({ userMessage: userMsg }),
    });

    try {
      for await (const delta of streamAiComplete(aiBinding, messages, {
        maxTokens: 500,
        temperature: 0.4,
        signal,
      })) {
        replyText += delta;
        await stream.writeSSE({ event: "delta", data: JSON.stringify({ delta }) });
      }
    } catch (err) {
      console.error("[chat/stream] ai failed", err);
    }

    if (!replyText) replyText = fallbackChat(parsed.data.content);

    const [assistantMsg] = await db
      .insert(chatMessages)
      .values({ sessionId: id, role: "assistant", content: replyText })
      .returning();

    // Auto-title on first user message
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

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ done: true, assistantMessage: assistantMsg }),
    });
  });
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