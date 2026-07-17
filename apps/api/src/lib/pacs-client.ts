// @ts-nocheck
// DICOMweb client — QIDO-RS (query) + WADO-RS (retrieve).
//
// Each hospital's PACS archive is polled via DICOMweb standard endpoints:
//   GET {baseUrl}/studies?PatientID=<mrn>&StudyDate=<from>-&includefield=…&limit=200
//   GET {baseUrl}/studies/{studyInstanceUID}/instances/{sopInstanceUID}
// Returns DICOM JSON (one element per attribute, {"vr": "...", "Value": [...]})
// or raw application/dicom bytes for instance retrieval.
//
// Retry policy: 3 attempts with exponential backoff for 5xx and network
// errors. No retry on 401/403/4xx — those are credential or query-shape
// bugs that won't fix themselves. The circuit breaker state lives in
// `pacs-sync.ts` (caller-owned Map, one-per-pass) so the client itself
// stays stateless and Worker-lifetime-safe.
//
// We deliberately do NOT cache study lists or instance bytes — every
// sync pass starts fresh so the cursor logic stays simple.

import type { PacsCredentials } from "./pacs-credentials";

export class PacsAuthError extends Error {
  constructor(public statusCode: number, public reason: string) {
    super(`PACS auth failure (${statusCode}): ${reason}`);
    this.name = "PacsAuthError";
  }
}

export class PacsTransientError extends Error {
  constructor(public statusCode: number, public reason: string) {
    super(`PACS transient failure (${statusCode}): ${reason}`);
    this.name = "PacsTransientError";
  }
}

export type PacsInstanceRef = {
  sopInstanceUid: string;
  seriesInstanceUid?: string;
};

export type PacsSeriesSummary = {
  seriesInstanceUid: string;
  modality: string | null;
  instances: PacsInstanceRef[];
};

export type PacsStudySummary = {
  studyInstanceUid: string;
  studyDate: string | null; // YYYYMMDD per DICOM DA VR
  modalities: string[];
  bodyParts: string[];
  patientId: string;
  series: PacsSeriesSummary[];
};

export type PacsClientOptions = {
  /** Override fetch for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms (default 30000). */
  timeoutMs?: number;
  /** Max retry attempts on 5xx / network errors (default 3). */
  maxRetries?: number;
  /** Initial backoff in ms, doubled per retry (default 250). */
  initialBackoffMs?: number;
};

const DEFAULT_OPTS: Omit<Required<PacsClientOptions>, "fetchImpl"> & {
  fetchImpl: typeof fetch;
} = {
  // Resolve at construction time so test mocks of `globalThis.fetch`
  // are picked up — the captured `fetch` reference in some Workers
  // runtimes points at the pre-mock value.
  fetchImpl: ((...args: Parameters<typeof fetch>) =>
    (globalThis.fetch as typeof fetch)(...args)),
  timeoutMs: 30_000,
  maxRetries: 3,
  initialBackoffMs: 250,
};

/**
 * Parse a DICOM JSON element with shape `{vr, Value}` and return its
 * string value or null. Handles common VRs (SH, LO, PN, CS, DA, UI, AS).
 */
function pickString(elem: any): string | null {
  if (!elem || !Array.isArray(elem.Value) || elem.Value.length === 0) return null;
  const v = elem.Value[0];
  if (typeof v === "string") return v;
  // PersonName (PN) is `{Alphabetic, Ideographic, Phonetic}` — flatten.
  if (typeof v === "object" && v !== null) {
    return v.Alphabetic || v.Ideographic || v.Phonetic || null;
  }
  return String(v);
}

function pickStrings(elem: any): string[] {
  if (!elem || !Array.isArray(elem.Value)) return [];
  return elem.Value.map((v: any) =>
    typeof v === "string" ? v : v?.Alphabetic ?? null
  ).filter(Boolean) as string[];
}

/**
 * Parse a DICOM JSON list of studies into our `PacsStudySummary[]`.
 * QIDO-RS returns an array of objects, one per study, each containing
 * nested arrays per series (when includefield=... includes them).
 */
