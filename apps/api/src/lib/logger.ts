// apps/api/src/lib/logger.ts
//
// Structured logger that scrubs PII before writing to stdout.
//
// Wraps console.* with redactPii on every string argument and recursive
// meta-object values. Use this instead of console.log anywhere that
// could touch patient data — auth OTPs, prescription bodies, audit
// failures, payment notifications, etc.
//
// Format: `[<context>] <message> meta=<json>`
//
// Why a logger (not regex on stdout): the redaction runs *before* the
// line hits stdout. Workers' `console.log` is captured by the platform
// log stream — once it's there we can't take it back. Scrubbing at the
// source is the only safe place.

import { redactPii } from "./redact";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Per-process minimum level. Override via env `LOG_LEVEL=debug|info|warn|error`. */
const minLevel: Level =
  ((globalThis as any).__LOG_LEVEL__ as Level) || "info";

function shouldLog(level: Level): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

/**
 * Recursively scrub strings inside any object/array. Non-string values
 * pass through unchanged. Avoids mutating the input.
 */
function redactMeta(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-capped]";
  if (value == null) return value;
  if (typeof value === "string") return redactPii(value);
  if (Array.isArray(value)) return value.map((v) => redactMeta(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactMeta(v, depth + 1);
    }
    return out;
  }
  return value;
}

function fmt(
  level: Level,
  context: string,
  message: string,
  meta?: unknown
): string {
  const scrubbedMsg = redactPii(message);
  if (meta === undefined) {
    return `[${level}] [${context}] ${scrubbedMsg}`;
  }
  try {
    const scrubbedMeta = redactMeta(meta);
    return `[${level}] [${context}] ${scrubbedMsg} meta=${JSON.stringify(scrubbedMeta)}`;
  } catch {
    // meta had a circular ref or unserialisable type — fall back to typeof
    return `[${level}] [${context}] ${scrubbedMsg} meta=<unserialisable:${typeof meta}>`;
  }
}

function emit(
  level: Level,
  context: string,
  message: string,
  meta?: unknown
): void {
  if (!shouldLog(level)) return;
  const line = fmt(level, context, message, meta);
  // All paths land on console so Cloudflare's tail worker / logpush
  // picks them up the same way.
  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export const logger = {
  debug: (ctx: string, msg: string, meta?: unknown) =>
    emit("debug", ctx, msg, meta),
  info: (ctx: string, msg: string, meta?: unknown) =>
    emit("info", ctx, msg, meta),
  warn: (ctx: string, msg: string, meta?: unknown) =>
    emit("warn", ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: unknown) =>
    emit("error", ctx, msg, meta),
};