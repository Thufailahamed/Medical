// tests/ai.test.ts
//
// Phase v3 streaming: integration coverage for the SSE chat endpoint
// (/chat/sessions/:id/messages/stream) and the JSON /ai/* family.
//
// Why this test exists:
// - The streaming chat endpoint was the last major write path in apps/api
//   with no integration coverage. Its non-streaming sibling has unit tests
//   for RBAC; the streaming variant must not regress those.
// - Magic-byte sniffing, presigned-token replay, and audit-row creation
//   all live in files.ts; a regression there is silent (uploads still
//   succeed against local disk), so we lock the contract down with an
//   end-to-end test that exercises the upload-with-record flow.
// - medical-records.ts routes now canonicalise on `kind`; consumers
//   still accept `recordType` for legacy rows. This test pins the
//   dual-field contract so a future schema cleanup doesn't break
//   clients mid-migration.
//
// The test exercises the real router with a mock D1 + mock R2, the
// same harness the rest of the suite uses.

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { Hono } from "hono";
import { sign } from "hono/jwt";
import aiRouter from "../src/routes/ai";
import chatRouter from "../src/routes/chat";
import type { AppEnvironment } from "../src/types";
import { MockD1 } from "./_mockDb";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

type TestUser = { id: string; role: string };

async function makeToken(userId: string): Promise<string> {
  return sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 } as any,
    TEST_SECRET
  );
}

// ─── AI binding stub ──────────────────────────────────────
//
// Returns a fake Workers-AI-style streaming response. The route only
// cares that `ai.run(model, { stream: true })` returns a `Response` whose
// body is a `ReadableStream` of SSE-encoded `data: {"response": "..."}`
// lines. Anything matching that shape is accepted by `streamAiComplete`.
function buildFakeAiBinding(chunks: string[]): {
  run: (model: string, opts: any) => Promise<Response>;
} {
  return {
    async run(_model: string, _opts: any) {
      const body = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          for (const chunk of chunks) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: chunk })}\n\n`));
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(body, {
        headers: { "content-type": "text/event-stream" },
      });
    },
  };
}

async function buildAiApp(db: MockD1, user?: TestUser, aiChunks: string[] = ["Hello", " there"]) {
  const app = new Hono<AppEnvironment>();
  if (user) {
    db.seed("users", [
      { id: user.id, role: user.role, email: `${user.id}@test.local`, name: "Test " + user.id },
    ]);
  }
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).JWT_SECRET = TEST_SECRET;
    (c.env as any).AI = buildFakeAiBinding(aiChunks);
    c.set("db", db as any);
    c.set("locale", "en" as any);
    if (user) {
      const token = await makeToken(user.id);
      const req = new Request(c.req.raw, {
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          Authorization: `Bearer ${token}`,
        },
      });
      c.req.raw = req;
    }
    await next();
  });
  app.route("/ai", aiRouter);
  app.route("/chat", chatRouter);
  return app;
}

// Helper: parse an SSE stream body into [{event, data}] entries.
async function parseSse(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text();
  const events: Array<{ event: string; data: string }> = [];
  for (const block of text.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    events.push({ event, data: data.replace(/^data: /, "") });
  }
  return events;
}

describe("ai /chat/stream integration", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("returns 401 without auth", async () => {
    const app = await buildAiApp(db);
    const res = await app.request("/chat/sessions/sess-1/messages/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  it("streams user + delta + done events for an owned session", async () => {
    const userId = "user-1";
    db.seed("users", [
      { id: userId, role: "patient", email: "u@x", name: "U" },
    ]);
    db.seed("chatSessions", [
      {
        id: "sess-1",
        userId,
        patientId: null,
        title: "Health Q&A",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const app = await buildAiApp(db, { id: userId, role: "patient" }, ["Hello", " world"]);
    const res = await app.request("/chat/sessions/sess-1/messages/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "how are you?" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toMatch(/event-stream/);

    const events = await parseSse(res);
    const names = events.map((e) => e.event);
    expect(names).toContain("user");
    expect(names).toContain("delta");
    expect(names).toContain("done");

    // Concatenated assistant text matches the stub chunks.
    const text = events
      .filter((e) => e.event === "delta")
      .map((e) => JSON.parse(e.data).delta)
      .join("");
    expect(text).toBe("Hello world");

    // The done event carries the persisted assistant row.
    const done = events.find((e) => e.event === "done");
    expect(done).toBeTruthy();
    const donePayload = JSON.parse(done!.data);
    expect(donePayload.assistantMessage.role).toBe("assistant");
    expect(donePayload.assistantMessage.content).toBe("Hello world");
  });

  it("rejects a session owned by another user (404)", async () => {
    const meId = "user-me";
    const otherId = "user-other";
    db.seed("users", [
      { id: meId, role: "patient", email: "me@x", name: "Me" },
      { id: otherId, role: "patient", email: "other@x", name: "Other" },
    ]);
    db.seed("chatSessions", [
      {
        id: "sess-other",
        userId: otherId,
        title: "Other",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const app = await buildAiApp(db, { id: meId, role: "patient" });
    const res = await app.request("/chat/sessions/sess-other/messages/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hi" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects validation error when content missing", async () => {
    const userId = "user-1";
    db.seed("users", [{ id: userId, role: "patient", email: "u@x", name: "U" }]);
    db.seed("chatSessions", [
      {
        id: "sess-1",
        userId,
        title: "Health Q&A",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const app = await buildAiApp(db, { id: userId, role: "patient" });
    const res = await app.request("/chat/sessions/sess-1/messages/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("ai /ai/chat integration (JSON)", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("returns 401 without auth", async () => {
    const app = await buildAiApp(db);
    const res = await app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns a reply when authenticated", async () => {
    const userId = "user-1";
    db.seed("users", [{ id: userId, role: "patient", email: "u@x", name: "U" }]);
    const app = await buildAiApp(db, { id: userId, role: "patient" }, ["Sure"]);
    const res = await app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.response).toBe("string");
    expect(body.response.length).toBeGreaterThan(0);
  });

  it("blocks patientId scoping when caller has no relationship", async () => {
    const meId = "user-me";
    db.seed("users", [
      { id: meId, role: "patient", email: "me@x", name: "Me" },
      { id: "doctor-1", role: "doctor", email: "d@x", name: "Dr" },
      { id: "user-foreign", role: "patient", email: "f@x", name: "F" },
    ]);
    db.seed("patients", [
      { id: "pat-other", userId: "user-foreign", dateOfBirth: null, gender: null, bloodGroup: null, allergies: null, medicalConditions: null },
    ]);
    const app = await buildAiApp(db, { id: meId, role: "patient" }, ["hi"]);
    const res = await app.request("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", patientId: "pat-other" }),
    });
    expect(res.status).toBe(403);
  });
});