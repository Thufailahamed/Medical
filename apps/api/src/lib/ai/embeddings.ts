// @ts-nocheck
// Workers AI embeddings helper.
//
// Single-purpose: turn a string into a vector (and back) using the
// `@cf/baai/bge-small-en-v1.5` model. bge-small is on the CF free
// tier — 10k neurons/day covers thousands of small documents. We
// use it for duplicate-record detection (Day 3 #4) and will reuse
// for semantic doctor search (Day 4 #11).
//
// API shape mirrors the text helpers in `lib/ai.ts`:
//   - `embed(ai, text)` → `Float32Array`
//   - `cosineSimilarity(a, b)` → number in [-1, 1]
//   - `serialize(vec)` / `deserialize(buf)` — round-trip via JSON-safe
//     base64 to survive D1's TEXT columns.

const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
const EMBEDDING_DIM = 384;
const MAX_INPUT_CHARS = 8000;

/**
 * Compute an embedding for `text`. Returns an empty array on any
 * failure (no AI binding, model error, timeout). The route layer
 * decides whether to fail the request or skip the dedupe check.
 *
 * The underlying binding returns `{ shape: [N], data: number[] }` —
 * we normalise to a Float32Array for cache + similarity math.
 */
export async function embed(
  ai: any,
  text: string,
  opts: { timeoutMs?: number } = {}
): Promise<Float32Array> {
  if (!ai) return new Float32Array(0);
  const safeText = (text || "").slice(0, MAX_INPUT_CHARS);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const start = Date.now();
  let finalStatus: "ok" | "error" | "timeout" = "ok";
  let result: any;
  const work = (async () => {
    try {
      result = await ai.run(EMBEDDING_MODEL, { text: safeText });
    } catch (err) {
      console.error("[embed] ai.run threw", err);
      finalStatus = "error";
      result = null;
    }
  })();
  const timer = new Promise<void>((resolve) =>
    setTimeout(() => {
      finalStatus = "timeout";
      resolve();
    }, timeoutMs)
  );
  await Promise.race([work, timer]);
  if (finalStatus !== "ok") return new Float32Array(0);
  // Workers AI returns `{ shape, data: number[] }`. Older versions
  // returned a flat array. Handle both.
  if (Array.isArray(result)) return new Float32Array(result);
  if (result?.data && Array.isArray(result.data)) {
    return new Float32Array(result.data);
  }
  console.warn("[embed] unexpected response shape", result);
  return new Float32Array(0);
}

/** Cosine similarity. Empty vectors → 0. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (!a.length || !b.length) return 0;
  if (a.length !== b.length) {
    // Length mismatch is a contract violation — return 0 rather than
    // throw, so dedupe checks degrade gracefully.
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Round-trip a Float32Array through D1's TEXT column. We use a JSON
 * shape `{"dim":N,"data":[...]}` rather than base64 so the row is
 * diff-friendly in D1 Studio / SQL dumps.
 */
export function serializeEmbedding(vec: Float32Array): string {
  if (!vec.length) return "";
  return JSON.stringify({ dim: vec.length, data: Array.from(vec) });
}

export function deserializeEmbedding(blob: string | null | undefined): Float32Array {
  if (!blob) return new Float32Array(0);
  try {
    const obj = JSON.parse(blob);
    if (Array.isArray(obj)) return new Float32Array(obj);
    if (Array.isArray(obj?.data)) return new Float32Array(obj.data);
    return new Float32Array(0);
  } catch {
    return new Float32Array(0);
  }
}

export const EMBEDDING_META = {
  model: EMBEDDING_MODEL,
  dim: EMBEDDING_DIM,
  maxChars: MAX_INPUT_CHARS,
};