function parseStudyList(json: unknown): PacsStudySummary[] {
  if (!Array.isArray(json)) return [];
  const out: PacsStudySummary[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const studyUid = pickString(item["0020000D"]);
    if (!studyUid) continue;
    const studyDate = pickString(item["00080020"]); // DA YYYYMMDD
    const patientId = pickString(item["00100020"]); // MRN as the PACS sees it
    // QIDO-RS with includefield=all returns Series nested as "0008103E"
    // is NOT what we want — we get a flat array. To get series we
    // either query /studies/{uid}/series or parse what QIDO returns.
    // Our caller decides; default behavior: extract modalities from
    // 00080060 at the study level if present, leave series empty.
    const modalities = new Set<string>();
    const bodyParts = new Set<string>();
    const seriesModality = pickString(item["00080060"]);
    if (seriesModality) modalities.add(seriesModality);
    const bodyPart = pickString(item["00180015"]);
    if (bodyPart) bodyParts.add(bodyPart);
    out.push({
      studyInstanceUid: studyUid,
      studyDate,
      modalities: Array.from(modalities),
      bodyParts: Array.from(bodyParts),
      patientId: patientId ?? "",
      series: [],
    });
  }
  return out;
}

/**
 * Parse a DICOM JSON list of series for one study (used when we need
 * SOP-level instance refs).
 */
export function parseSeriesList(json: unknown): PacsSeriesSummary[] {
  if (!Array.isArray(json)) return [];
  const out: PacsSeriesSummary[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const seriesUid = pickString(item["0020000E"]);
    if (!seriesUid) continue;
    out.push({
      seriesInstanceUid: seriesUid,
      modality: pickString(item["00080060"]),
      instances: [],
    });
  }
  return out;
}

/**
 * Parse a DICOM JSON list of instances for one series.
 */
export function parseInstanceList(json: unknown): PacsInstanceRef[] {
  if (!Array.isArray(json)) return [];
  const out: PacsInstanceRef[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const sopUid = pickString(item["00080018"]);
    if (!sopUid) continue;
    out.push({ sopInstanceUid: sopUid });
  }
  return out;
}

export class PacsClient {
  private baseUrl: string;
  private authHeader: string;
  private opts: Required<PacsClientOptions>;

