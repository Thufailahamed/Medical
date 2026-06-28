import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const ai = new Hono<AppEnvironment>();

// ─── Medical Summary ─────────────────────────────────────
ai.post("/summary", authMiddleware, async (c) => {
  const { patientId } = await c.req.json();

  // TODO: Fetch all records for patient
  // TODO: Send to OpenAI/Gemini
  // TODO: Return structured summary

  return c.json({
    summary: {
      patientSummary: "",
      diagnoses: [],
      medicines: [],
      history: [],
      risks: [],
      recentTests: [],
    },
  });
});

// ─── Lab Report Explanation ──────────────────────────────
ai.post("/explain/lab-report", authMiddleware, async (c) => {
  const { fileUrl } = await c.req.json();

  // TODO: Download file from R2
  // TODO: Extract text (OCR if image)
  // TODO: Send to AI for explanation
  // TODO: Return human-readable explanation

  return c.json({
    explanation: "",
    recommendations: [],
    abnormalValues: [],
  });
});

// ─── Drug Interaction Check ──────────────────────────────
ai.post("/drug-interaction", authMiddleware, async (c) => {
  const { medicines } = await c.req.json();

  // TODO: Send medicine list to AI
  // TODO: Check for interactions

  return c.json({
    interactions: [],
    warnings: [],
  });
});

// ─── AI Chat ─────────────────────────────────────────────
ai.post("/chat", authMiddleware, async (c) => {
  const { message } = await c.req.json();

  // TODO: Send to AI with medical context
  // TODO: Return response

  return c.json({
    response: "",
  });
});

// ─── OCR Prescription ────────────────────────────────────
ai.post("/ocr/prescription", authMiddleware, async (c) => {
  const { fileUrl } = await c.req.json();

  // TODO: Download image from R2
  // TODO: OCR to extract text
  // TODO: Parse medicines from text
  // TODO: Return structured data

  return c.json({
    medicines: [],
    doctor: "",
    date: "",
    diagnosis: "",
  });
});

export default ai;
