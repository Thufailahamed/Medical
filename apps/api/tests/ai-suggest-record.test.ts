// tests/ai-suggest-record.test.ts
//
// Day 5 #2 — symptom → record-type suggestion.
//
// Asserts:
//   (1) 400 on empty/short text (Zod gate).
//   (2) 200 with valid recordType on happy path.
//   (3) Falls back to heuristic when AI returns an invalid enum.
//   (4) Falls back to 'other' when AI returns garbage AND no keywords match.

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

const TEST_SECRET = "test-secret-suggest-record";

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

async function buildApp(db: MockD1, user: { id: string; role: string }, aiJson: any) {
  const app = new Hono<AppEnvironment>();
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@x.local`, name: "T" },
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

describe("/ai/suggest-record-type", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("rejects empty text with 400", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" }, {});
    const res = await app.request("/ai/suggest-record-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns valid recordType on happy path", async () => {
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      {
        recordType: "lab_report",
        confidence: 0.87,
        reasoning: "Description mentions blood test results.",
      }
    );
    const res = await app.request("/ai/suggest-record-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Got my blood test results today — HbA1c was 6.2",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion.recordType).toBe("lab_report");
    expect(body.suggestion.confidence).toBeCloseTo(0.87, 1);
  });

  it("falls back to heuristic when AI returns invalid enum", async () => {
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      { recordType: "made_up_type", confidence: 0.9, reasoning: "x" }
    );
    const res = await app.request("/ai/suggest-record-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "I had a chest X-ray done at the hospital",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion.recordType).toBe("imaging");
  });

  it("defaults to 'other' when AI is garbage AND no keyword match", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" }, "not json");
    const res = await app.request("/ai/suggest-record-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "something vague that doesn't match anything",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestion.recordType).toBe("other");
  });
});
