// Single source of truth for medical record metadata.
// Used by: Roadmap component (dot sizing, color, gap callouts),
// add-record screen (file required-by-type), record filters.
//
// The RecordType union mirrors packages/shared/src/records.ts
// RECORD_KINDS. The mobile app historically had only 13 kinds; the
// full v3 set (22 kinds) is now present so any record row renders
// with the right visual weight instead of falling through to "other".

import type { ComponentType } from "react";
import {
  FlaskConical,
  Image as ImageIcon,
  ScrollText,
  Stethoscope,
  Syringe,
  Scissors,
  AlertCircle,
  ShieldCheck,
  Dumbbell,
  FileBadge,
  NotebookPen,
  HeartPulse,
  Receipt,
  FileText,
  Microscope,
  Paperclip,
  Layers,
  Activity,
  TestTube,
  CalendarCheck2,
  Notebook,
  Folder,
  Pill,
} from "lucide-react-native";

export type RecordType =
  // v1 / v2 medicalRecords.recordType
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
  | "invoice"
  | "clinical_note"
  | "lab_order"
  | "follow_up"
  | "other"
  // v3 kinds
  | "medication_order"
  | "lab_subtest"
  | "clinical_attachment"
  | "imaging_series"
  | "wearable_metric";

export type Rank = 1 | 2 | 3;

export type RecordMeta = {
  label: string;
  icon: ComponentType<any>;
  iconColor: string;
  bgTone: string;
  /** Visual weight on the rail — drives dot size and emphasis. */
  rank: Rank;
};

const FALLBACK: RecordMeta = {
  label: "Record",
  icon: FileText,
  iconColor: "#7a7582",
  bgTone: "#e6e0e9",
  rank: 1,
};

// Icon + color palette mirrors the original TYPE_META in records.tsx so
// the roadmap cards look identical to the existing list view. New v3
// kinds get neutral styling until a designer weighs in.
export const RECORD_META: Record<RecordType, RecordMeta> = {
  lab_report: {
    label: "Lab",
    icon: FlaskConical,
    iconColor: "#765b00",
    bgTone: "#ffdf93",
    rank: 2,
  },
  imaging: {
    label: "Imaging",
    icon: ImageIcon,
    iconColor: "#63597c",
    bgTone: "#e1d4fd",
    rank: 2,
  },
  prescription: {
    label: "Prescription",
    icon: ScrollText,
    iconColor: "#4f378a",
    bgTone: "#e9ddff",
    rank: 2,
  },
  hospital_visit: {
    label: "Visit",
    icon: Stethoscope,
    iconColor: "#006a6a",
    bgTone: "#a4f0f0",
    rank: 3,
  },
  vaccination: {
    label: "Vaccine",
    icon: Syringe,
    iconColor: "#7a5900",
    bgTone: "#fff0c2",
    rank: 2,
  },
  surgery: {
    label: "Surgery",
    icon: Scissors,
    iconColor: "#ba1a1a",
    bgTone: "#ffdad6",
    rank: 3,
  },
  allergy: {
    label: "Allergy",
    icon: AlertCircle,
    iconColor: "#ba1a1a",
    bgTone: "#ffdad6",
    rank: 1,
  },
  insurance: {
    label: "Insurance",
    icon: ShieldCheck,
    iconColor: "#006b54",
    bgTone: "#a8f0d4",
    rank: 1,
  },
  fitness: {
    label: "Fitness",
    icon: Dumbbell,
    iconColor: "#4f378a",
    bgTone: "#e9ddff",
    rank: 1,
  },
  discharge_summary: {
    label: "Discharge",
    icon: FileBadge,
    iconColor: "#4f378a",
    bgTone: "#e9ddff",
    rank: 3,
  },
  medical_certificate: {
    label: "Certificate",
    icon: NotebookPen,
    iconColor: "#4f378a",
    bgTone: "#e9ddff",
    rank: 2,
  },
  operation_note: {
    label: "Op Note",
    icon: HeartPulse,
    iconColor: "#ba1a1a",
    bgTone: "#ffdad6",
    rank: 3,
  },
  invoice: {
    label: "Invoice",
    icon: Receipt,
    iconColor: "#765b00",
    bgTone: "#ffdf93",
    rank: 2,
  },
  clinical_note: {
    label: "Note",
    icon: Notebook,
    iconColor: "#1d6cb1",
    bgTone: "#d3e4ff",
    rank: 2,
  },
  lab_order: {
    label: "Lab order",
    icon: TestTube,
    iconColor: "#765b00",
    bgTone: "#ffdf93",
    rank: 2,
  },
  follow_up: {
    label: "Follow-up",
    icon: CalendarCheck2,
    iconColor: "#7a5900",
    bgTone: "#fff0c2",
    rank: 2,
  },
  other: {
    label: "Other",
    icon: Folder,
    iconColor: "#7a7582",
    bgTone: "#e6e0e9",
    rank: 1,
  },
  medication_order: {
    label: "Med order",
    icon: Pill,
    iconColor: "#4f378a",
    bgTone: "#e9ddff",
    rank: 2,
  },
  lab_subtest: {
    label: "Sub-test",
    icon: Microscope,
    iconColor: "#765b00",
    bgTone: "#ffdf93",
    rank: 2,
  },
  clinical_attachment: {
    label: "Attachment",
    icon: Paperclip,
    iconColor: "#7a7582",
    bgTone: "#e6e0e9",
    rank: 1,
  },
  imaging_series: {
    label: "Imaging series",
    icon: Layers,
    iconColor: "#63597c",
    bgTone: "#e1d4fd",
    rank: 2,
  },
  wearable_metric: {
    label: "Wearable",
    icon: Activity,
    iconColor: "#ba1a9a",
    bgTone: "#ffd6f3",
    rank: 1,
  },
};

export function metaFor(type?: string): RecordMeta {
  if (type && (type in RECORD_META)) {
    return RECORD_META[type as RecordType];
  }
  return {
    ...FALLBACK,
    label: type ? type.replace(/_/g, " ") : FALLBACK.label,
  };
}
