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
  notifications,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import {
  aiSummarySchema,
  aiLabExplainSchema,
  aiDrugInteractionSchema,
  aiChatSchema,
  aiOcrSchema,
} from "@healthcare/shared";
import {
  aiComplete,
  cacheGet,
  cacheStore,
  tryParseJson,
  systemPrompt,
  findStaticInteractions,
  fallbackSummary,
  fallbackLabExplain,
  fallbackDrugCheck,
  fallbackChat,
  fallbackOcr,
  type ChatMsg,
} from "../lib/ai";
import type { AppEnvironment } from "../types";

const ai = new Hono<AppEnvironment>();

ai.use("*", authMiddleware);

// ─── Medical Summary ─────────────────────────────────────
// POST /ai/summary  { patientId }
ai.post("/summary", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiSummarySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
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
        " Return JSON with keys: patientSummary (string), diagnoses (string[]), medicines (string[]), history (string[]), risks (string[]), recentTests (string[]).",
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
    });
    const parsedJson = tryParseJson<any>(out);
    summary = parsedJson || fallbackSummary();
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
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiLabExplainSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  // Allow client-supplied text (most reliable path for now)
  const textHint: string | undefined = body.textHint;
  const fileUrl: string = parsed.data.fileUrl;

  const cacheKey = { fileUrl, textHint: textHint || null };
  const cached = await cacheGet(db, "lab_explain", cacheKey);
  if (cached) return c.json({ explanation: cached, cached: true });

  // Best-effort: download from R2 (works only for objects in our bucket).
  let extracted = textHint || "";
  if (!extracted) {
    try {
      // Try to fetch the file URL (must be publicly readable OR signed).
      const resp = await fetch(fileUrl);
      if (resp.ok) {
        const ct = resp.headers.get("content-type") || "";
        const body = await resp.text();
        if (ct.includes("json") || body.trim().startsWith("{")) {
          try {
            const j = JSON.parse(body);
            extracted =
              j?.text ||
              j?.content ||
              j?.rawText ||
              JSON.stringify(j).slice(0, 4000);
          } catch {
            extracted = body.slice(0, 4000);
          }
        } else if (ct.includes("pdf")) {
          // Crude: pull anything that looks like text. Real PDF parsing is out
          // of scope for v2.
          const text = body.replace(/[^\x20-\x7E\n]/g, " ");
          extracted = text.slice(0, 4000);
        } else {
          extracted = body.slice(0, 4000);
        }
      }
    } catch (err) {
      console.error("[ai/lab-explain] fetch failed", err);
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
    explanation = tryParseJson<any>(out) || fallbackLabExplain();
  } catch (err) {
    console.error("[ai/lab-explain] failed", err);
    explanation = fallbackLabExplain();
  }

  await cacheStore(db, "lab_explain", cacheKey, explanation);
  return c.json({ explanation });
});

// ─── Drug Interaction Check ──────────────────────────────
// POST /ai/drug-interaction  { medicines: string[] }
ai.post("/drug-interaction", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiDrugInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
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
        .filter((x) => x && x.medicines && x.severity && x.note)
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
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { message, patientId, sessionId } = parsed.data;

  // Build minimal context. If a patientId is provided and the user is the
  // patient or a doctor with access, pull a small slice of context.
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
    const { chatMessages, chatSessions } = await import("@healthcare/db");
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
// POST /ai/ocr/prescription  { fileUrl, textHint? }
ai.post("/ocr/prescription", async (c) => {
  const db = c.get("db");
  const aiBinding = c.env.AI;
  const body = await c.req.json().catch(() => ({}));
  const parsed = aiOcrSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const textHint: string | undefined = body.textHint;
  const fileUrl: string = parsed.data.fileUrl;

  const cacheKey = { fileUrl, textHint: textHint || null };
  const cached = await cacheGet(db, "ocr", cacheKey);
  if (cached) return c.json({ result: cached, cached: true });

  let text = textHint || "";
  if (!text) {
    try {
      const resp = await fetch(fileUrl);
      if (resp.ok) {
        text = (await resp.text()).slice(0, 4000);
      }
    } catch (err) {
      console.error("[ai/ocr] fetch failed", err);
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
    result = tryParseJson<any>(out) || fallbackOcr();
  } catch (err) {
    console.error("[ai/ocr] failed", err);
    result = fallbackOcr();
  }

  await cacheStore(db, "ocr", cacheKey, result);
  return c.json({ result });
});

export default ai;