// @ts-nocheck

import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import {
  patients,
  users,
  medicalRecords,
  medicines,
  labReports,
  vitals,
  chatSessions,
  chatMessages,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { aiUserRateLimit } from "../middleware/ai-rate-limit";
import {
  aiSummarySchema,
  aiLabExplainSchema,
  aiDrugInteractionSchema,
  aiChatSchema,
  aiOcrSchema,
  aiClinicalNoteSummarySchema,
  aiLabTrendSchema,
  aiSoapDraftSchema,
} from "@healthcare/shared";
import {
  aiComplete,
  cacheGet,
  cacheStore,
  tryParseJson,
  hasShape,
  systemPrompt,
  findStaticInteractions,
  fetchR2Text,
  fallbackSummary,
  fallbackLabExplain,
  fallbackLabTrend,
  fallbackDrugCheck,
  fallbackChat,
  fallbackOcr,
  fallbackClinicalNoteSummary,
  fallbackSoapDraft,
  streamAiComplete,
  type ChatMsg,
} from "../lib/ai";
import { like } from "drizzle-orm";
// `like` is unused now (filtering moved client-side) but kept imported
// to avoid churn if a future route re-introduces server-side LIKE.
import { streamSSE } from "hono/streaming";
import { canAccessPatient, getPatientForUser } from "../lib/access";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const ai = new Hono<AppEnvironment>();

ai.use("*", authMiddleware);
// Day 1 safety floor: per-user 20 calls/hour on /ai/* (env-overridable
// via AI_USER_HOURLY_LIMIT). Mounted AFTER auth so we have userId.
ai.use("*", aiUserRateLimit());

// ─── helpers ─────────────────────────────────────────────

// Extract a usable R2 key from a `fileUrl` (which may be a raw key, an
// absolute URL, or a local file:// URI). Returns "" if it doesn't look
// like a key we can fetch from our R2.
export function extractR2Key(input: string): string {
  if (!input) return "";
  // Raw key (no scheme)
  if (!/^[a-z]+:\/\//i.test(input)) return input.trim();
  try {
    const u = new URL(input);
    if (u.protocol === "http:" || u.protocol === "https:") {
      // Allow only the public R2 host OR our same-origin /files path.
      const host = u.host.toLowerCase();
      if (host.endsWith(".r2.cloudflarestorage.com")) {
        // path-style: /<bucket>/<key>
        const parts = u.pathname.replace(/^\/+/, "").split("/");
        parts.shift(); // drop bucket
        return parts.join("/");
      }
      // Same-origin /files/download/<key>?stream=1
      if (u.pathname.startsWith("/files/download/")) {
        return decodeURIComponent(u.pathname.split("/").pop() || "");
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

// ─── Medical Summary ─────────────────────────────────────
// POST /ai/summary  { patientId }
ai.post("/summary", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiSummarySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  // RBAC: only the patient themselves or a doctor with relationship may summarise.
  const access = await canAccessPatient(db, userId, userRole, parsed.data.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Cache lookup
  const cached = await cacheGet(db, "summary", parsed.data);
  if (cached) return c.json({ summary: cached, cached: true });

  // Gather patient context
  const [patient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.id, parsed.data.patientId))
    .limit(1);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, parsed.data.patientId))
    .orderBy(desc(medicalRecords.date))
    .limit(40);
  const meds = await db
    .select()
    .from(medicines)
    .where(eq(medicines.patientId, parsed.data.patientId))
    .limit(40);
  const labs = await db
    .select()
    .from(labReports)
    .where(eq(labReports.patientId, parsed.data.patientId))
    .orderBy(desc(labReports.createdAt))
    .limit(10);
  const vit = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, parsed.data.patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(20);

  const allergies = (() => {
    try {
      return patient.patient.allergies
        ? JSON.parse(patient.patient.allergies)
        : [];
    } catch {
      return [];
    }
  })();
  const conditions = (() => {
    try {
      return patient.patient.medicalConditions
        ? JSON.parse(patient.patient.medicalConditions)
        : [];
    } catch {
      return [];
    }
  })();

  const context = {
    name: patient.user.name,
    age: patient.patient.dateOfBirth || null,
    gender: patient.patient.gender,
    bloodGroup: patient.patient.bloodGroup,
    allergies,
    conditions,
    recentRecords: records.slice(0, 15).map((r) => ({
      type: r.recordType,
      title: r.title,
      date: r.date,
      diagnosis: r.diagnosis,
      notes: r.notes?.slice(0, 200) || null,
    })),
    activeMedicines: meds
      .filter((m) => m.active)
      .map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        timing: m.timing,
      })),
    recentLabs: labs.map((l) => ({
      type: l.reportType,
      status: l.status,
      summary: l.aiSummary?.slice(0, 200) || null,
    })),
    recentVitals: vit.slice(0, 10).map((v) => ({
      type: v.type,
      value: v.value,
      secondaryValue: v.secondaryValue,
      unit: v.unit,
      recordedAt: v.recordedAt,
    })),
  };

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Summarize a patient's medical history in a clear, structured way."
        ) +
        ' Return JSON with keys: patientSummary (string), diagnoses (string[]), medicines (string[]), history (string[]), risks (string[]), recentTests (string[]).',
    },
    {
      role: "user",
      content: `Summarize this patient's record. Be concise, use plain language, no fabricated facts:\n\n${JSON.stringify(context, null, 2)}`,
    },
  ];

  let summary;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 700,
      temperature: 0.2,
      telemetry: {
        db,
        kind: "summary",
        userId,
        patientId: parsed.data.patientId,
      },
    });
    const parsedJson = tryParseJson<any>(out);
    const safe = hasShape(parsedJson, {
      patientSummary: "string",
      diagnoses: "string[]",
      medicines: "string[]",
      history: "string[]",
      risks: "string[]",
      recentTests: "string[]",
    });
    summary = safe || fallbackSummary();
  } catch (err) {
    console.error("[ai/summary] failed", err);
    summary = fallbackSummary();
  }

  await cacheStore(db, "summary", parsed.data, summary);
  return c.json({ summary });
});

