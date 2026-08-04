// @ts-nocheck
// Google Gemini adapter — non-streaming text/vision generation.
//
// Used by the structured-extraction pipeline (apps/api/src/lib/extractors/*)
// because Gemini's `responseMimeType: application/json` + `responseSchema`
// eliminates the parse failures we kept hitting with Llama. The schema
// is the Zod shape's JSON-Schema equivalent — we send it inline so the
// model returns a strict typed payload, no prose, no markdown fences.
//
// Auth: env.GEMINI_API_KEY. If unset, `isAvailable` returns false and
// the runner falls back to Workers AI.
//
// Wire: POST https://generativelanguage.googleapis.com/v1beta/models/{model}
//   :generateContent?key=API_KEY
//
// We deliberately expose a non-streaming shape (`completeGemini` returns
// a string) — extractors are single-shot JSON parses, streaming buys
// nothing and adds SSE parsing code we'd have to test.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_VISION_MODEL = "gemini-2.5-flash";

export interface GeminiMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface GeminiImagePart {
  mimeType: string; // e.g. "image/jpeg"
  data: string;     // base64 (no data: prefix)
}

export interface GeminiCompleteOpts {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  // Optional JSON schema. When present, responseMimeType="application/json"
  // is enforced and the model is constrained to the schema.
  responseSchema?: Record<string, unknown>;
  // Optional pre-built image parts to include in the user message.
  // Vision path: when any image part is present, we use it; else text-only.
  images?: GeminiImagePart[];
  // Optional text hint included in the user message after images.
  userText?: string;
}

export interface GeminiCompleteResult {
  text: string;
  model: string;
}

export function isGeminiConfigured(env: Record<string, unknown>): boolean {
  return Boolean((env as Record<string, string>).GEMINI_API_KEY);
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

  // Vision: replace the last user turn with a parts array carrying image
  // + text. Pure-text path keeps the existing turns as-is.
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
    maxOutputTokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.1,
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
 * Single-shot Gemini call. Throws on non-2xx with the body surfaced for
 * diagnostics, throws on blockReason / empty candidates.
 */
export async function completeGemini(
  messages: GeminiMessage[],
  opts: GeminiCompleteOpts,
): Promise<GeminiCompleteResult> {
  const model = opts.model ?? (opts.images?.length ? GEMINI_VISION_MODEL : GEMINI_TEXT_MODEL);
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
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
    throw new Error(
      `gemini ${resp.status}: ${text.slice(0, 500)}`,
    );
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
  text: GEMINI_TEXT_MODEL,
  vision: GEMINI_VISION_MODEL,
};