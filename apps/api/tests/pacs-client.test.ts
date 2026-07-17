// PACS client unit tests.
//
// Verifies the QIDO-RS + WADO-RS fetch wrapper:
//   - Sends Basic auth header (test the encoded value directly)
//   - Retries on 5xx (exponential backoff)
//   - Does NOT retry on 401/403 (fail-fast)
//   - Parses DICOM JSON into PacsStudySummary[]
//   - Returns raw bytes from fetchInstance
//
// fetch is mocked with vi.fn() so we can control status + headers.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PacsClient,
  PacsAuthError,
  PacsTransientError,
  parseInstanceList,
  parseSeriesList,
} from "../src/lib/pacs-client";

function makeResponse(opts: {
  status?: number;
  body?: string | ArrayBuffer | object;
  headers?: Record<string, string>;
}) {
  const status = opts.status ?? 200;
  const headers = new Headers(opts.headers ?? { "Content-Type": "application/json" });
  let body: BodyInit | null = "[]";
  if (opts.body !== undefined) {
    if (typeof opts.body === "string") body = opts.body;
    else if (opts.body instanceof ArrayBuffer) body = opts.body;
    else body = JSON.stringify(opts.body);
  }
  return new Response(body, { status, headers });
}

describe("PacsClient", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("sends HTTP Basic auth header with base64(user:pass)", async () => {
    let capturedUrl = "";
    let capturedAuth: string | null = null;
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedAuth = (init.headers as Record<string, string>).Authorization ?? null;
      return makeResponse({ status: 200, body: [] });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "alice", password: "s3cret" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    await client.listStudies("HSP-A-000001");
    expect(capturedUrl).toContain("PatientID=HSP-A-000001");
    // btoa("alice:s3cret") → "YWxpY2U6czNjcmV0"
    expect(capturedAuth).toBe(`Basic ${btoa("alice:s3cret")}`);
  });

  it("retries on 5xx then succeeds (3 attempts)", async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      attempt++;
      if (attempt < 3) return makeResponse({ status: 503, body: "" });
      return makeResponse({ status: 200, body: [] });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1, maxRetries: 3 }
    );
    const out = await client.listStudies("MRN");
    expect(attempt).toBe(3);
    expect(out).toEqual([]);
  });

  it("does NOT retry on 401 — fails-fast with PacsAuthError", async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async () => {
      attempt++;
      return makeResponse({ status: 401, body: "unauthorized" });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    await expect(client.listStudies("MRN")).rejects.toBeInstanceOf(PacsAuthError);
    expect(attempt).toBe(1);
  });

  it("does NOT retry on 403", async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async () => {
      attempt++;
      return makeResponse({ status: 403, body: "forbidden" });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    await expect(client.listStudies("MRN")).rejects.toBeInstanceOf(PacsAuthError);
    expect(attempt).toBe(1);
  });

  it("parses QIDO-RS study list into PacsStudySummary[]", async () => {
    const qidoJson = [
      {
        "0020000D": { vr: "UI", Value: ["1.2.840.0.1.1"] },
        "00080020": { vr: "DA", Value: ["20260710"] },
        "00100020": { vr: "LO", Value: ["HSP-A-000001"] },
        "00080060": { vr: "CS", Value: ["CT"] },
        "00180015": { vr: "CS", Value: ["CHEST"] },
      },
    ];
    const fetchImpl = vi.fn(async () =>
      makeResponse({ status: 200, body: qidoJson })
    );
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    const out = await client.listStudies("HSP-A-000001");
    expect(out).toHaveLength(1);
    expect(out[0].studyInstanceUid).toBe("1.2.840.0.1.1");
    expect(out[0].studyDate).toBe("20260710");
    expect(out[0].modalities).toContain("CT");
    expect(out[0].patientId).toBe("HSP-A-000001");
  });

  it("returns [] on empty QIDO response", async () => {
    const fetchImpl = vi.fn(async () => makeResponse({ status: 200, body: [] }));
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    expect(await client.listStudies("MRN")).toEqual([]);
  });

  it("fetches raw bytes from fetchInstance", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const accept = (init.headers as Record<string, string>).Accept;
      expect(accept).toBe("application/dicom");
      return new Response(bytes, { status: 200 });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    const out = await client.fetchInstance("1.2.840.0.1", "1.2.840.0.2");
    expect(out.byteLength).toBe(4);
    expect(new Uint8Array(out)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("fetchInstance retries on 503 then throws PacsTransientError", async () => {
    const fetchImpl = vi.fn(async () =>
      makeResponse({ status: 503, body: "" })
    );
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1, maxRetries: 2 }
    );
    await expect(
      client.fetchInstance("study", "sop")
    ).rejects.toBeInstanceOf(PacsTransientError);
  });

  it("fetchInstance does NOT retry on 401", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return makeResponse({ status: 401, body: "" });
    });
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    await expect(
      client.fetchInstance("study", "sop")
    ).rejects.toBeInstanceOf(PacsAuthError);
    expect(calls).toBe(1);
  });

  it("listStudyInstances fetches instances and groups them by series with modality", async () => {
    const instancesJson = [
      {
        "00080018": { vr: "UI", Value: ["1.2.3.sop1"] },
        "0020000E": { vr: "UI", Value: ["1.2.3.series1"] },
        "00080060": { vr: "CS", Value: ["CT"] },
      },
      {
        "00080018": { vr: "UI", Value: ["1.2.3.sop2"] },
        "0020000E": { vr: "UI", Value: ["1.2.3.series1"] },
        "00080060": { vr: "CS", Value: ["CT"] },
      },
      {
        "00080018": { vr: "UI", Value: ["1.2.3.sop3"] },
        "0020000E": { vr: "UI", Value: ["1.2.3.series2"] },
        "00080060": { vr: "CS", Value: ["MR"] },
      },
    ];
    const fetchImpl = vi.fn(async () =>
      makeResponse({ status: 200, body: instancesJson })
    );
    const client = new PacsClient(
      "https://pacs.example.com/dicom-web",
      { username: "u", password: "p" },
      { fetchImpl: fetchImpl as any, initialBackoffMs: 1 }
    );
    const out = await client.listStudyInstances("1.2.3.study1");
    expect(out).toHaveLength(2);
    
    const s1 = out.find((x) => x.seriesInstanceUid === "1.2.3.series1");
    expect(s1).toBeTruthy();
    expect(s1!.modality).toBe("CT");
    expect(s1!.instances).toHaveLength(2);
    expect(s1!.instances[0].sopInstanceUid).toBe("1.2.3.sop1");
    expect(s1!.instances[1].sopInstanceUid).toBe("1.2.3.sop2");

    const s2 = out.find((x) => x.seriesInstanceUid === "1.2.3.series2");
    expect(s2).toBeTruthy();
    expect(s2!.modality).toBe("MR");
    expect(s2!.instances).toHaveLength(1);
    expect(s2!.instances[0].sopInstanceUid).toBe("1.2.3.sop3");
  });
});

describe("DICOM JSON parsers", () => {
  it("parseInstanceList extracts sopInstanceUid values", () => {
    const out = parseInstanceList([
      { "00080018": { vr: "UI", Value: ["1.2.3.4"] } },
      { "00080018": { vr: "UI", Value: ["1.2.3.5"] } },
      { /* missing */ },
    ]);
    expect(out).toEqual([
      { sopInstanceUid: "1.2.3.4" },
      { sopInstanceUid: "1.2.3.5" },
    ]);
  });

  it("parseSeriesList extracts seriesInstanceUid + modality", () => {
    const out = parseSeriesList([
      {
        "0020000E": { vr: "UI", Value: ["1.2.3.series1"] },
        "00080060": { vr: "CS", Value: ["CT"] },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].seriesInstanceUid).toBe("1.2.3.series1");
    expect(out[0].modality).toBe("CT");
  });
});