// ─── Lab Report Explanation ──────────────────────────────
// POST /ai/explain/lab-report  { fileUrl, reportId?, textHint? }
ai.post("/explain/lab-report", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const r2 = c.env.R2;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiLabExplainSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const textHint: string | undefined = body.textHint;
  const fileUrl: string = parsed.data.fileUrl;
  const reportId: string | undefined = parsed.data.reportId;

  // RBAC: if reportId is provided, derive patientId from the report and
  // check access. Otherwise require the patientId in the body.
  let patientId: string | undefined = body.patientId;
  if (reportId) {
    const [r] = await db
      .select()
      .from(labReports)
      .where(eq(labReports.id, reportId))
      .limit(1);
    if (!r) return c.json({ error: "Report not found" }, 404);
    patientId = r.patientId;
  }
  if (!patientId) {
    return c.json({ error: "patientId or reportId is required" }, 400);
  }
  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const cacheKey = { fileUrl, textHint: textHint || null, reportId: reportId || null };
  const cached = await cacheGet(db, "lab_explain", cacheKey);
  if (cached) return c.json({ explanation: cached, cached: true });

  // Fetch the file from R2 (safe; no SSRF). Only used if the input is a
  // raw key or our own R2 URL. If extraction fails, we fall back to hint.
  let extracted = textHint || "";
  if (!extracted) {
    const key = extractR2Key(fileUrl);
    if (key) {
      const text = await fetchR2Text(r2, key);
      if (text) extracted = text;
    }
  }

  if (!extracted) {
    const fallback = fallbackLabExplain();
    return c.json({
      explanation: {
        ...fallback,
        explanation:
          "Couldn't read the report file. Please share the text or a clearer scan.",
      },
    });
  }

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Explain a medical lab report in plain language for a patient."
        ) +
        ' Return JSON with keys: explanation (string, 2-3 sentences), recommendations (string[]), abnormalValues (string[]).',
    },
    {
      role: "user",
      content: `Explain this lab report. Highlight abnormal values and what they may indicate. If you don't know, say so.\n\n${extracted.slice(0, 4000)}`,
    },
  ];

  let explanation;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 600,
      temperature: 0.2,
    });
    const parsedJson = tryParseJson<any>(out);
    const safe = hasShape(parsedJson, {
      explanation: "string",
      recommendations: "string[]",
      abnormalValues: "string[]",
    });
    explanation = safe || fallbackLabExplain();
  } catch (err) {
    console.error("[ai/lab-explain] failed", err);
    explanation = fallbackLabExplain();
  }

  await cacheStore(db, "lab_explain", cacheKey, explanation);
  return c.json({ explanation });
});

