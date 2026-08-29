/**
 * Response types mirroring the REAL API shapes.
 *
 * Every type here was read off the handler in apps/api — none of it is
 * aspirational. If a field is optional it is because the handler can
 * genuinely omit it.
 */

export type VitalType =
  | "heart_rate"
  | "blood_pressure"
  | "spo2"
  | "temperature"
  | "blood_sugar"
  | "weight"
  | "respiratory_rate";

/** One point from GET /vitals/me/series. */
export interface VitalPoint {
  t: string;
  value: number;
  secondary: number | null;
  id: string;
  unit: string;
  context: string | null;
}

export interface VitalStats {
  min: number;
  max: number;
  avg: number;
  latest: number;
  delta: number;
  count: number;
}

/** GET /vitals/me/series?type=&from=&to= */
export interface VitalSeriesResponse {
  type: VitalType;
  range: { from: string | null; to: string | null };
  points: VitalPoint[];
  stats: VitalStats | null;
  latestClassification: string | null;
}

/** One alert from GET /vitals/me/alerts. */
export interface VitalAlert {
  type: VitalType;
  classification: string;
  value: number;
  secondary?: number | null;
  recordedAt: string;
  message?: string;
}

/** GET /wellness/me */
export interface WellnessResponse {
  score: number;
  level: { label: string; tone: "success" | "info" | "warning" | "danger" };
  components: Record<string, number>;
  updatedAt: string;
}

/** GET /medicines/me/stats */
export interface MedicineStats {
  activeCount: number;
  pausedCount: number;
  todayCount: number;
  todayTaken: number;
  streakDays: number;
  last7Days: Array<{ date: string; total: number; taken: number; pct: number }>;
}

/** A row from GET /medicines/me and /medicines/today. */
export interface MedicineRow {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

/**
 * A row from GET /appointments/me.
 *
 * doctorName / doctorSpecialization / hospitalName are added by the
 * additive join in Task 4. They are nullable because the join is a
 * LEFT join — a deleted doctor row must not drop the appointment.
 */
export interface AppointmentRow {
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string;
  date: string;
  time: string;
  status:
    | "scheduled"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
  reason: string | null;
  notes: string | null;
  mode: "in_person" | "video";
  queueNumber: number | null;
  paymentStatus: "pending" | "paid" | "refunded" | "insurance" | null;
  recordCount: number;
  doctorName: string | null;
  doctorSpecialization: string | null;
  hospitalName: string | null;
}

/** A row from GET /medical-records/me. */
export interface RecordRow {
  id: string;
  recordType: string;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  date: string;
  status: "pending" | "completed" | "cancelled" | null;
  tags: string | null;
  createdAt: string;
}

/** GET /medical-records/me/stats */
export interface RecordStats {
  total: number;
  byType: Record<string, number>;
}

/** An event from GET /timeline/me. */
export interface TimelineEvent {
  id: string;
  kind:
    | "record"
    | "vital"
    | "symptom"
    | "medicine_start"
    | "medicine_stop"
    | "appointment"
    | "note";
  date: string;
  title: string;
  subtitle: string | null;
  meta: Record<string, unknown> | null;
  icon?: string;
  color?: string;
  label?: string;
}

/** GET /health-summary/me — only the fields the dashboard reads. */
export interface HealthSummary {
  generatedAt: string;
  demographics: {
    name: string | null;
    age: number | null;
    sex: string | null;
    bloodGroup: string | null;
    bmi: number | null;
    bmiCategory: string | null;
  };
  allergies: Array<{ substance: string; severity: string | null }>;
  conditions: Array<{ title: string; diagnosedOn: string | null }>;
  activeMedicines: Array<{ name: string; dosage: string; frequency: string | null }>;
  alerts: { count: number; items: VitalAlert[] };
}

/** A thread from GET /patient-messages/conversations. */
export interface Conversation {
  id: string;
  doctorId: string;
  doctorName: string | null;
  status: "open" | "closed";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSender: string | null;
  patientUnread: number;
}

/** A message from GET /patient-messages/conversations/:id/messages. */
export interface Message {
  id: string;
  conversationId: string;
  senderRole: "doctor" | "patient";
  body: string;
  createdAt: string;
}