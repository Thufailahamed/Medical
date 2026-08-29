import { describe, expect, it } from "vitest";

import * as hooks from "@/patient/hooks";

/**
 * The public surface of `@/patient/hooks`. Every page test in this app
 * mocks the `@/patient/hooks` specifier, so this list is effectively the
 * portal's internal API. The domain-split in the parity Foundations work
 * moves these between files; this test proves none went missing.
 */
const EXPECTED_HOOK_EXPORTS = [
  "usePatientProfile",
  "useProfile",
  "useHealthSummary",
  "useWellness",
  "useVitalsSeries",
  "useVitalsAlerts",
  "useAppointments",
  "useAppointmentRecords",
  "useBookAppointment",
  "useCancelAppointment",
  "useRescheduleAppointment",
  "useRecords",
  "useRecordStats",
  "useRecord",
  "useMedications",
  "useAddMedication",
  "useEditMedication",
  "useStopMedication",
  "useTodayDoses",
  "useMarkDoseTaken",
  "useSkipDose",
  "useUntakeDose",
  "useMedicationsToday",
  "useMedicationStats",
  "useTimeline",
  "useConversations",
  "useConversationMessages",
  "useSendPatientMessage",
  "useMarkConversationRead",
  "useNotifications",
  "useUnreadNotificationsCount",
  "useMarkNotificationRead",
  "useMarkAllNotificationsRead",
  "useAllergies",
  "useAddAllergy",
  "useEditAllergy",
  "useDeleteAllergy",
  "useVaccinations",
  "useVaccinationsDue",
  "useAddVaccination",
  "useVitalsDerived",
  "useVitalsSeriesRaw",
  "useSymptoms",
  "useAddVital",
  "useDeleteVital",
  "useAddSymptom",
  "useDeleteSymptom",
  "useNotes",
  "useAddNote",
  "useEditNote",
  "useDeleteNote",
  "useLabResults",
  "useRefillDue",
  // SP2a additions
  "useRecordAttachments",
  "useRecordLabResults",
  "useRecordImagingFindings",
  "useRecordDischargeEvents",
  "useRecordVaccinationDoses",
  "useRecordPrescriptionItems",
  "useCreateRecord",
  "useUpdateRecord",
  "useDeleteRecord",
  "useArchiveRecord",
  "useRestoreRecord",
  "useMoveRecord",
  "useAddAttachment",
  "useDeleteAttachment",
  "usePresignAttachment",
  "useReExtractRecord",
  // Patient web parity additions
  "usePrescriptions",
  "usePrescription",
  "usePrescriptionPdfUrl",
  "useDoctorSearch",
  "useSpecialties",
  "useDoctorDetail",
  "useDoctorAvailability",
  "useRateAppointment",
  "useCareTeam",
  "useAddCareTeamMember",
  "useRemoveCareTeamMember",
  "useMarketplace",
  "useCaretaker",
  "useCaretakerInquiries",
  "useSendCaretakerInquiry",
  "useTestPackages",
  "useTestPackage",
  "useBookTestPackage",
  "useTestBookings",
  "useTestBooking",
  "useRateTest",
  "useNotificationPreferences",
  "useUpdateNotificationPreferences",
] as const;

const EXPECTED = new Set<string>(EXPECTED_HOOK_EXPORTS);

function isFunctionExport(key: string, value: unknown): boolean {
  return typeof value === "function";
}

describe("@/patient/hooks barrel", () => {
  it.each(EXPECTED_HOOK_EXPORTS)("exports %s as a function", (name) => {
    expect(typeof (hooks as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports no extra function-shaped members", () => {
    const actual = Object.entries(hooks)
      .filter(([k, v]) => isFunctionExport(k, v))
      .map(([k]) => k)
      .sort();
    const expected = [...EXPECTED].sort();
    expect(actual).toEqual(expected);
  });
});