// ─── Drug Interaction Check ──────────────────────────────
// POST /ai/drug-interaction  { medicines: string[] }
// RBAC: clinicians and patients only. `super_admin`/unknown roles get 403
// so admin probes can't burn Workers-AI quota on a clinical tool.
ai.post("/drug-interaction", requireRole("patient", "doctor", "hospital_admin", "hospital_staff", "pharmacy"), async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiDrugInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const medicines = parsed.data.medicines;

  const cacheKey = { medicines: medicines.map((m) => m.toLowerCase()).sort() };
  const cached = await cacheGet(db, "drug_interaction", cacheKey);
  if (cached) return c.json({ interactions: cached, cached: true });

  // Fast path: curated dataset
  const staticHits = findStaticInteractions(medicines);

  // Slow path: LLM for pairs not in curated set
  let llmHits: Array<{
    medicines: string[];
    severity: "minor" | "moderate" | "severe";
    note: string;
    source: "model";
  }> = [];
  try {
    const messages: ChatMsg[] = [
      {
        role: "system",
        content:
          systemPrompt(
            "Check a list of medicines for known interactions."
          ) +
          ' Return JSON with key "interactions": array of {medicines: [a,b], severity: "minor"|"moderate"|"severe", note: string}. Only return well-known, well-documented interactions; if uncertain, return an empty array.',
      },
      {
        role: "user",
        content: `Medicines: ${JSON.stringify(medicines)}`,
      },
    ];
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 500,
      temperature: 0.1,
    });
    const parsedJson = tryParseJson<{ interactions: any[] }>(out);
    if (parsedJson?.interactions && Array.isArray(parsedJson.interactions)) {
      llmHits = parsedJson.interactions
        .filter(
          (x) =>
            x &&
            Array.isArray(x.medicines) &&
            x.medicines.length >= 2 &&
            ["minor", "moderate", "severe"].includes(x.severity) &&
            typeof x.note === "string"
        )
        .map((x) => ({ ...x, source: "model" as const }));
    }
  } catch (err) {
    console.error("[ai/drug-interaction] LLM failed", err);
  }

  const interactions = [...staticHits, ...llmHits];

  // If we got nothing AND the LLM failed, surface the fallback warning.
  if (interactions.length === 0) {
    const cached = fallbackDrugCheck();
    await cacheStore(db, "drug_interaction", cacheKey, cached.interactions);
    return c.json(cached);
  }

  await cacheStore(db, "drug_interaction", cacheKey, interactions);
  return c.json({ interactions });
});

