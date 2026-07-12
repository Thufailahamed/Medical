// @ts-nocheck
import { Redirect } from "expo-router";

// Caretaker-side medicines tab — reuse principal's medicines screen.
export default function CaretakerMedicines() {
  return <Redirect href={"/(app)/medicines" as any} />;
}