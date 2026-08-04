// @ts-nocheck
// Google Gemini adapter — Gemini 3.1 Flash-Lite / 2.0 Flash-Lite AI text/vision generation.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Gemini 3.1 Flash-Lite / Gemini 2.0 Flash-Lite model identifiers
export const GEMINI_TEXT_MODEL = "gemini-2.0-flash-lite";
export const GEMINI_VISION_MODEL = "gemini-2.0-flash-lite";

export interface GeminiMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface GeminiImagePart {
  mimeType: string; // e.g. "image/jpeg"
  data: string;     // base64 (no data: prefix)
}

export interface GeminiCompleteOpts {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  responseSchema?: Record<string, unknown>;
  images?: GeminiImagePart[];
  userText?: string;
}

export interface GeminiCompleteResult {
  text: string;
  model: string;
}

export function isGeminiConfigured(env: Record<string, unknown>): boolean {
  return Boolean(
    (env as Record<string, string>)?.GEMINI_API_KEY ||
    (typeof process !== "undefined" && process?.env?.GEMINI_API_KEY)
  );
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiRequest {
  systemInstruction?: { parts: GeminiPart[] };
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>;
  generationConfig: {
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: "text/plain" | "application/json";
    responseSchema?: Record<string, unknown>;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
}

function buildRequest(
  messages: GeminiMessage[],
  opts: GeminiCompleteOpts,
): GeminiRequest {
  const sysParts: GeminiPart[] = [];
  const turns: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      sysParts.push({ text: m.content });
      continue;
    }
    if (m.role !== "user" && m.role !== "model") continue;
    turns.push({ role: m.role, parts: [{ text: m.content }] });
  }

  if (opts.images?.length) {
    const lastUserIdx = turns.map((t) => t.role).lastIndexOf("user");
    if (lastUserIdx >= 0) {
      const parts: GeminiPart[] = opts.images.map((img) => ({
        inline_data: { mime_type: img.mimeType, data: img.data },
      }));
      const hintText = opts.userText ?? turns[lastUserIdx].parts[0]?.text ?? "";
      parts.push({ text: hintText });
      turns[lastUserIdx] = { role: "user", parts };
    } else {
      const parts: GeminiPart[] = opts.images.map((img) => ({
        inline_data: { mime_type: img.mimeType, data: img.data },
      }));
      if (opts.userText) parts.push({ text: opts.userText });
      turns.push({ role: "user", parts });
    }
  }

  const generationConfig: GeminiRequest["generationConfig"] = {
    maxOutputTokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = opts.responseSchema;
  }

  const req: GeminiRequest = {
    contents: turns.length ? turns : [{ role: "user", parts: [{ text: "" }] }],
    generationConfig,
  };
  if (sysParts.length) req.systemInstruction = { parts: sysParts };
  return req;
}

function extractText(resp: GeminiResponse): string {
  const parts = resp?.candidates?.[0]?.content?.parts ?? [];
  const out = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
  return out;
}

/**
 * Single-shot Gemini 3.1 Flash-Lite call.
 */
export async function completeGemini(
  messages: GeminiMessage[],
  opts: GeminiCompleteOpts = {},
): Promise<GeminiCompleteResult> {
  const apiKey =
    opts.apiKey ||
    (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined);

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = opts.model ?? (opts.images?.length ? GEMINI_VISION_MODEL : GEMINI_TEXT_MODEL);
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const req = buildRequest(messages, opts);

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const signal = opts.signal ?? controller.signal;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } finally {
    clearTimeout(t);
  }

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`gemini ${resp.status}: ${text.slice(0, 500)}`);
  }

  let json: GeminiResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`gemini: non-json response (${text.slice(0, 200)})`);
  }
  if (json.promptFeedback?.blockReason) {
    throw new Error(`gemini blocked: ${json.promptFeedback.blockReason}`);
  }
  const out = extractText(json);
  if (!out) {
    const reason = json.candidates?.[0]?.finishReason || "empty";
    throw new Error(`gemini: empty response (${reason})`);
  }
  return { text: out, model: json.modelVersion || model };
}

export const GEMINI_MODELS = {
  text: "gemini-2.0-flash-lite",
  vision: "gemini-2.0-flash-lite",
  flashLite: "gemini-2.0-flash-lite",
  flashLite31: "gemini-3.1-flash-lite",
};