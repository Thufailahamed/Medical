// tests/refill.test.ts
//
// Day 4 #5 — refill prediction (no LLM).
//
// Two layers:
//   (1) Pure helper tests (expectedEndDate, daysUntil, findRefillsDue).
//   (2) Route test for GET /medicines/refill-due — happy path, RBAC,
//       and explicit-endDate precedence.

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { Hono } from "hono";
import { sign } from "hono/jwt";
import medicinesRouter from "../src/routes/medicines";
import type { AppEnvironment } from "../src/types";
import { MockD1 } from "./_mockDb";
import {
  expectedEndDate,
  daysUntil,
  findRefillsDue,
  REFILL_DEFAULTS,
} from "../src/lib/refill";

const TEST_SECRET = "test-secret-refill";

async function makeToken(userId: string): Promise<string> {
  return sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 } as any,
    TEST_SECRET
  );
}

// Anchor "now" to a known date so duration math is reproducible.
const NOW = new Date("2026-07-09T00:00:00Z");

async function buildApp(
  db: MockD1,
  user: { id: string; role: string },
  opts: { seedPatient?: { id: string; userId: string }; seedMedicines?: any[] } = {}
) {
  const app = new Hono<AppEnvironment>();
  const patient = opts.seedPatient ?? { id: "pat-1", userId: user.id };
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@x.local`, name: "T" },
  ]);
  db.seed("patients", [{ id: patient.id, userId: patient.userId }]);
  if (opts.seedMedicines) db.seed("medicines", opts.seedMedicines);
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).JWT_SECRET = TEST_SECRET;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const token = await makeToken(user.id);
    const req = new Request(c.req.raw, {
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        Authorization: `Bearer ${token}`,
      },
    });
    c.req.raw = req;
    await next();
  });
  app.route("/medicines", medicinesRouter);
  return app;
}

describe("refill helper", () => {
  it("uses explicit endDate when present", () => {
    const out = expectedEndDate({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(out.date).toBe("2026-12-31");
    expect(out.source).toBe("explicit");
  });

  it("infers 7 days when frequency includes '1 week'", () => {
    const out = expectedEndDate({
      startDate: "2026-07-01",
      frequency: "1 week course",
    });
    expect(out.date).toBe("2026-07-08");
    expect(out.source).toBe("inferred");
  });

  it("infers 30 days for twice-daily chronic meds", () => {
    const out = expectedEndDate({
      startDate: "2026-07-01",
      frequency: "twice daily",
    });
    expect(out.date).toBe("2026-07-31");
    expect(out.source).toBe("inferred");
  });

  it("infers 90 days for once-daily chronic meds", () => {
    const out = expectedEndDate({
      startDate: "2026-07-01",
      frequency: "OD",
    });
    expect(out.date).toBe("2026-09-29");
    expect(out.source).toBe("inferred");
  });

  it("falls back to 30 days when nothing is parseable", () => {
    const out = expectedEndDate({ startDate: "2026-07-01" });
    expect(out.date).toBe("2026-07-31");
    expect(out.source).toBe("unknown");
  });

  it("daysUntil is positive before, negative after", () => {
    const before = daysUntil("2026-08-01", NOW);
    const after = daysUntil("2026-06-01", NOW);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(0);
  });

  it("findRefillsDue returns only rows ending within the window", () => {
    const out = findRefillsDue(
      [
        {
          id: "m1",
          name: "Soon",
          dosage: "1 tab",
          frequency: "OD",
          // ~7d ago → ~83d remaining on 90d course → outside 14d window
          startDate: "2026-07-02",
          active: true,
        },
        {
          id: "m2",
          name: "Near",
          dosage: "1 tab",
          frequency: "OD",
          // ~76d ago → ~14d remaining → exactly at 14d boundary (within)
          startDate: "2026-04-24",
          active: true,
        },
        {
          id: "m3",
          name: "Overdue",
          dosage: "1 tab",
          frequency: "OD",
          startDate: "2026-01-01",
          active: true,
        },
        {
          id: "m4",
          name: "Inactive",
          dosage: "1 tab",
          frequency: "OD",
          startDate: "2026-01-01",
          active: false,
        },
      ],
      14,
      NOW
    );
    const ids = out.map((c) => c.id);
    expect(ids).not.toContain("m1"); // 83d remaining, outside
    expect(ids).toContain("m2"); // within 14d window
    expect(ids).toContain("m3"); // very overdue
    expect(ids).not.toContain("m4"); // inactive
  });

  it("returns candidates sorted ascending by daysRemaining", () => {
    const out = findRefillsDue(
      [
        {
          id: "a",
          name: "A",
          dosage: "1",
          frequency: "OD",
          startDate: "2026-04-24", // ~14d remaining
          active: true,
        },
        {
          id: "b",
          name: "B",
          dosage: "1",
          frequency: "OD",
          startDate: "2026-01-01", // very overdue (~-130d)
          active: true,
        },
      ],
      60,
      NOW
    );
    expect(out[0].id).toBe("b"); // most negative first
    expect(out[1].id).toBe("a");
  });

  it("REFILL_DEFAULTS uses 14-day window", () => {
    expect(REFILL_DEFAULTS.withinDays).toBe(14);
  });
});

describe("GET /medicines/refill-due", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("returns candidates for the calling patient", async () => {
    db.setWhere("medicines", (r) => r.patientId === "pat-1");
    const app = await buildApp(
      db,
      { id: "user-1", role: "patient" },
      {
        seedMedicines: [
          {
            id: "m-1",
            patientId: "pat-1",
            name: "Metformin",
            dosage: "500 mg",
            frequency: "twice daily",
            // ~26d ago, 30d course → ~4d remaining, well inside 14d window
            startDate: "2026-06-13",
            active: true,
            refillReminder: true,
          },
        ],
      }
    );
    const res = await app.request("/medicines/refill-due?days=14");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patientId).toBe("pat-1");
    expect(body.withinDays).toBe(14);
    expect(body.count).toBe(1);
    expect(body.refills[0].name).toBe("Metformin");
    expect(body.refills[0].refillReminder).toBe(true);
  });

  it("rejects days outside 1..365", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" });
    const res = await app.request("/medicines/refill-due?days=999");
    expect(res.status).toBe(400);
  });

  it("returns 403 for a patient the caller cannot access", async () => {
    const app = await buildApp(
      db,
      { id: "user-other", role: "patient" },
      { seedPatient: { id: "pat-1", userId: "user-1" } }
    );
    const res = await app.request("/medicines/refill-due?patientId=pat-1");
    expect(res.status).toBe(403);
  });

  it("uses default 14-day window when days omitted", async () => {
    const app = await buildApp(db, { id: "user-1", role: "patient" });
    const res = await app.request("/medicines/refill-due");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.withinDays).toBe(14);
  });
});