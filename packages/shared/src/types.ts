export type UserRole =
  | "patient"
  | "doctor"
  | "hospital_admin"
  | "hospital_staff"
  | "laboratory"
  | "pharmacy"
  | "insurance"
  | "ambulance"
  | "super_admin";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "pending" | "paid" | "refunded" | "insurance";

export type LabReportStatus =
  | "pending"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ClaimStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "paid";

export type EmergencyStatus = "active" | "responding" | "resolved" | "cancelled";

export type RecordType =
  | "lab_report"
  | "imaging"
  | "prescription"
  | "hospital_visit"
  | "vaccination"
  | "surgery"
  | "allergy"
  | "insurance"
  | "fitness"
  | "discharge_summary"
  | "medical_certificate"
  | "operation_note"
  | "invoice";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface User {
  id: string;
  supabaseId: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  name: string;
  nic: string | null;
  photo: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  userId: string;
  bloodGroup: BloodGroup | null;
  height: number | null;
  weight: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  emergencyContacts: string | null;
  lifestyle: string | null;
  insuranceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  hospitalId: string | null;
  specialization: string;
  registrationNumber: string | null;
  qualification: string | null;
  experience: number | null;
  consultationFee: number | null;
  availableSlots: string | null;
  rating: number | null;
  createdAt: string;
}

export interface Hospital {
  id: string;
  userId: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  location: string | null;
  specializations: string | null;
  rating: number | null;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  hospitalId: string | null;
  doctorId: string | null;
  recordType: RecordType;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  date: string;
  followUpDate: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  queueNumber: number | null;
  waitingTime: number | null;
  reason: string | null;
  notes: string | null;
  paymentAmount: number | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface Medicine {
  id: string;
  patientId: string;
  prescriptionId: string | null;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  endDate: string | null;
  refillReminder: boolean;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
