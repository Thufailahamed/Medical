// The legacy /laboratory route shipped a "use client" page that
// called `redirect("/lab-portal")` — `redirect()` only works inside
// server components, so the call was a silent no-op that fell through
// to a fully-rendered mock dashboard (fictional patients/NICs/stats).
// Replace the file with a server-only redirect so visits to
// `/laboratory` go straight to the lab-portal surface.
import { redirect } from "next/navigation";

export default function LaboratoryRedirect(): never {
  redirect("/lab-portal");
}
