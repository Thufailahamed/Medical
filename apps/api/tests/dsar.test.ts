// tests/dsar.test.ts
//
// Phase v3: DSAR helpers — createDsarRequest + underRateLimit.
// Pure functions + tiny mock DB.

import { describe, it, expect } from "vitest";
import { createDsarRequest, underRateLimit } from "../src/lib/dsar";

function mockDb() {
  const rows: any[] = [];
  return {
    rows,
    insert: () => ({
      values: (v: any) => {
        rows.push(v);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  } as any;
}

describe("dsar", () => {
  it("createDsarRequest auto-approves export", async () => {
    const db = mockDb();
    const r = await createDsarRequest({ db, userId: "u1", purpose: "export" });
    expect(r.status).toBe("approved");
    expect(db.rows[0].userId).toBe("u1");
    expect(db.rows[0].purpose).toBe("export");
  });

  it("createDsarRequest queues erasure", async () => {
    const db = mockDb();
    const r = await createDsarRequest({ db, userId: "u1", purpose: "erasure" });
    expect(r.status).toBe("queued");
    expect(db.rows[0].approvedAt).toBeNull();
  });

  it("underRateLimit returns true until threshold hit", async () => {
    const db = mockDb();
    expect(await underRateLimit(db, "u1")).toBe(true);
    for (let i = 0; i < 5; i++) {
      db.rows.push({ userId: "u1", requestedAt: new Date().toISOString() });
    }
    expect(await underRateLimit(db, "u1")).toBe(false);
  });
});