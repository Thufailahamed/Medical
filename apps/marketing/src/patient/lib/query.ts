/**
 * Query keys and shared options for every patient hook.
 *
 * Every key starts with "patient" so the dashboard's refresh control
 * can invalidate the whole surface with a single prefix, and so patient
 * cache entries never collide with the clinician portal's.
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
  recordChildren: (id: string, kind: string) =>
    ["patient", "records", id, kind] as const,
  labTrend: (test: string, months: number) =>
    ["patient", "records", "lab-trend", test, months] as const,

  medicines: () => ["patient", "medicines"] as const,
  medicinesToday: () => ["patient", "medicines", "today"] as const,
  medicineStats: (days: number) =>
    ["patient", "medicines", "stats", days] as const,
  medicineRefills: () => ["patient", "medicines", "refills"] as const,
  medicineInteractions: () => ["patient", "medicines", "interactions"] as const,

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
  family: () => ["patient", "family"] as const,
};

/** Range key → an ISO `from` bound. `to` is always "now" (omitted). */
export function rangeToFrom(range: RangeKey, now = new Date()): string {
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return d.toISOString();
}