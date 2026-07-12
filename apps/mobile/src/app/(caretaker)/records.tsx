// @ts-nocheck
import { Redirect } from "expo-router";

// Caretaker-side records tab — reuse principal's records screen.
export default function CaretakerRecords() {
  return <Redirect href={"/(app)/records" as any} />;
}