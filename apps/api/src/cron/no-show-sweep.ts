// ─── No-show sweep (doctor-visits lifecycle) ─────────────
//
// Expires stale scheduled/confirmed appointments to no_show across
// ALL patients/doctors. Runs hourly via the shared */5 cron trigger
// (see index.ts scheduled()) so old sessions stop appearing as
// "Coming up" even when nobody opens the app.

import { autoExpireAppointments } from "../lib/booking";

export async function runNoShowSweep(
  db: any
): Promise<{ expired: number }> {
  const expired = await autoExpireAppointments(db);
  return { expired };
}
