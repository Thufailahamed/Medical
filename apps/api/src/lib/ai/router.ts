// @ts-nocheck
// LLM router — picks the best available provider per call.
//
// Today: Workers AI (primary) → Anthropic (fallback if ANTHROPIC_API_KEY
// is configured). Future: add OpenAI / Gemini behind the same shape.
//
// The router is consumed by `aiComplete` / `streamAiComplete` in
// `lib/ai.ts`. The router does NOT mutate the `opts` shape — callers
// get the same AsyncGenerator contract regardless of provider, so a
// single try/catch in the caller can swap providers transparently.
//
// Why a router and not just a wrapper: the Workers AI binding is a
// `c.env.AI` object that's only available inside Hono handlers.
// `streamAnthropic` is a free function. Same outcome but different
// surfaces — the router abstracts that.

import { streamAiComplete } from "../ai";
import { isAnthropicConfigured, streamAnthropic } from "./anthropic";
import { consumeAnthropicQuota } from "../../middleware/ai-rate-limit";

export interface RouterOpts {
  ai?: unknown;
  env: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type ProviderName = "workers-ai" | "anthropic" | "fallback";

export interface RouterResult {
  provider: ProviderName;
  text: string;
}

export interface RouterStreamOpts extends RouterOpts {
  onProvider?: (p: ProviderName) => void;
}

/**
 * Streaming variant — tries Workers AI first, falls back to Anthropic
 * if the AI binding is missing / errors / times out.
 */
export async function* streamRouted(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: RouterStreamOpts,
): AsyncGenerator<string, void, void> {
  // Primary: Workers AI. We delegate to the existing
  // `streamAiComplete` so all the redact / cap / telemetry behaviour
  // stays in one place. Wrap with a try/catch so we can fall through.
  if (opts.ai) {
    let yieldedAny = false;
    try {
      for await (const delta of streamAiComplete(opts.ai as any, messages, {
        model: opts.model,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal,
      })) {
        if (delta) {
          yieldedAny = true;
          opts.onProvider?.("workers-ai");
          yield delta;
        }
      }
      if (yieldedAny) return;
    } catch (err) {
      console.error("[router] workers-ai failed, attempting fallback:", (err as Error)?.message || err);
    }
  }

  // Fallback: Anthropic — gated by a daily cap so a flaky Workers-AI
  // day can't burn through our Sonnet budget. We check the cap BEFORE
  // calling the provider, so an over-cap period is a cheap no-op.
  if (isAnthropicConfigured(opts.env)) {
    const db = (opts.env as any).DB;
    let quota = { allowed: true, remaining: 0, limit: 0 };
    if (db) {
      quota = await consumeAnthropicQuota(opts.env, db);
    }
    if (!quota.allowed) {
      console.warn(
        `[router] anthropic daily cap hit (limit=${quota.limit}); skipping fallback`
      );
      opts.onProvider?.("fallback");
      throw new Error(
        `LLM router: anthropic daily cap reached (${quota.limit}) — primary provider unavailable`
      );
    }
    try {
      for await (const delta of streamAnthropic(messages, {
        apiKey: (opts.env as Record<string, string>).ANTHROPIC_API_KEY!,
        model: opts.model,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        timeoutMs: opts.timeoutMs,
        signal: opts.signal,
      })) {
        opts.onProvider?.("anthropic");
        yield delta;
      }
      return;
    } catch (err) {
      console.error("[router] anthropic failed:", (err as Error)?.message || err);
    }
  }

  // Out of providers — signal so the caller can return a graceful 502.
  opts.onProvider?.("fallback");
  throw new Error("LLM router: all providers exhausted");
}