// ─── Health Chat (stateless wrapper) ─────────────────────
// POST /ai/chat  { message, sessionId?, patientId? }
ai.post("/chat", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const { message, patientId, sessionId } = parsed.data;

  // RBAC: if patientId is provided, only the patient or a doctor with
  // relationship may chat with their context.
  if (patientId) {
    const access = await canAccessPatient(db, userId, userRole, patientId);
    if (!access.allowed) {
      return c.json({ error: "Access denied", reason: access.reason }, 403);
    }
  }

  // Build minimal context. If a patientId is provided, pull a small slice.
  let context: any = null;
  if (patientId) {
    const [p] = await db
      .select({ patient: patients, user: users })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.id, patientId))
      .limit(1);
    if (p) {
      const meds = await db
        .select()
        .from(medicines)
        .where(and(eq(medicines.patientId, patientId), eq(medicines.active, true)))
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
        activeMedicines: meds.map((m) => ({
          name: m.name,
          dosage: m.dosage,
        })),
      };
    }
  }

  // Pull recent chat history if sessionId provided
  let history: ChatMsg[] = [];
  if (sessionId) {
    const [sess] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    if (sess && sess.userId === userId) {
      const recent = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(8);
      history = recent.reverse().map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
    }
  }

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Answer health questions for a patient in a personal health record app. Always be brief, recommend seeing a doctor for serious issues, and never claim to be a doctor."
        ) +
        (context
          ? ` Patient context: ${JSON.stringify(context).slice(0, 1500)}.`
          : ""),
    },
    ...history,
    { role: "user", content: message },
  ];

  let reply: string;
  try {
    reply =
      (await aiComplete(aiBinding, messages, {
        maxTokens: 400,
        temperature: 0.4,
      })) || fallbackChat(message);
  } catch (err) {
    console.error("[ai/chat] failed", err);
    reply = fallbackChat(message);
  }

  return c.json({ response: reply });
});

// ─── Prescription OCR ────────────────────────────────────
// POST /ai/ocr/prescription  { fileUrl, textHint?, patientId? }
ai.post("/ocr/prescription", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const r2 = c.env.R2;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiOcrSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const textHint: string | undefined = body.textHint;
  const fileUrl: string = parsed.data.fileUrl;
  const patientId: string | undefined = body.patientId;

  // RBAC: if patientId is provided, only the patient or a doctor with
  // relationship may run OCR with context. Without a patientId the result
  // is generic (no PHI lookup) — still allowed.
  if (patientId) {
    const access = await canAccessPatient(db, userId, userRole, patientId);
    if (!access.allowed) {
      return c.json({ error: "Access denied", reason: access.reason }, 403);
    }
  }

  const cacheKey = { fileUrl, textHint: textHint || null };
  const cached = await cacheGet(db, "ocr", cacheKey);
  if (cached) return c.json({ result: cached, cached: true });

  let text = textHint || "";
  if (!text) {
    const key = extractR2Key(fileUrl);
    if (key) {
      text = await fetchR2Text(r2, key);
    }
  }

  if (!text) {
    return c.json({ result: fallbackOcr() });
  }

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Extract structured data from a prescription image/text."
        ) +
        ' Return JSON with keys: medicines (array of {name, dosage, frequency, timing}), doctor (string), date (string YYYY-MM-DD), diagnosis (string). If a field cannot be determined, return empty string or empty array.',
    },
    {
      role: "user",
      content: `Prescription text:\n\n${text.slice(0, 4000)}`,
    },
  ];

  let result;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 600,
      temperature: 0.1,
    });
    const parsedJson = tryParseJson<any>(out);
    const safe = hasShape(parsedJson, {
      medicines: "object",
      doctor: "string",
      date: "string",
      diagnosis: "string",
    });
    result = safe || fallbackOcr();
    // Normalise medicines array shape
    if (Array.isArray((result as any).medicines)) {
      (result as any).medicines = (result as any).medicines
        .filter((m: any) => m && typeof m.name === "string")
        .map((m: any) => ({
          name: String(m.name).trim(),
          dosage: typeof m.dosage === "string" ? m.dosage : "",
          frequency: typeof m.frequency === "string" ? m.frequency : "",
          timing: typeof m.timing === "string" ? m.timing : "",
        }));
    } else {
      (result as any).medicines = [];
    }
  } catch (err) {
    console.error("[ai/ocr] failed", err);
    result = fallbackOcr();
  }

  await cacheStore(db, "ocr", cacheKey, result);
  return c.json({ result });
});

