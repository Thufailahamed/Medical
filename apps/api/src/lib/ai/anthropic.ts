// @ts-nocheck
// Anthropic Messages provider — streaming text generation.
//
// Wired by `apps/api/src/lib/ai/router.ts` as the fallback when
// Workers AI is unavailable / times out. The shape mirrors
// `streamAiComplete` (AsyncGenerator<string, void, void>) so the
// router can swap providers without the caller noticing.
//
// Auth: `env.ANTHROPIC_API_KEY`. If unset, `isAvailable` returns false
// and the router skips this provider entirely.
//
// Wire: POST https://api.anthropic.com/v1/messages with
// `anthropic-version: 2023-06-01` and `x-api-key`. SSE stream parses
// `event: content_block_delta` payloads, forwards `.delta.text`.

const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_DEFAULT_MODEL = "claude-3-5-sonnet-latest";

export interface AnthropicMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AnthropicStreamOpts {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function isAnthropicConfigured(env: Record<string, unknown>): boolean {
  return Boolean((env as Record<string, string>).ANTHROPIC_API_KEY);
}

function toAnthropicMessages(msgs: Array<{ role: string; content: string }>): {
  system?: string;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];
  for (const m of msgs) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant") continue;
    out.push({ role: m.role, content: m.content });
  }
  // Ensure the conversation starts with a user turn — Anthropic
  // rejects empty `messages` and any first-role that's not `user`.
  if (out.length === 0 || out[0].role !== "user") {
    out.unshift({ role: "user", content: "(continue)" });
  }
  return { system: systemParts.join("\n\n") || undefined, messages: out };
}

/**
 * Stream text deltas from Anthropic Messages. Yields plain string
 * chunks in arrival order. Throws on non-2xx responses with the body
 * surfaced for diagnostics.
 */
export async function* streamAnthropic(
  messages: Array<{ role: string; content: string }>,
  opts: AnthropicStreamOpts,
): AsyncGenerator<string, void, void> {
  const { system, messages: am } = toAnthropicMessages(messages);
  const body = {
    model: opts.model || ANTHROPIC_DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 800,
    temperature: opts.temperature ?? 0.3,
    stream: true,
    ...(system ? { system } : {}),
    messages: am,
  };
  const deadline = opts.timeoutMs ?? 25_000;
  const started = Date.now();

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      if (opts.signal?.aborted) return;
      if (Date.now() - started > deadline) {
        throw new Error(`Anthropic: timed out after ${deadline}ms`);
      }
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE events separated by `\n\n`; each event has lines like
      // `event: content_block_delta` and `data: {...}`. We only care
      // about the data lines on `content_block_delta`.
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const evt = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLines = evt
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6).trim());
        if (!dataLines.length) continue;
        const payload = dataLines.join("\n");
        if (payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          if (obj?.type === "content_block_delta" && obj?.delta?.type === "text_delta") {
            const text = obj.delta.text as string | undefined;
            if (typeof text === "string" && text.length > 0) yield text;
          }
        } catch {
          /* non-JSON line — skip */
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}