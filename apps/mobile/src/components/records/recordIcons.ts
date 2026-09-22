// recordIcons.ts — Real 3D medical image icons for each document type
import { ImageSourcePropType } from "react-native";

export const RECORD_IMAGE_ICONS: Record<string, ImageSourcePropType> = {
  prescription: require("../../../assets/records/prescription.png"),
  lab_report: require("../../../assets/records/lab_report.png"),
  clinical_note: require("../../../assets/records/clinical_note.png"),
  imaging: require("../../../assets/records/imaging.png"),
  vaccination: require("../../../assets/records/vaccination.png"),
  hospital_visit: require("../../../assets/records/hospital_visit.png"),
  allergy: require("../../../assets/records/allergy.png"),
  insurance: require("../../../assets/records/insurance.png"),
  medical_certificate: require("../../../assets/records/medical_certificate.png"),
  surgery: require("../../../assets/records/surgery.png"),
};

// Aliases for related kinds
RECORD_IMAGE_ICONS["medication_order"] = RECORD_IMAGE_ICONS["prescription"];
RECORD_IMAGE_ICONS["lab_order"] = RECORD_IMAGE_ICONS["lab_report"];
RECORD_IMAGE_ICONS["lab_subtest"] = RECORD_IMAGE_ICONS["lab_report"];
RECORD_IMAGE_ICONS["clinical_attachment"] = RECORD_IMAGE_ICONS["clinical_note"];
RECORD_IMAGE_ICONS["imaging_series"] = RECORD_IMAGE_ICONS["imaging"];
RECORD_IMAGE_ICONS["follow_up"] = RECORD_IMAGE_ICONS["hospital_visit"];
RECORD_IMAGE_ICONS["visit"] = RECORD_IMAGE_ICONS["hospital_visit"];
RECORD_IMAGE_ICONS["consultation"] = RECORD_IMAGE_ICONS["hospital_visit"];
RECORD_IMAGE_ICONS["operation_note"] = RECORD_IMAGE_ICONS["surgery"];
RECORD_IMAGE_ICONS["discharge_summary"] = RECORD_IMAGE_ICONS["medical_certificate"];
RECORD_IMAGE_ICONS["invoice"] = RECORD_IMAGE_ICONS["insurance"];
RECORD_IMAGE_ICONS["fitness"] = RECORD_IMAGE_ICONS["hospital_visit"];
RECORD_IMAGE_ICONS["wearable_metric"] = RECORD_IMAGE_ICONS["hospital_visit"];
RECORD_IMAGE_ICONS["other"] = RECORD_IMAGE_ICONS["clinical_note"];

/**
 * Returns a real 3D medical image icon source for the given document kind.
 * Falls back to clinical_note if kind is unrecognized.
 */
export function getRecordImageIcon(kind?: string | null): ImageSourcePropType {
  if (!kind) return RECORD_IMAGE_ICONS.clinical_note;
  const normalized = String(kind).toLowerCase().replace(/\s+/g, "_");
  return RECORD_IMAGE_ICONS[normalized] ?? RECORD_IMAGE_ICONS.clinical_note;
}