// ─── Streaming Health Chat ───────────────────────────────
// POST /ai/chat/stream  { message, sessionId?, patientId? }
//
// Token-streaming variant of `/ai/chat`. Emits SSE `delta` events with
// incremental text chunks; final event carries `done: true`. Shares
// RBAC + context assembly with the JSON endpoint. Cancels upstream
// the moment the client disconnects.
ai.post("/chat/stream", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const { message, patientId, sessionId } = parsed.data;

  if (patientId) {
    const access = await canAccessPatient(db, userId, userRole, patientId);
    if (!access.allowed) {
      return c.json({ error: "Access denied", reason: access.reason }, 403);
    }
  }

  // Build the same context/history as /ai/chat.
  let context: any = null;
  if (patientId) {
    const [p] = await db
      .select({ patient: patients, user: users })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.id, patientId))
      .limit(1);
    if (p) {
      const meds = await db
        .select()
        .from(medicines)
        .where(and(eq(medicines.patientId, patientId), eq(medicines.active, true)))
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

  let history: ChatMsg[] = [];
  if (sessionId) {
    const [sess] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    if (sess && sess.userId === userId) {
      const recent = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(8);
      history = recent.reverse().map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
    }
  }

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Answer health questions for a patient in a personal health record app. Always be brief, recommend seeing a doctor for serious issues, and never claim to be a doctor."
        ) +
        (context
          ? ` Patient context: ${JSON.stringify(context).slice(0, 1500)}.`
          : ""),
    },
    ...history,
    { role: "user", content: message },
  ];

  return streamSSE(c, async (stream) => {
    const signal = stream.abortSignal;
    let full = "";
    try {
      for await (const delta of streamAiComplete(aiBinding, messages, {
        maxTokens: 400,
        temperature: 0.4,
        signal,
        telemetry: {
          db,
          kind: "chat",
          userId,
          patientId: patientId ?? null,
        },
      })) {
        full += delta;
        await stream.writeSSE({
          event: "delta",
          data: JSON.stringify({ delta }),
        });
      }
      // If the model yielded nothing, emit a fallback once.
      if (!full) {
        full = fallbackChat(message);
        await stream.writeSSE({ event: "delta", data: JSON.stringify({ delta: full }) });
      }
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ done: true, response: full }),
      });
    } catch (err) {
      console.error("[ai/chat/stream] failed", err);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: (err as Error)?.message || "stream failed" }),
      });
    }
  });
});

// ─── Streaming Lab Report Explanation ────────────────────
// POST /ai/explain/lab-report/stream  { fileUrl, reportId?, textHint? }
//
// Streams incremental plain-language explanation. Emits `delta` chunks
// of free-form text (not the structured JSON the non-streaming endpoint
// returns). Useful for "explain this report" drawers where progressive
// rendering beats a 25 s spinner.
ai.post("/explain/lab-report/stream", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const r2 = c.env.R2;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiLabExplainSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const textHint: string | undefined = body.textHint;
  const fileUrl: string = parsed.data.fileUrl;
  const reportId: string | undefined = parsed.data.reportId;

  let patientId: string | undefined = body.patientId;
  if (reportId) {
    const [r] = await db
      .select()
      .from(labReports)
      .where(eq(labReports.id, reportId))
      .limit(1);
    if (!r) return c.json({ error: "Report not found" }, 404);
    patientId = r.patientId;
  }
  if (!patientId) {
    return c.json({ error: "patientId or reportId is required" }, 400);
  }
  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  let extracted = textHint || "";
  if (!extracted) {
    const key = extractR2Key(fileUrl);
    if (key) extracted = await fetchR2Text(r2, key);
  }

  return streamSSE(c, async (stream) => {
    const signal = stream.abortSignal;
    if (!extracted) {
      await stream.writeSSE({
        event: "delta",
        data: JSON.stringify({
          delta:
            "Couldn't read the report file. Please share the text or a clearer scan.",
        }),
      });
      await stream.writeSSE({ event: "done", data: JSON.stringify({ done: true }) });
      return;
    }

    const messages: ChatMsg[] = [
      {
        role: "system",
        content: systemPrompt(
          "Explain a medical lab report in plain language for a patient."
        ),
      },
      {
        role: "user",
        content: `Explain this lab report. Highlight abnormal values and what they may indicate. If you don't know, say so.\n\n${extracted.slice(0, 4000)}`,
      },
    ];

    let full = "";
    try {
      for await (const delta of streamAiComplete(aiBinding, messages, {
        maxTokens: 600,
        temperature: 0.2,
        signal,
      })) {
        full += delta;
        await stream.writeSSE({ event: "delta", data: JSON.stringify({ delta }) });
      }
      if (!full) {
        const fb = fallbackLabExplain();
        await stream.writeSSE({
          event: "delta",
          data: JSON.stringify({ delta: fb.explanation }),
        });
      }
      await stream.writeSSE({ event: "done", data: JSON.stringify({ done: true, response: full }) });
    } catch (err) {
      console.error("[ai/lab-explain/stream] failed", err);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: (err as Error)?.message || "stream failed" }),
      });
    }
  });
});

