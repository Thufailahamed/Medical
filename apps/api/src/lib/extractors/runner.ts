// @ts-nocheck
//
// Extractor runner — common pipeline for every per-kind extractor.
// Pipeline:
//   1. fetch file bytes from R2 (text or base64)
//   2. check ai_cache (idempotent re-runs)
//   3. call Gemini (text or vision) with a strict JSON responseSchema
//   4. parse JSON + validate with the kind-specific Zod schema
//   5. normalise (clamp confidences, coerce numeric values, drop empty rows)
//   6. return ExtractionResult
//
// Backend: Gemini (gemini-2.5-flash) for both text and vision. We
// previously used Workers-AI Llama, but Gemini's responseMimeType +
// responseSchema gives a strict typed payload with no markdown-fence
// parse failures. Falls back to Workers AI only when GEMINI_API_KEY is
// missing in env.
//
// Never throws. On any failure returns `{ confidence: 0, payload: {}, rawText: "", error: "..." }`
// so the pipeline glue can persist `extractedDataStatus='failed'` without crashing.

import { z } from "zod";
import { aiComplete, aiVisionComplete, cacheGet, cacheStore, fetchR2Text, fetchR2Base64 } from "../ai";
import { extractR2Key } from "../../routes/ai";
import { completeGemini, isGeminiConfigured, GEMINI_MODELS } from "../ai/gemini";
import { zodToJsonSchema } from "../ai/zod-to-json-schema";

export type ExtractionSource = "upload" | "backfill" | "retry";

export interface ExtractorInput {
  recordId: string;
  patientId: string;
  fileUrl: string;       // raw key, /files/download/* path, or https://<r2>/<key>
  mimeType?: string;     // hint to pick text vs vision
  hint?: string;         // optional text hint (e.g. label text shown alongside the upload)
  userId?: string | null;
}

export interface ExtractionResult {
  ok: boolean;
  confidence: number;          // 0..1
  payload: Record<string, any>; // already validated against the Zod schema
  rawText: string;             // truncated, audit-only
  modelVersion: string;
  error?: string;
}

export interface ExtractorOptions {
  kind: string;                            // matches AiKind for cache
  schema: z.ZodTypeAny;                    // zod schema to validate the JSON against
  systemPrompt: string;                    // LLM system prompt
  buildUserText: (text: string) => string; // text-only path
  buildUserVision: (b64: string, hint: string) => any[]; // vision path
  preferVision?: boolean;                  // skip text path entirely
  useCache?: boolean;                      // default true
}

const DEFAULT_MODEL = GEMINI_MODELS.text;
const VISION_MODEL = GEMINI_MODELS.vision;

function isVisionMime(mime?: string): boolean {
  if (!mime) return false;
  return mime.startsWith("image/") || mime === "application/dicom";
}

