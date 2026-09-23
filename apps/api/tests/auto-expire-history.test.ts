// tests/auto-expire-history.test.ts
//
// auto-expire to no_show must (a) write an appointment_status_history
// audit row (was: silent status flip), (b) return the expired count,
// (c) leave in_progress/completed/cancelled rows alone.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import { autoExpireAppointments } from "../src/lib/booking";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  // 2 days ago — well past the 15-minute grace window.
  db.seed("appointments", [
    { id: "apt-old-sched", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "10:00", status: "scheduled" },
    { id: "apt-old-conf", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "11:00", status: "confirmed" },
    { id: "apt-old-prog", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "12:00", status: "in_progress" },
    { id: "apt-old-done", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "13:00", status: "completed" },
    { id: "apt-old-canc", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "14:00", status: "cancelled" },
  ]);
  db.seed("appointmentStatusHistory", []);
});

describe("autoExpireAppointments", () => {
  it("expires stale scheduled/confirmed rows and writes history", async () => {
    const expired = await autoExpireAppointments(db, "p1");
    expect(expired).toBe(2);

    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-old-sched").status).toBe("no_show");
    expect(rows.find((r) => r.id === "apt-old-conf").status).toBe("no_show");

    const hist = db.tables["appointmentStatusHistory"].rows;
    expect(hist.length).toBe(2);
    for (const h of hist) {
      expect(h.toStatus).toBe("no_show");
      expect(h.fromStatus === "scheduled" || h.fromStatus === "confirmed").toBe(true);
      expect(h.reason).toBe("auto_expired");
    }
  });

  it("leaves in_progress, completed and cancelled rows alone", async () => {
    await autoExpireAppointments(db, "p1");
    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-old-prog").status).toBe("in_progress");
    expect(rows.find((r) => r.id === "apt-old-done").status).toBe("completed");
    expect(rows.find((r) => r.id === "apt-old-canc").status).toBe("cancelled");
    const hist = db.tables["appointmentStatusHistory"].rows;
    expect(hist.find((h) => h.appointmentId === "apt-old-prog")).toBeUndefined();
  });

  it("returns 0 and writes nothing when everything is fresh", async () => {
    const fresh = new MockD1();
    fresh.seed("appointments", [
      { id: "apt-fresh", patientId: "p1", doctorId: "d1", date: "2099-01-01", time: "10:00", status: "confirmed" },
    ]);
    fresh.seed("appointmentStatusHistory", []);
    const expired = await autoExpireAppointments(fresh, "p1");
    expect(expired).toBe(0);
    expect(fresh.tables["appointmentStatusHistory"].rows.length).toBe(0);
  });
});