// ─── Clinical Note Summary (Day 2 #1) ───────────────────
//
// POST /ai/clinical-note-summary  { patientId, noteText, locale? }
//
// Accepts a doctor's free-text note + patient id, returns:
//   { summary, soap: { subjective, objective, assessment, plan }, keyTerms[] }
//
// RBAC: same `canAccessPatient` gate as /ai/summary — only the patient
// or a doctor with an active relationship may summarise against that
// patient's context. (We do NOT inject prior records into the prompt;
// the model summarises ONLY what the doctor wrote — keeps PHI surface
// small and prevents accidental disclosures across roles.)
//
// Cache: 24h by `(patientId, hash(noteText))`. Two doctors typing the
// same words on the same patient hit the same row.
ai.post("/clinical-note-summary", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiClinicalNoteSummarySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const { patientId, noteText } = parsed.data;

  // RBAC
  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const cacheKey = { patientId, noteText: noteText.trim() };
  const cached = await cacheGet(db, "clinical_note_summary", cacheKey);
  if (cached) return c.json({ summary: cached, cached: true });

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Summarise a doctor's free-text clinical note into structured SOAP fields."
        ) +
        ' Return JSON with keys: summary (string, 1 sentence, <= 30 words), ' +
        "soap (object with keys: subjective, objective, assessment, plan — each a short string), " +
        "keyTerms (array of short strings — diagnoses, symptoms, meds, follow-ups mentioned). " +
        "If a SOAP field is not mentioned in the note, leave it as an empty string. " +
        "Be concise. Do not invent facts.",
    },
    {
      role: "user",
      content: `Doctor's note:\n\n${noteText.slice(0, 4000)}`,
    },
  ];

  let summary;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 500,
      temperature: 0.2,
      telemetry: {
        db,
        kind: "clinical_note_summary",
        userId,
        patientId,
      },
    });
    const parsedJson = tryParseJson<any>(out);
    const safe =
      parsedJson &&
      typeof parsedJson === "object" &&
      typeof parsedJson.summary === "string" &&
      parsedJson.soap &&
      typeof parsedJson.soap === "object"
        ? {
            summary: String(parsedJson.summary).slice(0, 500),
            soap: {
              subjective: String(parsedJson.soap.subjective ?? "").slice(0, 1000),
              objective: String(parsedJson.soap.objective ?? "").slice(0, 1000),
              assessment: String(parsedJson.soap.assessment ?? "").slice(0, 1000),
              plan: String(parsedJson.soap.plan ?? "").slice(0, 1000),
            },
            keyTerms: Array.isArray(parsedJson.keyTerms)
              ? parsedJson.keyTerms
                  .filter((x: any) => typeof x === "string")
                  .map((x: string) => x.slice(0, 80))
                  .slice(0, 30)
              : [],
          }
        : fallbackClinicalNoteSummary();
    summary = safe;
  } catch (err) {
    console.error("[ai/clinical-note-summary] failed", err);
    summary = fallbackClinicalNoteSummary();
  }

  await cacheStore(db, "clinical_note_summary", cacheKey, summary);
  return c.json({ summary });
});

