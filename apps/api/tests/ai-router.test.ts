// tests/ai-router.test.ts
//
// P1 bundle 3 — LLM router.
//
// Asserts: (1) workers-AI success path is used first, (2) workers-AI
// failure falls through to Anthropic, (3) Anthropic failure with no
// other provider raises, (4) missing AI binding + missing key throws,
// (5) the streaming shape is AsyncGenerator<string>.

import { describe, it, expect } from "bun:test";
import { streamRouted } from "../src/lib/ai/router";
import { MockD1 } from "./_mockDb";

function makeWorkersAi(chunks: string[] | Error) {
  return {
    async run() {
      if (chunks instanceof Error) throw chunks;
      const body = chunks
        .map((c) => `data: {"response":"${c}"}\n\n`)
        .join("") + "data: [DONE]\n\n";
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    },
  };
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

// ─── Tiny mock D1 ──────────────────────────────────────────
//
// Reuses the in-harness MockD1 — it implements insert/update/select
// + onConflictDoUpdate. Anything fancier is delegated to its real
// test setup via `_mockDb.ts`.
function makeEnv(overrides: Record<string, any> = {}) {
  return {
    DB: new MockD1() as any,
    ...overrides,
  };
}

describe("LLM router", () => {
  it("uses workers-ai when it succeeds", async () => {
    const providers: string[] = [];
    const out = await collect(
      streamRouted([{ role: "user", content: "hi" }], {
        ai: makeWorkersAi(["hello", " world"]),
        env: {},
        onProvider: (p) => providers.push(p),
      }),
    );
    expect(out.join("")).toBe("hello world");
    expect(providers).toContain("workers-ai");
  });

  it("falls back to anthropic when workers-ai throws", async () => {
    const env = makeEnv({ ANTHROPIC_API_KEY: "sk-test-1234", ANTHROPIC_DAILY_CAP: "100" });
    // Stub global fetch so we don't actually call Anthropic.
    const origFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    const sseChunks = [
      `event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"via "}}\n\n`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"anthropic"}}\n\n`,
      `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
    ];
    let consumed = 0;
    globalThis.fetch = (async (_url: any, _init: any) => {
      const body = new ReadableStream({
        start(controller) {
          for (const c of sseChunks) {
            controller.enqueue(encoder.encode(c));
            consumed++;
          }
          controller.close();
        },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    }) as any;

    try {
      const providers: string[] = [];
      const out = await collect(
        streamRouted([{ role: "user", content: "hi" }], {
          ai: makeWorkersAi(new Error("workers down")),
          env,
          onProvider: (p) => providers.push(p),
        }),
      );
      expect(out.join("")).toBe("via anthropic");
      expect(providers).toContain("anthropic");
      expect(consumed).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("throws when both providers fail", async () => {
    const env = makeEnv({ ANTHROPIC_API_KEY: "sk-test-1234", ANTHROPIC_DAILY_CAP: "100" });
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("rate limited", { status: 429 })) as any;
    try {
      const gen = streamRouted([{ role: "user", content: "hi" }], {
        ai: makeWorkersAi(new Error("primary down")),
        env,
      });
      await expect(collect(gen)).rejects.toThrow(/exhausted|429/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("throws when no providers are configured", async () => {
    const gen = streamRouted([{ role: "user", content: "hi" }], {
      env: {},
    });
    await expect(collect(gen)).rejects.toThrow(/exhausted|AI binding/);
  });

  it("emits a non-empty fallback provider tag on exhaustion", async () => {
    const env = makeEnv({ ANTHROPIC_API_KEY: "sk-test-1234", ANTHROPIC_DAILY_CAP: "100" });
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("internal error", { status: 500 })) as any;
    let lastProvider = "";
    try {
      await collect(
        streamRouted([{ role: "user", content: "hi" }], {
          ai: makeWorkersAi(new Error("down")),
          env,
          onProvider: (p) => (lastProvider = p),
        }),
      );
    } catch {
      /* expected */
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(lastProvider).toBe("fallback");
  });

  it("skips anthropic fallback when daily cap is hit", async () => {
    // Cap = 0 means any fallback call is refused. fetch must NOT be
    // invoked when the cap gates the provider.
    const env = makeEnv({ ANTHROPIC_API_KEY: "sk-test-1234", ANTHROPIC_DAILY_CAP: "0" });
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("ok", { status: 200 });
    }) as any;
    try {
      await expect(
        collect(
          streamRouted([{ role: "user", content: "hi" }], {
            ai: makeWorkersAi(new Error("down")),
            env,
          }),
        )
      ).rejects.toThrow(/anthropic daily cap/);
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(fetchCalls).toBe(0);
  });

  it("does not bump anthropic quota on workers-ai success", async () => {
    const env = makeEnv({ ANTHROPIC_API_KEY: "sk-test-1234", ANTHROPIC_DAILY_CAP: "100" });
    await collect(
      streamRouted([{ role: "user", content: "hi" }], {
        ai: makeWorkersAi(["hi back"]),
        env,
      }),
    );
    // Quota scope must remain absent — workers-ai shouldn't even hint
    // at touching Anthropic counters.
    const tables = (env.DB as any).tables as Record<string, any>;
    const counterRows = (tables?.aiCounters?.rows ?? []) as Array<{ scope: string }>;
    const hasAnthropic = counterRows.some((r) => r.scope.startsWith("anthropic:"));
    expect(hasAnthropic).toBe(false);
  });
});