  constructor(baseUrl: string, creds: PacsCredentials, opts: PacsClientOptions = {}) {
    // Normalize baseUrl — strip trailing slash.
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.authHeader =
      "Basic " +
      btoa(`${creds.username}:${creds.password}`);
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  /**
   * Internal: fetch with timeout + retry. 401/403 throw PacsAuthError
   * immediately (no retry). 5xx + network errors retry with exponential
   * backoff up to maxRetries attempts.
   */
  private async fetchWithRetry(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < this.opts.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
      try {
        const res = await this.opts.fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: this.authHeader,
            Accept: "application/dicom+json",
          },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.status === 401 || res.status === 403) {
          throw new PacsAuthError(res.status, await res.text().catch(() => ""));
        }
        if (res.status >= 500) {
          throw new PacsTransientError(
            res.status,
            (await res.text().catch(() => "")).slice(0, 200)
          );
        }
        if (!res.ok) {
          // 4xx other than auth — query-shape bug, fail-fast.
          throw new PacsAuthError(
            res.status,
            (await res.text().catch(() => "")).slice(0, 200)
          );
        }
        return res;
      } catch (err) {
        clearTimeout(t);
        lastErr = err;
        // Auth errors are not retried.
        if (err instanceof PacsAuthError) throw err;
        // Last attempt — rethrow as transient.
        if (attempt === this.opts.maxRetries - 1) {
          if (err instanceof PacsTransientError) throw err;
          throw new PacsTransientError(
            0,
            err instanceof Error ? err.message : String(err)
          );
        }
        // Exponential backoff: 250ms, 500ms, 1000ms, ...
        await sleep(this.opts.initialBackoffMs * Math.pow(2, attempt));
      }
    }
    // Defensive — loop above should always return or throw.
    throw new PacsTransientError(
      0,
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    );
  }

  /**
   * Fetch raw DICOM bytes for a single instance. Returns ArrayBuffer.
   * Used by the sync engine to upload to R2 + parse for metadata.
   *
   * Note: `fetchWithRetry` is JSON-oriented (Accept: application/dicom+json).
   * For binary retrieval we go through a sibling helper that overrides
   * Accept + parses the response body as bytes. Retry policy is shared
   * with the JSON path — same backoff curve, same auth-fail-fast rule.
   */
  async fetchInstance(
    studyInstanceUid: string,
    sopInstanceUid: string
  ): Promise<ArrayBuffer> {
    const encoded = (s: string) => encodeURIComponent(s);
    const url = `${this.baseUrl}/studies/${encoded(studyInstanceUid)}/instances/${encoded(sopInstanceUid)}`;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < this.opts.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
      try {
        const res = await this.opts.fetchImpl(url, {
          method: "GET",
          headers: {
            Authorization: this.authHeader,
            Accept: "application/dicom",
          },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.status === 401 || res.status === 403) {
          throw new PacsAuthError(res.status, "");
        }
        if (res.status >= 500) {
          throw new PacsTransientError(res.status, "");
        }
        if (!res.ok) {
          throw new PacsAuthError(res.status, "");
        }
        return await res.arrayBuffer();
      } catch (err) {
        clearTimeout(t);
        lastErr = err;
        if (err instanceof PacsAuthError) throw err;
        if (attempt === this.opts.maxRetries - 1) {
          if (err instanceof PacsTransientError) throw err;
          throw new PacsTransientError(
            0,
            err instanceof Error ? err.message : String(err)
          );
        }
        await sleep(this.opts.initialBackoffMs * Math.pow(2, attempt));
      }
    }
    throw new PacsTransientError(
      0,
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    );
  }

  /**
   * QIDO-RS: list studies for a patient, optionally bounded by fromDate.
   * `fromDate` is YYYYMMDD — QIDO expects `StudyDate=YYYYMMDD-` (open-ended
   * upper bound).
   */
  async listStudies(
    mrn: string,
    options: { fromDate?: string; limit?: number; offset?: number } = {}
  ): Promise<PacsStudySummary[]> {
    const params = new URLSearchParams();
    params.set("PatientID", mrn);
    if (options.fromDate) {
      // Open-ended upper bound so we get all studies newer than cursor.
      params.set("StudyDate", `${options.fromDate}-`);
    }
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    const res = await this.fetchWithRetry(`/studies?${params.toString()}`);
    const json = await res.json().catch(() => []);
    return parseStudyList(json);
  }

  /**
   * WADO-RS metadata for a single study. Returns series-level summaries;
   * each series carries its instance list (sopInstanceUid).
   */
  async listStudyInstances(
    studyInstanceUid: string
  ): Promise<PacsSeriesSummary[]> {
    const encoded = encodeURIComponent(studyInstanceUid);
    const params = new URLSearchParams();
    const res = await this.fetchWithRetry(`/studies/${encoded}/instances?${params}`);
    const json = await res.json().catch(() => []);
    if (!Array.isArray(json)) return [];

    const groups = new Map<string, { modality: string | null; instances: PacsInstanceRef[] }>();
    for (const item of json) {
      if (!item || typeof item !== "object") continue;
      const sopUid = pickString(item["00080018"]);
      if (!sopUid) continue;
      const seriesUid = pickString(item["0020000E"]) || "";
      const modality = pickString(item["00080060"]);

      let g = groups.get(seriesUid);
      if (!g) {
        g = { modality, instances: [] };
        groups.set(seriesUid, g);
      }
      g.instances.push({ sopInstanceUid: sopUid });
    }

    return Array.from(groups.entries()).map(([seriesUid, g]) => ({
      seriesInstanceUid: seriesUid,
      modality: g.modality,
      instances: g.instances,
    }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}