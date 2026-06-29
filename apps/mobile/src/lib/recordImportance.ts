// Single source of truth for medical record metadata.
// Used by: Roadmap component (dot sizing, color, gap callouts),
// add-record screen (file required-by-type), record filters.

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
} from "lucide-react-native";

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

export type Rank = 1 | 2 | 3;

export type RecordMeta = {
  label: string;
  icon: ComponentType<any>;
  iconColor: string;
  bgTone: string;
  /** Visual weight on the rail — drives dot size and emphasis. */
  rank: Rank;
};

// Icon + color palette mirrors the original TYPE_META in records.tsx so the
// roadmap cards look identical to the existing list view.
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
};

export function metaFor(type?: string): RecordMeta {
  return (
    RECORD_META[type as RecordType] ?? {
      label: type ? type.replace(/_/g, " ") : "Record",
      icon: FileText,
      iconColor: "#7a7582",
      bgTone: "#e6e0e9",
      rank: 1,
    }
  );
}