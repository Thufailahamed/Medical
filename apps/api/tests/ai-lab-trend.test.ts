// tests/ai-lab-trend.test.ts
//
// Day 3 #6 — lab-test cadence + LLM narrative.
//
// Asserts:
//   (1) 400 on missing `type` query param (Zod gate).
//   (2) 200 with structural skeleton on happy path; LLM may or may not
//       contribute narrative — both are accepted.
//   (3) 403 when the caller can't access the patient.
//   (4) Empty series returns skeleton with `count: 0` and a friendly
//       "no reports" narrative.

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

const TEST_SECRET = "test-secret-lab-trend";

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
  aiJson: any,
  opts: { seedReports?: any[]; seedPatient?: { id: string; userId: string } } = {}
) {
  const app = new Hono<AppEnvironment>();
  const patient = opts.seedPatient ?? { id: "pat-1", userId: user.id };
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@x.local`, name: "T " + user.id },
  ]);
  db.seed("patients", [{ id: patient.id, userId: patient.userId }]);
  if (opts.seedReports) db.seed("labReports", opts.seedReports);
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

describe("/ai/lab-trend", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("rejects missing type with 400", async () => {
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      { narrative: "" }
    );
    const res = await app.request("/ai/lab-trend?patientId=pat-1");
    expect(res.status).toBe(400);
  });

  it("returns skeleton + LLM narrative on happy path", async () => {
    db.setWhere("labReports", (r) => r.patientId === "pat-1");
    // Both reports within the 24-month look-back window (relative to
    // 2026-07-09 — today's anchor in the harness).
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      {
        narrative: "HbA1c was last done 8 months ago. Consider a repeat.",
        overdue: true,
        intervalMonths: 3,
        nextSuggestedDate: "2026-08-01",
      },
      {
        seedReports: [
          {
            id: "lab-1",
            patientId: "pat-1",
            labId: "lab-x",
            reportType: "HbA1c",
            status: "completed",
            createdAt: "2025-10-12T10:00:00Z",
          },
          {
            id: "lab-2",
            patientId: "pat-1",
            labId: "lab-x",
            reportType: "HbA1c",
            status: "completed",
            createdAt: "2025-04-04T10:00:00Z",
          },
        ],
      }
    );
    const res = await app.request(
      "/ai/lab-trend?patientId=pat-1&type=HbA1c&months=24"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trend.type).toBe("HbA1c");
    expect(body.trend.count).toBe(2);
    expect(body.trend.narrative).toMatch(/HbA1c/i);
    expect(body.trend.overdue).toBe(true);
    expect(body.trend.intervalMonths).toBe(3);
  });

  it("returns empty skeleton when no reports match", async () => {
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      "not json",
      { seedReports: [] }
    );
    const res = await app.request(
      "/ai/lab-trend?patientId=pat-1&type=Lipid"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trend.count).toBe(0);
    expect(body.trend.narrative).toMatch(/No Lipid/i);
  });

  it("returns 403 when caller cannot access the patient", async () => {
    // The patient belongs to a different user; caller is unrelated.
    const app = await buildApp(
      db,
      { id: "user-other", role: "patient" },
      {},
      { seedPatient: { id: "pat-1", userId: "user-1" } }
    );
    const res = await app.request(
      "/ai/lab-trend?patientId=pat-1&type=HbA1c"
    );
    expect(res.status).toBe(403);
  });
});
