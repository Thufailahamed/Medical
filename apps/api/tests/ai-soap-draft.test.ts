// tests/ai-soap-draft.test.ts
//
// Day 4 #9 — SOAP-note draft generator.
//
// Asserts:
//   (1) 400 when all bullets are empty (Zod + pre-flight).
//   (2) 200 with polished SOAP prose on happy path.
//   (3) Fallback shape (draftedByAI=false) when AI returns garbage.
//   (4) 403 when caller can't access the patient.

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { Hono } from "hono";
import { sign } from "hono/jwt";
import aiRouter from "../src/routes/ai";
import type { AppEnvironment } from "../src/types";
import { MockD1 } from "./_mockDb";

const TEST_SECRET = "test-secret-soap-draft";

async function makeToken(userId: string): Promise<string> {
  return sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 } as any,
    TEST_SECRET
  );
}

function buildFakeAi(json: any) {
  const text = typeof json === "string" ? json : JSON.stringify(json);
  return {
    async run(_model: string, opts: any) {
      if (opts?.stream) {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ response: text })}\n\n`
              )
            );
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(body, {
          headers: { "content-type": "text/event-stream" },
        });
      }
      return { response: text };
    },
  };
}

async function buildApp(
  db: MockD1,
  user: { id: string; role: string },
  aiJson: any
) {
  const app = new Hono<AppEnvironment>();
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@x.local`, name: "T" },
  ]);
  db.seed("patients", [{ id: "pat-1", userId: user.id }]);
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).JWT_SECRET = TEST_SECRET;
    (c.env as any).AI = buildFakeAi(aiJson);
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const token = await makeToken(user.id);
    const req = new Request(c.req.raw, {
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        Authorization: `Bearer ${token}`,
      },
    });
    c.req.raw = req;
    await next();
  });
  app.route("/ai", aiRouter);
  return app;
}

describe("/ai/soap-draft", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("rejects all-empty bullets with 400", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" }, {});
    const res = await app.request("/ai/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-1",
        bullets: {
          subjective: "",
          objective: "  ",
          assessment: "",
          plan: "",
        },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns polished SOAP prose on happy path", async () => {
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      {
        subjective:
          "Patient is a 55-year-old male presenting with crushing substernal chest pain of 30 minutes duration, radiating to the left arm.",
        objective:
          "BP 130/85, HR 88, RR 16. ECG shows normal sinus rhythm without acute ST changes.",
        assessment:
          "Atypical chest pain with low cardiac risk profile; cannot rule out acute coronary syndrome.",
        plan:
          "Serial troponins, aspirin 325 mg PO, cardiology consult, follow-up in 1 week.",
      }
    );
    const res = await app.request("/ai/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-1",
        bullets: {
          subjective: "55M chest pain 30min radiating L arm",
          objective: "BP 130/85 HR 88 ECG NSR",
          assessment: "atypical chest pain, low cardiac risk",
          plan: "serial troponin, ASA, cards consult",
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draft.draftedByAI).toBe(true);
    expect(body.draft.subjective).toContain("chest pain");
    expect(body.draft.plan).toContain("troponin");
  });

  it("returns fallback shape when AI returns non-JSON", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" }, "not json");
    const res = await app.request("/ai/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-1",
        bullets: { subjective: "chest pain" },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draft.draftedByAI).toBe(false);
    expect(body.draft.subjective).toBe("chest pain");
  });

  it("returns 403 when caller cannot access the patient", async () => {
    const db2 = new MockD1();
    db2.seed("users", [
      { id: "user-other", role: "patient", email: "u@x.local", name: "T" },
      { id: "user-owner", role: "patient", email: "o@x.local", name: "O" },
    ]);
    // Seed pat-1 with a DIFFERENT userId so user-other is denied.
    db2.seed("patients", [{ id: "pat-1", userId: "user-owner" }]);
    const app = await buildApp(db2, { id: "user-other", role: "patient" }, {});
    const res = await app.request("/ai/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-1",
        bullets: { subjective: "x" },
      }),
    });
    expect(res.status).toBe(403);
  });
});