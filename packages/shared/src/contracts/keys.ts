/**
 * Query keys and shared options for every patient hook, on both web and
 * mobile.
 *
 * Every key starts with "patient" so a single prefix invalidates the whole
 * surface, and so patient cache entries never collide with the clinician
 * portal's. Lives in @healthcare/shared so the Expo app and the web portal
 * invalidate on identical keys — `useRealtime` on either platform can then
 * map a server event to the same cache entry.
 */

export const PATIENT_QUERY_DEFAULTS = {
  staleTime: 60_000,
  retry: 1,
} as const;

export type RangeKey = "week" | "month" | "quarter";

export const patientKeys = {
  all: ["patient"] as const,

  profile: () => ["patient", "profile"] as const,
  healthSummary: () => ["patient", "health-summary"] as const,
  wellness: () => ["patient", "wellness"] as const,

  vitals: () => ["patient", "vitals"] as const,
  vitalsSeries: (type: string, range: RangeKey) =>
    ["patient", "vitals", "series", type, range] as const,
  vitalsDerived: () => ["patient", "vitals", "derived"] as const,
  vitalsAlerts: (days: number) => ["patient", "vitals", "alerts", days] as const,
  symptoms: () => ["patient", "vitals", "symptoms"] as const,

  appointments: () => ["patient", "appointments"] as const,
  appointmentRecords: (id: string) =>
    ["patient", "appointments", id, "records"] as const,

  records: (params: Record<string, unknown>) =>
    ["patient", "records", params] as const,
  recordStats: () => ["patient", "records", "stats"] as const,
  record: (id: string) => ["patient", "records", id] as const,
  recordAttachments: (id: string) =>
    ["patient", "records", id, "attachments"] as const,
  recordChildren: (id: string, kind: string) =>
    ["patient", "records", id, kind] as const,
  labTrend: (test: string, months: number) =>
    ["patient", "records", "lab-trend", test, months] as const,
  labResults: (params: { months?: number } = {}) =>
    ["patient", "records", "lab-results", params] as const,

  medicines: () => ["patient", "medicines"] as const,
  medicinesToday: () => ["patient", "medicines", "today"] as const,
  medicineStats: (days: number) =>
    ["patient", "medicines", "stats", days] as const,
  medicineRefills: () => ["patient", "medicines", "refills"] as const,
  medicineInteractions: () => ["patient", "medicines", "interactions"] as const,

  doses: () => ["patient", "doses"] as const,
  dosesToday: () => ["patient", "doses", "today"] as const,

  timeline: (params: Record<string, unknown>) =>
    ["patient", "timeline", params] as const,

  conversations: () => ["patient", "messages", "conversations"] as const,
  conversation: (id: string) =>
    ["patient", "messages", "conversations", id] as const,
  chatSessions: () => ["patient", "messages", "chat-sessions"] as const,

  notifications: () => ["patient", "notifications"] as const,
  unreadCount: () => ["patient", "notifications", "unread"] as const,

  allergies: () => ["patient", "allergies"] as const,
  vaccinations: () => ["patient", "vaccinations"] as const,
  vaccinationsDue: () => ["patient", "vaccinations", "due"] as const,
  family: () => ["patient", "family"] as const,
  familyActive: () => ["patient", "family", "active"] as const,
  notes: () => ["patient", "notes"] as const,

  prescriptions: () => ["patient", "prescriptions"] as const,
  prescription: (id: string) => ["patient", "prescriptions", id] as const,

  doctors: (params: Record<string, unknown>) =>
    ["patient", "doctors", params] as const,
  doctor: (id: string) => ["patient", "doctors", id] as const,
  doctorSlots: (id: string, date?: string) =>
    ["patient", "doctors", id, "slots", date ?? "any"] as const,

  notificationPrefs: () => ["patient", "notification-prefs"] as const,

  careTeam: () => ["patient", "care-team"] as const,

  marketplace: (params: Record<string, unknown>) =>
    ["patient", "marketplace", params] as const,
  marketplaceCaretaker: (id: string) => ["patient", "marketplace", id] as const,
  marketplaceInquiries: () => ["patient", "marketplace", "inquiries"] as const,

  tenants: () => ["patient", "tenants"] as const,
  activeTenant: () => ["patient", "tenants", "active"] as const,

  diagnosticPackages: () => ["patient", "diagnostic", "packages"] as const,
  diagnosticPackage: (slug: string) =>
    ["patient", "diagnostic", "packages", slug] as const,
  diagnosticBookings: () => ["patient", "diagnostic", "bookings"] as const,
  diagnosticBooking: (id: string) =>
    ["patient", "diagnostic", "bookings", id] as const,

  activity: (limit?: number) => ["patient", "activity", limit ?? 50] as const,
};

/** Range key → an ISO `from` bound. `to` is always "now" (omitted). */
export function rangeToFrom(range: RangeKey, now = new Date()): string {
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return d.toISOString();
}
