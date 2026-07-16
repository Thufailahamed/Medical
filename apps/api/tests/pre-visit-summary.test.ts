// tests/pre-visit-summary.test.ts
//
// Tier 1 records PR3: Doctor Pre-visit Summary. Tests the pure helpers
// + the doctor-portal endpoint shape. We mock AI.complete by skipping
// the network and asserting the snapshot derivation is correct.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "node:crypto";
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { formatPreVisitSummaryEmail } from "../src/lib/email";
import { sendPreVisitSummaryEmail } from "../src/lib/pre-visit-summary";
import { MockD1 } from "./_mockDb";

function db() {
  return new MockD1();
}

const NOW = "2026-07-16T09:00:00.000Z";

describe("formatPreVisitSummaryEmail", () => {
  it("includes severe allergies + chronic conditions + active meds", () => {
    const out = formatPreVisitSummaryEmail({
      patientName: "Alice",
      doctorName: "Dr Smith",
      hospitalName: "City Hospital",
      visitDate: "2026-07-16",
      visitTime: "10:00",
      allergiesTop: ["Penicillin", "Latex"],
      activeMedsCount: 2,
      activeMedsNames: ["Atorvastatin", "Metformin"],
      chronicConditions: ["Type 2 Diabetes", "Hypertension"],
      recentDiagnosis: "Routine review",
      summaryShort: "Stable patient.",
      summaryUrl: "https://app.healthhub.app/portal/appointments/a1",
    });
    expect(out.subject).toContain("Alice");
    expect(out.subject).toContain("2026-07-16");
    expect(out.text).toContain("Penicillin");
    expect(out.text).toContain("Type 2 Diabetes");
    expect(out.text).toContain("Atorvastatin");
    expect(out.html).toContain("Penicillin");
    expect(out.html).toContain("/portal/appointments/a1");
  });

  it("handles empty allergies/meds gracefully", () => {
    const out = formatPreVisitSummaryEmail({
      patientName: "Bob",
      doctorName: "Dr Lee",
      visitDate: "2026-07-16",
      visitTime: "11:00",
      allergiesTop: [],
      activeMedsCount: 0,
      activeMedsNames: [],
      chronicConditions: [],
      summaryShort: "First visit.",
      summaryUrl: "https://app.healthhub.app/x",
    });
    expect(out.text).toContain("No active medicines recorded");
    expect(out.text).not.toContain("Severe allergies:");
  });
});

describe("sendPreVisitSummaryEmail", () => {
  beforeEach(() => {
    // Mock crypto.randomUUID / Date for deterministic stamps.
    vi.setSystemTime(new Date(NOW));
  });

  it("skips already-sent appointments (idempotency)", async () => {
    const d = db();
    const APPT = "appt-1";
    d.seed("appointments", [
      {
        id: APPT,
        doctorId: "doc-1",
        patientId: "pat-1",
        hospitalId: "h-1",
        date: "2026-07-16",
        time: "10:00",
        status: "confirmed",
        preVisitSummarySentAt: NOW, // already sent
      },
    ]);
    const result = await sendPreVisitSummaryEmail(
      {
        EMAIL_PROVIDER: "console",
        PUBLIC_URL: "https://app.healthhub.app",
      },
      d,
      APPT
    );
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("already_sent");
  });

  it("skips non-confirmed appointments", async () => {
    const d = db();
    const APPT = "appt-2";
    d.seed("appointments", [
      {
        id: APPT,
        doctorId: "doc-1",
        patientId: "pat-1",
        hospitalId: "h-1",
        date: "2026-07-16",
        time: "10:00",
        status: "completed",
      },
    ]);
    const result = await sendPreVisitSummaryEmail(
      { EMAIL_PROVIDER: "console", PUBLIC_URL: "https://app.healthhub.app" },
      d,
      APPT
    );
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("not_confirmed");
  });

  it("returns no_doctor_email when doctor has no email on users table", async () => {
    const d = db();
    const APPT = "appt-3";
    d.seed("appointments", [
      {
        id: APPT,
        doctorId: "doc-1",
        patientId: "pat-1",
        hospitalId: "h-1",
        date: "2026-07-16",
        time: "10:00",
        status: "confirmed",
      },
    ]);
    d.seed("users", [{ id: "u-doc-1", role: "doctor", name: "Dr" }]);
    d.seed("doctors", [{ id: "doc-1", userId: "u-doc-1", hospitalId: "h-1" }]);
    d.seed("patients", [{ id: "pat-1", userId: "u-pat-1" }]);
    // Doctor row missing email → returns no_doctor_email.

    const result = await sendPreVisitSummaryEmail(
      { EMAIL_PROVIDER: "console", PUBLIC_URL: "https://app.healthhub.app" },
      d,
      APPT
    );
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("no_doctor_email");
  });
});