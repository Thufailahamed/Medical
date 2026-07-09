// tests/dedupe.test.ts
//
// Day 3 #4 — duplicate-record detection via embeddings.
//
// We test the pure helper layer (text construction, threshold logic,
// store) end-to-end. The route-level integration (POST
// /files/upload-with-record returning `duplicate: {...}`) is covered
// indirectly via the response shape contract — the dedupe verdict is
// the new field in the response body.

import { describe, it, expect } from "vitest";
import {
  recordText,
  DUPLICATE_THRESHOLD,
  findDuplicateForUpload,
  checkAndStoreEmbedding,
  storeEmbeddingForRecord,
} from "../src/lib/ai/dedupe";
import {
  embed,
  serializeEmbedding,
  EMBEDDING_META,
} from "../src/lib/ai/embeddings";
import { MockD1 } from "./_mockDb";

describe("recordText", () => {
  it("concatenates type, title, diagnosis, notes in stable order", () => {
    const text = recordText({
      recordType: "lab_report",
      title: "HbA1c",
      diagnosis: "diabetes",
      notes: "fasting sample",
    });
    expect(text).toBe("type:lab_report\ntitle:HbA1c\ndiagnosis:diabetes\nnotes:fasting sample");
  });

  it("omits null fields gracefully", () => {
    expect(recordText({ title: "ECG", diagnosis: null, notes: null })).toBe(
      "title:ECG"
    );
    expect(recordText({})).toBe("");
  });

  it("truncates to MAX_INPUT_CHARS", () => {
    const long = "x".repeat(EMBEDDING_META.maxChars + 500);
    const text = recordText({ title: long });
    expect(text.length).toBe(EMBEDDING_META.maxChars);
  });
});

describe("DUPLICATE_THRESHOLD", () => {
  it("is 0.92", () => {
    expect(DUPLICATE_THRESHOLD).toBe(0.92);
  });
});

describe("findDuplicateForUpload", () => {
  it("returns no_prior_records when patient has no embedded records", async () => {
    const db = new MockD1();
    // Use a fake AI that always returns the same vector
    const ai = { async run() { return { data: [0.1, 0.2, 0.3] }; } };
    const out = await findDuplicateForUpload(db, ai, "pat-1", "anything");
    expect(out.duplicate).toBe(false);
    expect(out.reason).toBe("no_prior_records");
  });

  it("returns no_ai_binding when AI is null", async () => {
    const db = new MockD1();
    const out = await findDuplicateForUpload(db, null, "pat-1", "anything");
    expect(out.duplicate).toBe(false);
    expect(out.reason).toBe("no_ai_binding");
  });

  it("returns embed_failed when AI returns garbage", async () => {
    const db = new MockD1();
    const ai = { async run() { return {}; } };
    const out = await findDuplicateForUpload(db, ai, "pat-1", "anything");
    expect(out.duplicate).toBe(false);
    expect(out.reason).toBe("embed_failed");
  });

  it("flags a duplicate when cosine >= threshold", async () => {
    const db = new MockD1();
    // Pre-seed an embedding for a prior record.
    const vec = new Float32Array(384);
    for (let i = 0; i < 384; i++) vec[i] = i / 384;
    db.seed("medicalRecords", [
      {
        id: "rec-1",
        patientId: "pat-1",
        embedding: serializeEmbedding(vec),
        embeddingModel: EMBEDDING_META.model,
        embeddedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        recordType: "lab_report",
        title: "t",
        date: "2025-01-01",
      },
    ]);
    // The new upload has identical text → identical vector.
    const ai = {
      async run() {
        return { data: Array.from(vec) };
      },
    };
    const out = await findDuplicateForUpload(db, ai, "pat-1", "new text");
    expect(out.duplicate).toBe(true);
    if (out.duplicate) {
      expect(out.of).toBe("rec-1");
      expect(out.similarity).toBeGreaterThanOrEqual(0.999);
    }
  });

  it("does NOT flag when below threshold", async () => {
    const db = new MockD1();
    const a = new Float32Array(384);
    const b = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      a[i] = i % 2 === 0 ? 1 : 0;
      b[i] = i % 3 === 0 ? 1 : 0; // low cosine with a
    }
    db.seed("medicalRecords", [
      {
        id: "rec-1",
        patientId: "pat-1",
        embedding: serializeEmbedding(a),
        createdAt: new Date().toISOString(),
        recordType: "lab_report",
        title: "t",
        date: "2025-01-01",
      },
    ]);
    const ai = { async run() { return { data: Array.from(b) }; } };
    const out = await findDuplicateForUpload(db, ai, "pat-1", "new");
    expect(out.duplicate).toBe(false);
    if (!out.duplicate) {
      expect(out.reason).toBe("below_threshold");
      expect((out.bestSimilarity ?? 1)).toBeLessThan(DUPLICATE_THRESHOLD);
    }
  });
});

describe("storeEmbeddingForRecord", () => {
  it("does not throw on empty vector", async () => {
    const db = new MockD1();
    await storeEmbeddingForRecord(db, "rec-1", new Float32Array(0));
  });
  it("writes the serialised embedding to the row", async () => {
    const db = new MockD1();
    // Seed an existing row so update() has something to mutate.
    db.seed("medicalRecords", [
      {
        id: "rec-1",
        patientId: "pat-1",
        recordType: "lab_report",
        title: "t",
        date: "2025-01-01",
        createdAt: new Date().toISOString(),
      },
    ]);
    const vec = new Float32Array([0.5, 0.6, 0.7]);
    await storeEmbeddingForRecord(db, "rec-1", vec);
    const row = db.tables.medicalRecords.rows[0];
    expect(row.embedding).toBe(serializeEmbedding(vec));
    expect(row.embeddingModel).toBe(EMBEDDING_META.model);
    expect(typeof row.embeddedAt).toBe("string");
  });
});

describe("checkAndStoreEmbedding", () => {
  it("combines embed + dedupe + store in one call", async () => {
    const db = new MockD1();
    // Pre-seed a different vector to avoid auto-duplicate.
    const old = new Float32Array(384);
    const fresh = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      old[i] = 0;
      fresh[i] = i === 0 ? 1 : 0; // orthogonal
    }
    db.seed("medicalRecords", [
      {
        id: "rec-old",
        patientId: "pat-1",
        embedding: serializeEmbedding(old),
        createdAt: new Date().toISOString(),
        recordType: "lab_report",
        title: "old",
        date: "2025-01-01",
      },
    ]);
    const ai = { async run() { return { data: Array.from(fresh) }; } };
    const out = await checkAndStoreEmbedding(db, ai, "rec-new", "pat-1", {
      title: "new",
      recordType: "lab_report",
    });
    expect(out.duplicate).toBe(false);
  });

  it("returns embed_failed when AI throws", async () => {
    const db = new MockD1();
    const ai = { async run() { throw new Error("boom"); } };
    const out = await checkAndStoreEmbedding(db, ai, "rec-x", "pat-1", {
      title: "x",
    });
    expect(out.duplicate).toBe(false);
    expect(out.reason).toBe("embed_failed");
  });
});
