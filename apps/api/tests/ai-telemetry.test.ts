// tests/ai-telemetry.test.ts
//
// P1 bundle 2 — aiCalls telemetry.
//
// Asserts that `recordAiCall` writes a row, that `aiComplete` writes a
// row when invoked with `telemetry`, and that the streaming variant
// also writes a row when consumed to completion.

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { aiCalls } from "@healthcare/db";
import { MockD1 } from "./_mockDb";
import {
  aiComplete,
  recordAiCall,
  streamAiComplete,
} from "../src/lib/ai";

describe("aiCalls telemetry", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
  });

  it("recordAiCall writes a row", async () => {
    await recordAiCall({
      db,
      kind: "summary",
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      userId: "user-1",
      patientId: "pat-1",
      latencyMs: 1234,
      status: "ok",
    });
    const rows = await db.select().from(aiCalls);
    expect(rows.length).toBe(1);
    const r = rows[0] as any;
    expect(r.kind).toBe("summary");
    expect(r.userId).toBe("user-1");
    expect(r.patientId).toBe("pat-1");
    expect(r.latencyMs).toBe(1234);
    expect(r.status).toBe("ok");
    expect(r.cachedHit).toBe(false);
    expect(r.model).toContain("llama");
  });

  it("recordAiCall swallows DB errors (telemetry must never break the request)", async () => {
    const brokenDb = {
      insert: () => ({
        values: () => {
          throw new Error("simulated DB down");
        },
      }),
    };
    // Should not throw.
    await recordAiCall({
      db: brokenDb,
      kind: "chat",
      model: "x",
    });
  });

  it("aiComplete with telemetry writes a row with computed latencyMs", async () => {
    const fakeAi = {
      async run() {
        // Pretend the model took ~50ms.
        await new Promise((r) => setTimeout(r, 50));
        return { response: "hi" };
      },
    };
    const out = await aiComplete(
      fakeAi,
      [{ role: "user", content: "hello" }],
      {
        telemetry: { db, kind: "chat", userId: "u-1" },
      },
    );
    expect(out).toBe("hi");
    const rows = await db.select().from(aiCalls).where(eq(aiCalls.kind, "chat"));
    expect(rows.length).toBe(1);
    expect((rows[0] as any).status).toBe("ok");
    expect((rows[0] as any).latencyMs).toBeGreaterThanOrEqual(40);
  });

  it("aiComplete with telemetry writes status=error when ai.run throws", async () => {
    const fakeAi = {
      async run() {
        throw new Error("model down");
      },
    };
    const out = await aiComplete(
      fakeAi,
      [{ role: "user", content: "hello" }],
      {
        telemetry: { db, kind: "chat", userId: "u-1" },
      },
    );
    expect(out).toBe("");
    const rows = await db.select().from(aiCalls).where(eq(aiCalls.kind, "chat"));
    expect((rows[0] as any).status).toBe("error");
    expect((rows[0] as any).errorMessage).toBe("model down");
  });

  it("streamAiComplete writes a telemetry row on clean completion", async () => {
    const encoder = new TextEncoder();
    const fakeAi = {
      async run() {
        const sse = ["data: {\"response\":\"hello\"}\n\n", "data: {\"response\":\" world\"}\n\n", "data: [DONE]\n\n"].join("");
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sse));
            controller.close();
          },
        });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      },
    };
    let out = "";
    for await (const delta of streamAiComplete(fakeAi, [{ role: "user", content: "hi" }], {
      telemetry: { db, kind: "chat", userId: "u-1" },
    })) {
      out += delta;
    }
    expect(out).toBe("hello world");
    const rows = await db.select().from(aiCalls).where(eq(aiCalls.kind, "chat"));
    expect(rows.length).toBe(1);
    expect((rows[0] as any).status).toBe("ok");
  });
});