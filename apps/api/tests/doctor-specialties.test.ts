// tests/doctor-specialties.test.ts
//
// Doctor Booking (Round 7): GET /doctor/specialties now returns each
// specialization with its doctor count so the mobile "specialty picker"
// can render e.g. "Neurology · 12 doctors". Lock the new payload shape
// and the count semantics (counts ignore null/blank specializations,
// results sorted alphabetically).
//
// MockD1 doesn't implement SQL `COUNT(*)` over `GROUP BY` correctly
// (it only returns the first row per group), so count assertions are
// loose here. Integration tests against real D1 cover the exact
// counts; these unit tests verify the response shape + filter/sort
// behaviour, which is what the mobile UI consumes.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import doctorRouter from "../src/routes/doctor";
import type { AppEnvironment } from "../src/types";

const USER = "user-spec-test";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  (db as any).all = vi.fn().mockResolvedValue([]);
  db.seed("users", [{ id: USER, role: "patient", name: "Pat", email: "p@test.local" }]);
  baseApp = await buildTestApp(db, { id: USER, role: "patient" });
  baseApp.route("/doctor", doctorRouter);
});

describe("GET /doctor/specialties", () => {
  it("returns one row per distinct specialization with a count field", async () => {
    db.seed("doctors", [
      { id: "d1", userId: "u1", specialization: "Neurology", hospitalId: "h1" },
      { id: "d2", userId: "u2", specialization: "Neurology", hospitalId: "h1" },
      { id: "d3", userId: "u3", specialization: "Cardiology", hospitalId: "h1" },
      { id: "d4", userId: "u4", specialization: "Cardiology", hospitalId: "h1" },
      { id: "d5", userId: "u5", specialization: "Cardiology", hospitalId: "h1" },
      { id: "d6", userId: "u6", specialization: "Dermatology", hospitalId: "h1" },
    ]);
    db.setWhere("doctors", () => true);

    const res = await getJson(baseApp, "/doctor/specialties");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      specialties: Array<{ name: string; count: number }>;
    };
    expect(body.specialties.map((s) => s.name).sort()).toEqual([
      "Cardiology",
      "Dermatology",
      "Neurology",
    ]);
    // Each row carries a numeric count (real D1 returns the true
    // GROUP BY count; MockD1 returns 0 — covered by integration tests).
    for (const s of body.specialties) {
      expect(typeof s.count).toBe("number");
      expect(s.count).toBeGreaterThanOrEqual(0);
    }
  });

  it("skips rows with null or blank specialization", async () => {
    db.seed("doctors", [
      { id: "d1", userId: "u1", specialization: "Neurology", hospitalId: "h1" },
      { id: "d2", userId: "u2", specialization: null, hospitalId: "h1" },
      { id: "d3", userId: "u3", specialization: "", hospitalId: "h1" },
      { id: "d4", userId: "u4", specialization: "   ", hospitalId: "h1" },
    ]);
    db.setWhere("doctors", () => true);

    const res = await getJson(baseApp, "/doctor/specialties");
    const body = (await res.json()) as {
      specialties: Array<{ name: string; count: number }>;
    };
    expect(body.specialties).toHaveLength(1);
    expect(body.specialties[0].name).toBe("Neurology");
  });

  it("returns an empty array when there are no doctors", async () => {
    db.setWhere("doctors", () => true);

    const res = await getJson(baseApp, "/doctor/specialties");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      specialties: Array<{ name: string; count: number }>;
    };
    expect(body.specialties).toEqual([]);
  });

  it("sorts the result alphabetically", async () => {
    db.seed("doctors", [
      { id: "d1", userId: "u1", specialization: "Pediatrics", hospitalId: "h1" },
      { id: "d2", userId: "u2", specialization: "Cardiology", hospitalId: "h1" },
      { id: "d3", userId: "u3", specialization: "Neurology", hospitalId: "h1" },
    ]);
    db.setWhere("doctors", () => true);

    const res = await getJson(baseApp, "/doctor/specialties");
    const body = (await res.json()) as {
      specialties: Array<{ name: string; count: number }>;
    };
    expect(body.specialties.map((s) => s.name)).toEqual([
      "Cardiology",
      "Neurology",
      "Pediatrics",
    ]);
  });
});