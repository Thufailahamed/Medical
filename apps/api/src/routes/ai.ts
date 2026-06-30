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
  hasShape,
  systemPrompt,
  findStaticInteractions,
  fetchR2Text,
  fallbackSummary,
  fallbackLabExplain,
  fallbackDrugCheck,
  fallbackChat,
  fallbackOcr,
  type ChatMsg,
} from "../lib/ai";
import { canAccessPatient, getPatientForUser } from "../lib/access";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const ai = new Hono<AppEnvironment>();

ai.use("*", authMiddleware);

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
// No RBAC: drugs are non-PHI; any logged-in user may check.
ai.post("/drug-interaction", async (c) => {
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

export default ai;
