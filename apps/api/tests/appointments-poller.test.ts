// tests/appointments-poller.test.ts
//
// Doctor Booking (Round 6): SSE appointment poller unit tests.
//
// The /realtime SSE hub polls D1 every 2 s and emits typed events. The
// appointment poller is the one whose cursor advances on `updatedAt`
// (status flips + queue compactor + payment confirmations) so it can
// fire on every mutation.
//
// These tests bypass the SSE plumbing and exercise the poller factory
// directly: build the poller, run its `select(where)`, assert which
// rows the caller can see + how the seenKey behaves across updates.

import { describe, it, expect, beforeEach } from "vitest";
import { desc } from "drizzle-orm";
import { MockD1 } from "./_mockDb";
import { buildPollers } from "../src/routes/realtime";
import { appointments } from "@healthcare/db";

const PATIENT_USER = "user-patient-r";
const DOCTOR_USER = "user-doctor-r";
const PATIENT_ID = "patient-r";
const DOCTOR_ID = "doctor-r";

function seedAppointment(overrides: Partial<{
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string;
  date: string;
  time: string;
  status: string;
  mode: string;
  queueNumber: number;
  paymentStatus: string;
  updatedAt: string;
  createdAt: string;
}>) {
  return {
    id: overrides.id ?? "appt-default",
    doctorId: overrides.doctorId ?? DOCTOR_ID,
    patientId: overrides.patientId ?? PATIENT_ID,
    hospitalId: overrides.hospitalId ?? "hospital-r",
    date: overrides.date ?? "2026-08-01",
    time: overrides.time ?? "10:00",
    status: overrides.status ?? "scheduled",
    mode: overrides.mode ?? "in_person",
    queueNumber: overrides.queueNumber ?? 1,
    paymentStatus: overrides.paymentStatus ?? "pending",
    createdAt: overrides.createdAt ?? "2026-07-30T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-07-30T00:00:00Z",
  };
}

function getAppointmentPoller(
  userId: string,
  role: string,
  scopedPatientIds: string[],
  scopedDoctorId?: string | null
) {
  const pollers = buildPollers({
    role,
    userId,
    scopedPatientIds,
    scopedDoctorId: scopedDoctorId ?? null,
    db,
  } as any);
  const p = pollers.find((x) => x.key === "appointment");
  if (!p) throw new Error("appointment poller not registered");
  return p;
}

async function runPollerSelect(p: ReturnType<typeof getAppointmentPoller>) {
  const where = p.where();
  return p
    .select(where as any)
    .orderBy(desc(p.cursorColumn))
    .limit(25) as any;
}

beforeEach(() => {
  db = new MockD1();
  db.seed("appointments", []);
});

let db: MockD1;

describe("appointment poller — visibility", () => {
  it("emits rows for the patient's own appointments (patient role)", async () => {
    db.seed("appointments", [
      seedAppointment({ id: "appt-mine", patientId: PATIENT_ID }),
      seedAppointment({ id: "appt-other", patientId: "patient-other" }),
    ]);
    db.setWhere("appointments", (r) => r.patientId === PATIENT_ID);

    const p = getAppointmentPoller(PATIENT_USER, "patient", [PATIENT_ID]);
    const rows = await runPollerSelect(p);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("appt-mine");
  });

  it("emits rows for the doctor's own appointments (doctor role)", async () => {
    db.seed("appointments", [
      seedAppointment({ id: "appt-mine", doctorId: DOCTOR_ID }),
      seedAppointment({ id: "appt-other-doctor", doctorId: "doctor-other" }),
    ]);
    db.setWhere("appointments", (r) => r.doctorId === DOCTOR_ID);

    const p = getAppointmentPoller(DOCTOR_USER, "doctor", [], DOCTOR_ID);
    const rows = await runPollerSelect(p);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("appt-mine");
  });

  it("skips when the doctor has no doctorId scope (no doctors row)", async () => {
    const p = getAppointmentPoller(DOCTOR_USER, "doctor", [], null);
    expect(p.skip).toBe(true);
  });

  it("skips when the patient has no patient-id scope", async () => {
    const p = getAppointmentPoller(PATIENT_USER, "patient", []);
    expect(p.skip).toBe(true);
  });

  it("runs but emits nothing for unrelated roles (e.g. caretaker with no scope)", async () => {
    db.seed("appointments", [
      seedAppointment({ id: "appt-mine", patientId: PATIENT_ID }),
    ]);
    db.setWhere("appointments", (r) => r.patientId === PATIENT_ID);

    // caretaker role with empty patient scope → skip=true so the loop
    // never queries. This matches the existing care-team scoping: a
    // caretaker only sees appointments for an active principal.
    const p = getAppointmentPoller("user-caretaker", "caretaker", []);
    expect(p.skip).toBe(true);
  });
});

describe("appointment poller — cursor column + seenKey", () => {
  it("declares updatedAt as the cursor (not id)", () => {
    const p = getAppointmentPoller(PATIENT_USER, "patient", [PATIENT_ID]);
    expect(p.cursorColumnName).toBe("updatedAt");
    expect(p.cursorColumn).toBe(appointments.updatedAt);
  });

  it("uses an id+updatedAt seenKey so status flips re-emit", () => {
    const p = getAppointmentPoller(PATIENT_USER, "patient", [PATIENT_ID]);
    expect(typeof p.seenKey).toBe("function");
    const row = {
      id: "appt-1",
      updatedAt: "2026-08-01T10:00:00Z",
    };
    // Two statuses with the same id but different updatedAt must yield
    // different dedup keys — that's how status flips re-emit.
    expect(p.seenKey!(row)).toBe("appt-1:2026-08-01T10:00:00Z");
    expect(p.seenKey!({ ...row, updatedAt: "2026-08-01T11:00:00Z" })).not.toBe(
      p.seenKey!(row)
    );
  });
});

describe("appointment poller — payload shape", () => {
  it("includes all fields the mobile hook needs to refresh the queue", async () => {
    db.seed("appointments", [
      seedAppointment({
        id: "appt-payload",
        status: "confirmed",
        mode: "video",
        queueNumber: 3,
        paymentStatus: "paid",
        updatedAt: "2026-08-02T12:00:00Z",
      }),
    ]);
    db.setWhere("appointments", () => true);

    const p = getAppointmentPoller(PATIENT_USER, "patient", [PATIENT_ID]);
    const rows = await runPollerSelect(p);
    const payload = p.payload(rows[0]);
    expect(payload).toMatchObject({
      id: "appt-payload",
      doctorId: DOCTOR_ID,
      patientId: PATIENT_ID,
      status: "confirmed",
      mode: "video",
      queueNumber: 3,
      paymentStatus: "paid",
      updatedAt: "2026-08-02T12:00:00Z",
    });
    // No PII leak — patient/doctor names are NOT in the payload; the
    // mobile hook invalidates React Query keys so the consumer refetches
    // the existing detail/list endpoint and gets fresh joins.
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("patientName");
    expect(payload).not.toHaveProperty("doctorName");
  });
});