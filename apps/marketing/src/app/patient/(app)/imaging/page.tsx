import { redirect } from "next/navigation";

// The /portal/(patient)/me/imaging surface is the canonical implementation.
// This route re-exports the same content under the /patient/* tree so the
// new sidebar stays the only navigation in the patient app.
export default function ImagingPage() {
  redirect("/portal/me/imaging");
}
