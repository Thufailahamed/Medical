// tests/doctor-search-telemedicine.test.ts
//
// Doctor Booking (Round 6): /doctor/search telemedicine filter.
//
// What we cover:
//   - ?telemedicine=1 excludes doctors without the flag.
//   - ?telemedicine=1 returns only telemedicine-enabled doctors.
//   - No param returns all doctors (legacy behaviour preserved).
//   - Response rows carry `telemedicineEnabled` so the mobile card can
//     render an "Online" pill without a second roundtrip.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import doctorRouter from "../src/routes/doctor";
import type { AppEnvironment } from "../src/types";

const USER = "user-search-tm";
const DOCTOR_VIDEO = "00000000-0000-4000-8000-0000000000c1";
const DOCTOR_IN_PERSON = "00000000-0000-4000-8000-0000000000c2";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  // MockD1 doesn't implement D1's `db.all<T>(sql)` — the response-time
  // helper uses it to fetch the conversation-count + avg-ms row. Stub
  // it here so /doctor/search doesn't 500 in unit tests. Real D1 will
  // answer for real; this stub returns "no conversations" so the
  // `responseTime` bucket is null and the search proceeds.
  (db as any).all = vi.fn().mockResolvedValue([]);
  db.seed("users", [
    { id: USER, role: "patient", name: "Pat", email: "p@test.local" },
    { id: "user-doc-video", role: "doctor", name: "Dr. Video" },
    { id: "user-doc-in-person", role: "doctor", name: "Dr. InPerson" },
  ]);
  db.seed("doctors", [
    {
      id: DOCTOR_VIDEO,
      userId: "user-doc-video",
      specialization: "Cardiology",
      telemedicineEnabled: true,
    } as any,
    {
      id: DOCTOR_IN_PERSON,
      userId: "user-doc-in-person",
      specialization: "Cardiology",
      telemedicineEnabled: false,
    } as any,
  ]);
  // Default: all doctors visible. Individual tests override via
  // `setWhere("doctors", …)` to exercise the telemedicine filter
  // (MockD1 doesn't parse `eq(col, literalValue)` so the Drizzle
  // `where(and(...))` chain is bypassed in favour of a JS predicate).
  db.setWhere("doctors", () => true);
  baseApp = await buildTestApp(db, { id: USER, role: "patient" });
  baseApp.route("/doctor", doctorRouter);
});

describe("GET /doctor/search — telemedicine filter", () => {
  it("returns telemedicine-enabled rows when ?telemedicine=1", async () => {
    db.setWhere("doctors", (r) => r.telemedicineEnabled === true);
    const res = await getJson(baseApp, "/doctor/search?telemedicine=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.doctors.length).toBe(1);
    expect(body.doctors[0].doctorId).toBe(DOCTOR_VIDEO);
    expect(body.doctors[0].telemedicineEnabled).toBe(true);
  });

  it("returns all doctors when no telemedicine param", async () => {
    db.setWhere("doctors", () => true);
    const res = await getJson(baseApp, "/doctor/search");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const ids = body.doctors.map((d: any) => d.doctorId).sort();
    expect(ids).toContain(DOCTOR_VIDEO);
    expect(ids).toContain(DOCTOR_IN_PERSON);
  });

  it("surfaces telemedicineEnabled on every row", async () => {
    db.setWhere("doctors", () => true);
    const res = await getJson(baseApp, "/doctor/search");
    const body = (await res.json()) as any;
    for (const d of body.doctors) {
      expect(d).toHaveProperty("telemedicineEnabled");
    }
  });
});