// ─── Lab-Test Trend Narrative (Day 3 #6) ─────────────────
//
// GET /ai/lab-trend?patientId=...&type=HbA1c&months=24
//
// We don't have numeric test values in `lab_reports` (just `reportType`
// + `status` + `createdAt`), so the trend is the cadence of testing —
// useful for chronic patients who need to know if they're overdue
// ("HbA1c was last done 14 months ago, guidelines say every 3").
//
// The LLM layers a short narrative on top of the structural skeleton
// so the patient gets a plain-language takeaway, not just a table.
//
// Cache: 6h by `(patientId, type, months)`. Faster than the global
// 24h default because test cadence shouldn't drift mid-day but the
// underlying data may.
ai.get("/lab-trend", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = {
    patientId: c.req.query("patientId") || "",
    type: c.req.query("type") || "",
    months: c.req.query("months") ? Number(c.req.query("months")) : undefined,
    locale: c.req.query("locale") || undefined,
  };
  const parsed = aiLabTrendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const { patientId, type, months } = parsed.data;
  const windowMonths = months ?? 24;
  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const cacheKey = { patientId, type: type.toLowerCase(), months: windowMonths };
  const cached = await cacheGet(db, "lab_trend", cacheKey);
  if (cached) return c.json({ trend: cached, cached: true });

  // Pull matching reports. Case-insensitive substring match on the
  // user-supplied type label — patients type "hba1c" / "HbA1c" /
  // "HBA1C" interchangeably. We do the matching client-side over the
  // last 200 reports for the patient; D1 doesn't index free-form
  // substrings and the set is bounded enough that JS filtering is
  // faster than chasing a LIKE plan.
  const cutoff = new Date(Date.now() - windowMonths * 30 * 24 * 60 * 60 * 1000)
    .toISOString();
  const typeNeedle = type.toLowerCase();
  const rows = await db
    .select({
      id: labReports.id,
      reportType: labReports.reportType,
      status: labReports.status,
      createdAt: labReports.createdAt,
    })
    .from(labReports)
    .where(eq(labReports.patientId, patientId))
    .orderBy(desc(labReports.createdAt))
    .limit(200);

  const matched = rows.filter((r) =>
    (r.reportType || "").toLowerCase().includes(typeNeedle)
  );
  const inWindow = matched.filter((r) => (r.createdAt || "") >= cutoff);

  const series = inWindow.map((r) => ({
    date: (r.createdAt || "").slice(0, 10),
    status: r.status || "unknown",
  }));

  // Reference cutoff is used in the prompt; the model uses it to flag
  // "overdue" patterns.
  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Summarise a patient's lab-test cadence and highlight overdue testing."
        ) +
        ' Return JSON with keys: narrative (string, 1-2 short sentences for a patient), ' +
        "overdue (boolean — true if the most recent test is older than the typical interval for this test), " +
        "intervalMonths (number — typical recommended gap in months; null if unknown), " +
        "nextSuggestedDate (string YYYY-MM-DD; null if unknown). Be concise; do not fabricate dates.",
    },
    {
      role: "user",
      content: `Test type: ${type}\nWindow: last ${windowMonths} months (since ${cutoff.slice(0, 10)})\nSeries (most recent first): ${JSON.stringify(series)}`,
    },
  ];

  let trend;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 250,
      temperature: 0.2,
      telemetry: {
        db,
        kind: "lab_trend",
        userId,
        patientId,
      },
    });
    const parsedJson = tryParseJson<any>(out);
    const skeleton = fallbackLabTrend(type, series);
    trend = {
      ...skeleton,
      narrative:
        (typeof parsedJson?.narrative === "string" && parsedJson.narrative) ||
        skeleton.narrative,
      overdue: typeof parsedJson?.overdue === "boolean" ? parsedJson.overdue : null,
      intervalMonths:
        typeof parsedJson?.intervalMonths === "number"
          ? parsedJson.intervalMonths
          : null,
      nextSuggestedDate:
        typeof parsedJson?.nextSuggestedDate === "string"
          ? parsedJson.nextSuggestedDate.slice(0, 10)
          : null,
    };
  } catch (err) {
    console.error("[ai/lab-trend] failed", err);
    trend = fallbackLabTrend(type, series);
  }

  await cacheStore(db, "lab_trend", cacheKey, trend, 60 * 60 * 6);
  return c.json({ trend });
});

