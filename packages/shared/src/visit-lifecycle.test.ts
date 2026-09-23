import { describe, it, expect } from "vitest";
import {
  computeVisitLifecycle,
  visitStartsAt,
  slTodayIso,
  slDayDiff,
  countdownDays,
  canTransitionVisit,
  canJoinVideoVisit,
} from "./visit-lifecycle";

// Reference "now": 2026-09-22 15:00 SL time = 09:30 UTC.
const NOW = new Date("2026-09-22T09:30:00Z").getTime();

describe("visitStartsAt", () => {
  it("parses date+time as Asia/Colombo", () => {
    expect(visitStartsAt("2026-09-22", "15:00")).toBe(NOW);
  });
  it("falls back to 00:00 when time is missing", () => {
    const midday = new Date("2026-09-22T06:30:00Z").getTime(); // 12:00 SL
    expect(visitStartsAt("2026-09-22", null)).toBe(
      new Date("2026-09-21T18:30:00Z").getTime() // 2026-09-22T00:00+05:30
    );
    expect(midday).toBeGreaterThan(visitStartsAt("2026-09-22", null));
  });
});

describe("computeVisitLifecycle — buckets", () => {
  it("status completed wins", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "completed", now: NOW }).bucket
    ).toBe("completed");
  });
  it("status cancelled wins", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "cancelled", now: NOW }).bucket
    ).toBe("cancelled");
  });
  it("no_show maps to missed", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "no_show", now: NOW }).bucket
    ).toBe("missed");
  });
  it("stale scheduled (past grace) is missed — the old-sessions bug", () => {
    const lc = computeVisitLifecycle({
      date: "2026-09-22", time: "09:00", status: "scheduled", now: NOW,
    });
    expect(lc.isPast).toBe(true);
    expect(lc.bucket).toBe("missed");
  });
  it("confirmed within grace window is still today (not missed)", () => {
    const lc = computeVisitLifecycle({
      date: "2026-09-22", time: "14:50", status: "confirmed", now: NOW,
    });
    expect(lc.isPast).toBe(false);
    expect(lc.bucket).toBe("today");
  });
  it("later today is today", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "18:00", status: "scheduled", now: NOW }).bucket
    ).toBe("today");
  });
  it("future day is upcoming", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-25", time: "10:00", status: "confirmed", now: NOW }).bucket
    ).toBe("upcoming");
  });
  it("elapsed in_progress anomaly surfaces as missed", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-21", time: "10:00", status: "in_progress", now: NOW }).bucket
    ).toBe("missed");
  });
  it("stale in_progress earlier today is missed, never today/upcoming", () => {
    // 09:00 SL start, now 15:00 SL — same calendar day but past grace.
    const lc = computeVisitLifecycle({
      date: "2026-09-22", time: "09:00", status: "in_progress", now: NOW,
    });
    expect(lc.isPast).toBe(true);
    expect(lc.bucket).toBe("missed");
  });
  it("future in_progress is upcoming", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-25", time: "10:00", status: "in_progress", now: NOW }).bucket
    ).toBe("upcoming");
  });
  it("unknown status with elapsed start is missed, never upcoming", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-20", time: "10:00", status: "weird", now: NOW }).bucket
    ).toBe("missed");
  });
});

describe("visit state machine", () => {
  it("terminal states are final (no resurrection)", () => {
    expect(canTransitionVisit("completed", "scheduled")).toBe(false);
    expect(canTransitionVisit("cancelled", "confirmed")).toBe(false);
    expect(canTransitionVisit("no_show", "in_progress")).toBe(false);
  });
  it("scheduled cannot jump straight to completed", () => {
    expect(canTransitionVisit("scheduled", "completed")).toBe(false);
  });
  it("no_show is reachable from every active state (offline + video)", () => {
    expect(canTransitionVisit("scheduled", "no_show")).toBe(true);
    expect(canTransitionVisit("confirmed", "no_show")).toBe(true);
    expect(canTransitionVisit("in_progress", "no_show")).toBe(true);
  });
});

describe("canJoinVideoVisit", () => {
  it("video + live window can join", () => {
    expect(
      canJoinVideoVisit({ mode: "video", status: "confirmed", date: "2026-09-22", time: "15:05", now: NOW })
    ).toBe(true);
  });
  it("offline never joins", () => {
    expect(
      canJoinVideoVisit({ mode: "in_person", status: "confirmed", date: "2026-09-22", time: "15:05", now: NOW })
    ).toBe(false);
  });
  it("stale video visit cannot join", () => {
    expect(
      canJoinVideoVisit({ mode: "video", status: "scheduled", date: "2026-09-20", time: "10:00", now: NOW })
    ).toBe(false);
  });
  it("completed video visit cannot join", () => {
    expect(
      canJoinVideoVisit({ mode: "video", status: "completed", date: "2026-09-22", time: "15:00", now: NOW })
    ).toBe(false);
  });
});

describe("computeVisitLifecycle — isLive", () => {
  it("true 5 min before start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:05", status: "confirmed", now: NOW }).isLive
    ).toBe(true);
  });
  it("true 20 min after start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "14:40", status: "in_progress", now: NOW }).isLive
    ).toBe(true);
  });
  it("false 2h before start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "17:00", status: "confirmed", now: NOW }).isLive
    ).toBe(false);
  });
  it("false 45 min after start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "14:15", status: "confirmed", now: NOW }).isLive
    ).toBe(false);
  });
  it("false for completed even inside window", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "completed", now: NOW }).isLive
    ).toBe(false);
  });
});

describe("SL calendar helpers", () => {
  it("slTodayIso uses Asia/Colombo even near UTC midnight", () => {
    // 2026-09-22T19:00Z = 2026-09-23 00:30 SL
    expect(slTodayIso(new Date("2026-09-22T19:00:00Z").getTime())).toBe("2026-09-23");
  });
  it("slDayDiff: yesterday −1, today 0, tomorrow +1", () => {
    expect(slDayDiff("2026-09-21", NOW)).toBe(-1);
    expect(slDayDiff("2026-09-22", NOW)).toBe(0);
    expect(slDayDiff("2026-09-23", NOW)).toBe(1);
  });
  it("countdownDays rounds up and never goes negative", () => {
    expect(countdownDays(NOW + 86_400_000, NOW)).toBe(1);
    expect(countdownDays(NOW - 86_400_000, NOW)).toBe(0);
  });
});
