/**
 * Endpoint path builders for the patient surface.
 *
 * Every patient endpoint string in the codebase should come from here, so
 * that the Expo app and the web portal cannot drift onto different URLs
 * for the same resource. Builders return the path only — the base URL and
 * auth headers are each platform's fetch layer's business.
 */

/** Build a query string, dropping empty values and omitting `?` entirely when nothing is set. */
function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export interface RecordsQuery {
  type?: string;
  search?: string;
  limit?: number;
}

export interface LabResultsQuery {
  months?: number;
  test?: string;
}

export interface TimelineQuery {
  limit?: number;
  kinds?: string[];
}

export const patientPaths = {
  profile: {
    me: () => "/patients/me",
    auth: () => "/auth/me",
    healthSummary: () => "/health-summary/me",
    wellness: () => "/wellness/me",
  },

  vitals: {
    series: (type: string, from: string) =>
      `/vitals/me/series${qs({ type, from })}`,
    derived: () => "/vitals/me/derived",
    alerts: (days: number) => `/vitals/me/alerts${qs({ days })}`,
    create: () => "/vitals",
    detail: (id: string) => `/vitals/${id}`,
    symptoms: () => "/vitals/symptoms/me",
    symptomCreate: () => "/vitals/symptoms",
    symptomDetail: (id: string) => `/vitals/symptoms/${id}`,
  },

  appointments: {
    mine: () => "/appointments/me",
    create: () => "/appointments",
    detail: (id: string) => `/appointments/${id}`,
    records: (id: string) => `/appointments/${id}/records`,
    reschedule: (id: string) => `/appointments/${id}/reschedule`,
  },

  records: {
    mine: (q: RecordsQuery = {}) =>
      `/medical-records/me${qs({ type: q.type, search: q.search, limit: q.limit })}`,
    stats: () => "/medical-records/me/stats",
    detail: (id: string) => `/medical-records/${id}`,
    labResults: (q: LabResultsQuery = {}) =>
      `/medical-records/me/lab-results${qs({ months: q.months, test: q.test })}`,
    // Write-path additions (SP2a)
    create: () => "/medical-records/envelope",
    update: (id: string) => `/medical-records/${id}`,
    delete: (id: string) => `/medical-records/${id}`,
    attachments: (id: string) => `/files/record/${id}`,
    attachmentUpload: () => "/files/upload",
    attachmentDelete: (id: string) => `/files/${id}`,
    attachmentPresign: () => "/files/presign",
    attachmentDownload: (key: string, stream?: 0 | 1) =>
      `/files/download/${key}${qs({ stream })}`,
    reExtract: (id: string) => `/medical-records/${id}/re-extract`,
    children: {
      lab: (id: string) => `/medical-records/${id}/lab-results`,
      imaging: (id: string) => `/medical-records/${id}/imaging-findings`,
      discharge: (id: string) => `/medical-records/${id}/discharge-events`,
      vaccination: (id: string) => `/medical-records/${id}/vaccination-doses`,
      prescription: (id: string) => `/medical-records/${id}/prescription-items`,
    },
  },

  medicines: {
    mine: () => "/medicines/me",
    create: () => "/medicines",
    detail: (id: string) => `/medicines/${id}`,
    stop: (id: string) => `/medicines/${id}/stop`,
    today: () => "/medicines/today",
    stats: (days: number) => `/medicines/me/stats${qs({ days })}`,
    refillDue: (days: number) => `/medicines/refill-due${qs({ days })}`,
  },

  doses: {
    mine: (from: string, to: string) => `/doses/me${qs({ from, to })}`,
    taken: (id: string) => `/doses/${id}/taken`,
    skip: (id: string) => `/doses/${id}/skip`,
  },

  messages: {
    conversations: () => "/patient-messages/conversations",
    conversationMessages: (id: string) =>
      `/patient-messages/conversations/${id}/messages`,
    conversationRead: (id: string) =>
      `/patient-messages/conversations/${id}/read`,
  },

  notifications: {
    mine: () => "/notifications/me",
    unreadCount: () => "/notifications/unread-count",
    read: (id: string) => `/notifications/${id}/read`,
    readAll: () => "/notifications/read-all",
  },

  allergies: {
    mine: () => "/allergies/me",
    detail: (id: string) => `/allergies/${id}`,
  },

  vaccinations: {
    mine: () => "/vaccinations/me",
    due: () => "/vaccinations/me/due",
  },

  notes: {
    mine: () => "/notes/me",
    create: () => "/notes",
    detail: (id: string) => `/notes/${id}`,
  },

  timeline: {
    mine: (q: TimelineQuery = {}) =>
      `/timeline/me${qs({ limit: q.limit, kinds: q.kinds?.length ? q.kinds.join(",") : undefined })}`,
  },
} as const;