// ─── SOAP-note draft generator (Day 4 #9) ────────────────
//
// POST /ai/soap-draft  { patientId, bullets: { subjective, objective, assessment, plan } }
//
// Inverse of /ai/clinical-note-summary: instead of distilling free-text
// into SOAP, this takes short bullet observations and asks the model
// to draft full-sentence SOAP prose a doctor can paste into the chart.
//
// RBAC: same `canAccessPatient` gate — only the patient or a doctor
// with an active relationship may draft against that patient.
//
// Cache: 24h by hash(bullets) — the same bullet list from the same
// patient hits the same row.
ai.post("/soap-draft", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const userId = c.get("userId");
  const userRole = c.get("dbUser")?.role || "patient";
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiSoapDraftSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const { patientId, bullets } = parsed.data;

  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Pre-flight: at least one bullet must be non-empty so we don't
  // spend a call on a fully-blank form.
  const anyBullet = Object.values(bullets).some((v) => (v ?? "").trim());
  if (!anyBullet) {
    return c.json(
      { error: "At least one bullet must be provided" },
      400
    );
  }

  const cacheKey = { patientId, bullets };
  const cached = await cacheGet(db, "soap_draft", cacheKey);
  if (cached) return c.json({ draft: cached, cached: true });

  // Build the user prompt from the bullets. Empty sections become
  // explicit "—" placeholders so the model knows they're missing.
  const promptBullets = {
    subjective: bullets.subjective?.trim() || "—",
    objective: bullets.objective?.trim() || "—",
    assessment: bullets.assessment?.trim() || "—",
    plan: bullets.plan?.trim() || "—",
  };

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        systemPrompt(
          "Draft clinical SOAP prose from short bullet observations."
        ) +
        ' Return JSON with keys: subjective, objective, assessment, plan — each a short paragraph (1-3 sentences). ' +
        "Expand telegraphic bullets into full clinical language but do NOT fabricate findings. " +
        "Where a section's bullet was '—', return an empty string for that section.",
    },
    {
      role: "user",
      content: `Patient: ${patientId}\n\nBullets:\n${JSON.stringify(promptBullets, null, 2)}`,
    },
  ];

  let draft;
  try {
    const out = await aiComplete(aiBinding, messages, {
      maxTokens: 600,
      temperature: 0.2,
      telemetry: {
        db,
        kind: "soap_draft",
        userId,
        patientId,
      },
    });
    const parsedJson = tryParseJson<any>(out);
    draft =
      parsedJson &&
      typeof parsedJson === "object" &&
      typeof parsedJson.subjective === "string" &&
      typeof parsedJson.objective === "string" &&
      typeof parsedJson.assessment === "string" &&
      typeof parsedJson.plan === "string"
        ? {
            subjective: parsedJson.subjective.slice(0, 1500),
            objective: parsedJson.objective.slice(0, 1500),
            assessment: parsedJson.assessment.slice(0, 1500),
            plan: parsedJson.plan.slice(0, 1500),
            draftedByAI: true,
          }
        : { ...fallbackSoapDraft(bullets), draftedByAI: false };
  } catch (err) {
    console.error("[ai/soap-draft] failed", err);
    draft = { ...fallbackSoapDraft(bullets), draftedByAI: false };
  }

  await cacheStore(db, "soap_draft", cacheKey, draft);
  return c.json({ draft });
});

export default ai;
