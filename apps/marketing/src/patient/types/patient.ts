/**
 * Patient API response shapes.
 *
 * Defined in `@healthcare/shared/contracts` so the Expo app and this
 * portal describe every endpoint identically. This module remains the
 * web-side import site: 16 files already import `@/patient/types/patient`,
 * and keeping that specifier stable means the move touches no call sites.
 */

export type {
  AllergyRow,
  AppointmentRow,
  Conversation,
  HealthSummary,
  LabResultRow,
  MedicineRow,
  MedicineStats,
  Message,
  NoteRow,
  RecordRow,
  RecordStats,
  RefillCandidate,
  SymptomRow,
  TimelineEvent,
  VaccinationAdministeredRow,
  VaccinationSlot,
  VitalAlert,
  VitalContext,
  VitalPoint,
  VitalSeriesResponse,
  VitalStats,
  VitalType,
  VitalsDerived,
  WellnessResponse,
} from "@healthcare/shared/contracts";
