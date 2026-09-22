// @ts-nocheck
// In-memory sliding-window rate limiter (per-Worker-isolate, best-effort).
// For strict global limits use D1/audit counts; this guards abuse/accidents.

const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const arr = buckets.get(key) || [];
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= max) {
    buckets.set(key, fresh);
    return { allowed: false, remaining: 0 };
  }
  fresh.push(now);
  buckets.set(key, fresh);
  // Bound memory: prune idle keys occasionally.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k);
      if (buckets.size <= 4000) break;
    }
  }
  return { allowed: true, remaining: max - fresh.length };
}

export const LIMITS = {
  uploadPerHour: 20,
  sharePerHour: 10,
  presignPerHour: 60,
  exportPerHour: 5,
};

export const PATIENT_QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB per patient
