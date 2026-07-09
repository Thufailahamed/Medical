// Unit tests for the response-time bucketing helper.
//
// We mock the Drizzle `db.all` to return canned SQL rows so the
// bucketing logic can be exercised without standing up a real D1
// instance. The SQL itself is covered by integration tests in the
// `tests/integration/` tree.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetResponseTimeCache,
  computeFirstResponseMinutes,
  MIN_RATED_CONVERSATIONS,
} from "../src/lib/response-time";

function mockDb(row: { avg_ms: number | null; rated_conversations: number } | null) {
  return {
    all: vi.fn().mockResolvedValue(row ? [row] : []),
  } as any;
}

describe("response-time bucketing", () => {
  beforeEach(() => {
    _resetResponseTimeCache();
  });

  it("returns null bucket when conversations are below threshold", async () => {
    const db = mockDb({ avg_ms: 5 * 60 * 1000, rated_conversations: 5 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBeNull();
    expect(out.medianMs).toBe(5 * 60 * 1000);
    expect(out.ratedConversations).toBe(5);
    expect(MIN_RATED_CONVERSATIONS).toBe(10);
  });

  it("buckets <= 1h as 'fast'", async () => {
    const db = mockDb({ avg_ms: 30 * 60 * 1000, rated_conversations: 12 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBe("fast");
  });

  it("buckets > 1h and <= 6h as 'quick'", async () => {
    const db = mockDb({ avg_ms: 3 * 60 * 60 * 1000, rated_conversations: 12 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBe("quick");
  });

  it("buckets > 6h and <= 24h as 'normal'", async () => {
    const db = mockDb({ avg_ms: 18 * 60 * 60 * 1000, rated_conversations: 12 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBe("normal");
  });

  it("returns null bucket when median is above 24h", async () => {
    const db = mockDb({ avg_ms: 36 * 60 * 60 * 1000, rated_conversations: 50 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBeNull();
  });

  it("returns null medianMs when no rows", async () => {
    const db = mockDb({ avg_ms: null, rated_conversations: 0 });
    const out = await computeFirstResponseMinutes(db, "doc-1");
    expect(out.bucket).toBeNull();
    expect(out.medianMs).toBeNull();
  });

  it("caches results within TTL — second call doesn't hit the DB", async () => {
    const db = mockDb({ avg_ms: 30 * 60 * 1000, rated_conversations: 12 });
    await computeFirstResponseMinutes(db, "doc-1");
    await computeFirstResponseMinutes(db, "doc-1");
    expect(db.all).toHaveBeenCalledTimes(1);
  });
});