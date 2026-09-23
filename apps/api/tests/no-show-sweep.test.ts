// tests/no-show-sweep.test.ts
//
// The sweep must expire stale visits even when nobody opens
// /appointments/me — the reliability half of the "old sessions show
// as Coming up" fix.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import { noShowSweepRouter } from "../src/cron/no-show-sweep-router";
import { runNoShowSweep } from "../src/cron/no-show-sweep";
import type { AppEnvironment } from "../src/types";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("appointments", [
    { id: "apt-stale", patientId: "p1", doctorId: "d1", date: "2026-09-01", time: "10:00", status: "confirmed" },
    { id: "apt-future", patientId: "p2", doctorId: "d1", date: "2099-01-01", time: "10:00", status: "scheduled" },
  ]);
  db.seed("appointmentStatusHistory", []);
});

describe("runNoShowSweep", () => {
  it("expires stale rows across all patients and reports the count", async () => {
    const result = await runNoShowSweep(db);
    expect(result).toEqual({ expired: 1 });
    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-stale").status).toBe("no_show");
    expect(rows.find((r) => r.id === "apt-future").status).toBe("scheduled");
    expect(db.tables["appointmentStatusHistory"].rows.length).toBe(1);
  });
});

describe("POST /__cron/no-show-sweep", () => {
  it("runs the sweep and returns { ok, expired }", async () => {
    const app = await buildTestApp(db);
    app.route("/", noShowSweepRouter);
    const res = await postJson(app, "/__cron/no-show-sweep", {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.expired).toBe(1);
  });
});
