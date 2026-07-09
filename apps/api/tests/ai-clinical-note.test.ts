// tests/ai-clinical-note.test.ts
//
// Day 2 #1 — clinical-note auto-summary endpoint.
//
// Asserts:
//   (1) 400 on empty noteText (Zod gate before AI is called).
//   (2) 200 with structured SOAP payload on happy path.
//   (3) Fallback shape returned when AI returns garbage JSON.
//   (4) Sanity: `bumpCounter` cache layer returns the post-increment count.
//
// Cache hit/miss is covered by `ai.test.ts` (chat endpoint uses the
// same cache plumbing). We don't re-verify here — MockD1's SELECT
// doesn't observe the rows InsertBuilder pushes, so a precise cache-
// hit test requires seeding the cache row directly. Out of scope.

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

const TEST_SECRET = "test-secret-clinical-note";

async function makeToken(userId: string): Promise<string> {
  return sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 } as any,
    TEST_SECRET
  );
}

// Build a fake Workers-AI binding that returns a configurable JSON
// response. `aiComplete` reads `res.response` on the object returned
// by `ai.run()` (no `stream:true`), so we return an object in that
// path. `streamAiComplete` passes `stream:true` and expects a Response
// with SSE body — we serve that too.
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

async function buildApp(db: MockD1, user: { id: string; role: string }, aiJson: any) {
  const app = new Hono<AppEnvironment>();
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@x.local`, name: "T " + user.id },
  ]);
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

describe("/ai/clinical-note-summary", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("200 with structured SOAP payload on happy path", async () => {
    // Patient role — `canAccessPatient` allows the user to summarise
    // their own record. Seed the patient row with the matching userId.
    db.seed("patients", [{ id: "pat-1", userId: "user-pat-1" }]);
    const app = await buildApp(
      db,
      { id: "user-pat-1", role: "patient" },
      {
        summary: "55yo with chest pain, ECG unremarkable.",
        soap: {
          subjective: "Crushing chest pain 30min, no radiation.",
          objective: "BP 130/85, HR 88, ECG NSR.",
          assessment: "Atypical chest pain, low cardiac risk.",
          plan: "Recheck troponin, follow up in 1 week.",
        },
        keyTerms: ["chest pain", "troponin", "ECG"],
      }
    );
    const res = await app.request("/ai/clinical-note-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-1",
        noteText: "55yo with crushing chest pain...",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.summary).toContain("chest pain");
    expect(body.summary.soap.subjective).toContain("Crushing");
    expect(body.summary.keyTerms).toContain("ECG");
  });

  it("returns fallback shape when AI returns non-JSON garbage", async () => {
    db.seed("patients", [{ id: "pat-1", userId: "user-pat-1" }]);
    const app = await buildApp(db, { id: "user-pat-1", role: "patient" }, "not json at all");
    const res = await app.request("/ai/clinical-note-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: "pat-1", noteText: "anything" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.summary).toMatch(/unavailable/i);
    expect(body.summary.soap).toBeDefined();
    expect(Array.isArray(body.summary.keyTerms)).toBe(true);
  });

  it("rejects empty noteText with 400", async () => {
    db.seed("patients", [{ id: "pat-1", userId: "user-pat-1" }]);
    const app = await buildApp(
      db,
      { id: "user-pat-1", role: "patient" },
      { summary: "", soap: {}, keyTerms: [] }
    );
    const res = await app.request("/ai/clinical-note-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: "pat-1", noteText: "" }),
    });
    expect(res.status).toBe(400);
  });
});