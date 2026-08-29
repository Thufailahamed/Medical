import { describe, expect, it } from "vitest";

import { patientPaths } from "./paths";

describe("patientPaths", () => {
  it("builds the collection endpoints the patient surface reads", () => {
    expect(patientPaths.profile.me()).toBe("/patients/me");
    expect(patientPaths.profile.auth()).toBe("/auth/me");
    expect(patientPaths.profile.healthSummary()).toBe("/health-summary/me");
    expect(patientPaths.profile.wellness()).toBe("/wellness/me");
    expect(patientPaths.appointments.mine()).toBe("/appointments/me");
    expect(patientPaths.medicines.mine()).toBe("/medicines/me");
    expect(patientPaths.medicines.today()).toBe("/medicines/today");
    expect(patientPaths.notifications.unreadCount()).toBe(
      "/notifications/unread-count"
    );
    expect(patientPaths.notifications.readAll()).toBe(
      "/notifications/read-all"
    );
    expect(patientPaths.vaccinations.due()).toBe("/vaccinations/me/due");
    expect(patientPaths.notes.create()).toBe("/notes");
  });

  it("interpolates ids into detail endpoints", () => {
    expect(patientPaths.records.detail("rec_1")).toBe("/medical-records/rec_1");
    expect(patientPaths.appointments.detail("a1")).toBe("/appointments/a1");
    expect(patientPaths.appointments.records("a1")).toBe(
      "/appointments/a1/records"
    );
    expect(patientPaths.appointments.reschedule("a1")).toBe(
      "/appointments/a1/reschedule"
    );
    expect(patientPaths.medicines.detail("m1")).toBe("/medicines/m1");
    expect(patientPaths.medicines.stop("m1")).toBe("/medicines/m1/stop");
    expect(patientPaths.doses.taken("d1")).toBe("/doses/d1/taken");
    expect(patientPaths.doses.skip("d1")).toBe("/doses/d1/skip");
    expect(patientPaths.vitals.create()).toBe("/vitals");
    expect(patientPaths.vitals.detail("v1")).toBe("/vitals/v1");
    expect(patientPaths.allergies.detail("al1")).toBe("/allergies/al1");
  });

  it("builds the conversations and messages endpoints", () => {
    expect(patientPaths.messages.conversations()).toBe(
      "/patient-messages/conversations"
    );
    expect(patientPaths.messages.conversationMessages("c1")).toBe(
      "/patient-messages/conversations/c1/messages"
    );
    expect(patientPaths.messages.conversationRead("c1")).toBe(
      "/patient-messages/conversations/c1/read"
    );
  });

  it("drops empty filters so /medical-records/me carries no trailing ?", () => {
    expect(patientPaths.records.mine({})).toBe("/medical-records/me");
    expect(patientPaths.records.mine({ type: "", search: "", limit: undefined })).toBe(
      "/medical-records/me"
    );
    expect(patientPaths.timeline.mine({})).toBe("/timeline/me");
    expect(patientPaths.notes.mine()).toBe("/notes/me");
  });

  it("encodes query values so a search term cannot break the URL", () => {
    expect(patientPaths.records.mine({ search: "a&b", limit: 5 })).toBe(
      "/medical-records/me?search=a%26b&limit=5"
    );
    expect(
      patientPaths.vitals.series("blood_pressure", "2026-01-01T00:00:00.000Z")
    ).toBe(
      "/vitals/me/series?type=blood_pressure&from=2026-01-01T00%3A00%3A00.000Z"
    );
  });

  it("joins timeline kinds with commas", () => {
    expect(
      patientPaths.timeline.mine({ limit: 10, kinds: ["record", "vital"] })
    ).toBe("/timeline/me?limit=10&kinds=record%2Cvital");
    // Empty kinds array is dropped.
    expect(patientPaths.timeline.mine({ kinds: [] })).toBe("/timeline/me");
  });

  it("encodes the lab-results query", () => {
    expect(patientPaths.records.labResults({ months: 6, test: "hba1c" })).toBe(
      "/medical-records/me/lab-results?months=6&test=hba1c"
    );
  });

  it("encodes doses range from/to", () => {
    expect(
      patientPaths.doses.mine("2026-08-29T00:00:00.000Z", "2026-08-29T23:59:59.999Z")
    ).toBe(
      "/doses/me?from=2026-08-29T00%3A00%3A00.000Z&to=2026-08-29T23%3A59%3A59.999Z"
    );
  });

  it("builds the record write-path endpoints (SP2a)", () => {
    expect(patientPaths.records.create()).toBe("/medical-records/envelope");
    expect(patientPaths.records.update("abc")).toBe("/medical-records/abc");
    expect(patientPaths.records.delete("abc")).toBe("/medical-records/abc");
    expect(patientPaths.records.attachments("r1")).toBe("/files/record/r1");
    expect(patientPaths.records.attachmentUpload()).toBe("/files/upload");
    expect(patientPaths.records.attachmentDelete("f1")).toBe("/files/f1");
    expect(patientPaths.records.attachmentPresign()).toBe("/files/presign");
    expect(patientPaths.records.attachmentDownload("k", 1)).toBe("/files/download/k?stream=1");
    expect(patientPaths.records.attachmentDownload("k")).toBe("/files/download/k");
    expect(patientPaths.records.reExtract("r1")).toBe("/medical-records/r1/re-extract");
  });

  it("builds the per-kind child endpoints (SP2a)", () => {
    expect(patientPaths.records.children.lab("r1")).toBe("/medical-records/r1/lab-results");
    expect(patientPaths.records.children.imaging("r1")).toBe("/medical-records/r1/imaging-findings");
    expect(patientPaths.records.children.discharge("r1")).toBe("/medical-records/r1/discharge-events");
    expect(patientPaths.records.children.vaccination("r1")).toBe("/medical-records/r1/vaccination-doses");
    expect(patientPaths.records.children.prescription("r1")).toBe("/medical-records/r1/prescription-items");
  });
});