function clampConfidence(n: any): number {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

function safeStringify(s: string, max = 2000): string {
  return (s || "").slice(0, max);
}

async function callLlm(
  env: { AI: any; R2: any },
  opts: ExtractorOptions,
  input: ExtractorInput,
  text: string,
  imageB64: string,
): Promise<{ raw: string; modelVersion: string }> {
  const useVision =
    isVisionMime(input.mimeType) || opts.preferVision || !text;
  const model = useVision ? VISION_MODEL : DEFAULT_MODEL;

  // Gemini path (primary). The schema-shaped responseSchema gives us a
  // strict typed payload — no markdown fence dance downstream.
  if (isGeminiConfigured(env as any)) {
    const apiKey = (env as any).GEMINI_API_KEY as string;
    const messages = [
      { role: "system" as const, content: opts.systemPrompt },
      { role: "user" as const, content: opts.buildUserText(text) || " " },
    ];
    const res = await completeGemini(messages, {
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.1,
      responseSchema: zodToJsonSchema(opts.schema),
      images: useVision && imageB64 ? [{ mimeType: input.mimeType || "image/jpeg", data: imageB64 }] : undefined,
      userText: input.hint ? `Label/hint: ${input.hint}` : undefined,
    });
    return { raw: res.text, modelVersion: res.model };
  }

  // Fallback: Workers AI Llama. Same shape, no JSON mode guarantee.
  let raw = "";
  if (useVision) {
    const messages = [
      { role: "system" as const, content: opts.systemPrompt },
      {
        role: "user" as const,
        content: [
          ...(input.hint ? [{ type: "text" as const, text: `Label/hint: ${input.hint}` }] : []),
          ...opts.buildUserVision(imageB64, text),
        ],
      },
    ];
    raw = await aiVisionComplete(env.AI, messages, {
      maxTokens: 1500,
      temperature: 0.1,
    });
  } else {
    const messages = [
      { role: "system" as const, content: opts.systemPrompt },
      { role: "user" as const, content: opts.buildUserText(text) },
    ];
    raw = await aiComplete(env.AI, messages, {
      maxTokens: 1500,
      temperature: 0.1,
    });
  }
  return { raw, modelVersion: model };
}

function tryParseTextJson(text: string): any {
  if (!text) return null;
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function runExtractor(
  env: { AI: any; R2: any },
  input: ExtractorInput,
  opts: ExtractorOptions,
): Promise<ExtractionResult> {
  try {
    const key = extractR2Key(input.fileUrl);
    if (!key) {
      return {
        ok: false,
        confidence: 0,
        payload: {},
        rawText: "",
        modelVersion: opts.preferVision ? VISION_MODEL : DEFAULT_MODEL,
        error: "invalid_file_url",
      };
    }

    // Cache lookup (idempotent re-runs).
    const cacheInput = {
      key,
      kind: opts.kind,
      hint: input.hint ?? null,
      mime: input.mimeType ?? null,
    };
    if (opts.useCache !== false) {
      const cached = await cacheGet(env as any, "ocr" as any, cacheInput).catch(() => null);
      if (cached && (cached as any).payload) {
        return {
          ok: true,
          confidence: clampConfidence((cached as any).confidence),
          payload: (cached as any).payload,
          rawText: safeStringify((cached as any).rawText || ""),
          modelVersion: (cached as any).modelVersion || DEFAULT_MODEL,
        };
      }
    }

    // Fetch file bytes.
    const wantVision = opts.preferVision || isVisionMime(input.mimeType);
    let text = "";
    let imageB64 = "";
    if (wantVision) {
      imageB64 = await fetchR2Base64(env.R2, key);
      if (!imageB64) {
        return {
          ok: false,
          confidence: 0,
          payload: {},
          rawText: "",
          modelVersion: VISION_MODEL,
          error: "image_unreadable",
        };
      }
    } else {
      text = await fetchR2Text(env.R2, key);
      if (!text || text.trim().length < 16) {
        // Fall back to vision — scanned PDFs without a text layer.
        imageB64 = await fetchR2Base64(env.R2, key);
        if (!imageB64) {
          return {
            ok: false,
            confidence: 0,
            payload: {},
            rawText: safeStringify(text),
            modelVersion: DEFAULT_MODEL,
            error: "no_extractable_text",
          };
        }
      }
    }

    const { raw, modelVersion } = await callLlm(env, opts, input, text, imageB64);

    const parsed = tryParseTextJson(raw);
    if (!parsed) {
      return {
        ok: false,
        confidence: 0,
        payload: {},
        rawText: safeStringify(raw),
        modelVersion,
        error: "model_returned_non_json",
      };
    }

    const safe = opts.schema.safeParse(parsed);
    if (!safe.success) {
      return {
        ok: false,
        confidence: 0,
        payload: {},
        rawText: safeStringify(raw),
        modelVersion,
        error: "schema_validation_failed",
      };
    }

    const payload = safe.data as Record<string, any>;
    const confidence = clampConfidence(payload.confidence ?? 0.7);

    const result: ExtractionResult = {
      ok: true,
      confidence,
      payload,
      rawText: safeStringify(text || raw),
      modelVersion,
    };

    // Cache for re-runs.
    await cacheStore(env as any, "ocr" as any, cacheInput, {
      confidence,
      payload,
      rawText: result.rawText,
      modelVersion,
    }).catch(() => {});

    return result;
  } catch (err) {
    return {
      ok: false,
      confidence: 0,
      payload: {},
      rawText: "",
      modelVersion: opts.preferVision ? VISION_MODEL : DEFAULT_MODEL,
      error: (err as Error)?.message || "unexpected",
    };
  }
}
