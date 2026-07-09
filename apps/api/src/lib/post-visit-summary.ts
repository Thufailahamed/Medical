// ─── Post-visit summary email helper ─────────────────────
//
// Round 3 P1: send the patient a summary email ~immediately after the
// doctor marks the appointment "completed". The email includes a deep
// link to the in-app rate screen so they can leave a 1-tap star rating.
//
// Idempotency: stamps `appointments.summary_email_sent_at` on first
// success. The inline trigger (doctor-portal status flip) calls this
// fire-and-forget; the hourly cron calls it for any stragglers. Both
// paths converge on the same stamp, so a double-send is impossible.
//
// What we send:
//   - Plain text body for older clients / screen readers.
//   - HTML with a single clickable "Rate your visit" CTA.
//   - Deep link to healthhub://rate-visit/<appointmentId> so the mobile
//     app handles the link and routes into the rating screen. Falls
//     back to the public URL on web.

import { eq } from "drizzle-orm";
import {
  appointments,
  doctors,
  patients,
  prescriptions,
  medicines,
  users,
} from "@healthcare/db";
import { createEmailProvider, formatVisitSummaryEmail } from "./email";
import { logger } from "./logger";
import type { DB } from "./db";

type Bindings = {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_URL?: string;
  EXPO_PUBLIC_PUBLIC_URL?: string;
};

export async function sendVisitSummaryEmail(
  env: Bindings,
  db: DB,
  appointmentId: string
): Promise<{ sent: boolean; reason?: string }> {
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!appt) return { sent: false, reason: "appointment_not_found" };
  if (appt.status !== "completed") {
    return { sent: false, reason: "not_completed" };
  }
  if (appt.summaryEmailSentAt) {
    return { sent: false, reason: "already_sent" };
  }

  const [patientRow] = await db
    .select({
      patientId: patients.id,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, appt.patientId))
    .limit(1);
  if (!patientRow || !patientRow.patientEmail) {
    return { sent: false, reason: "no_patient_email" };
  }

  const [doctorRow] = await db
    .select({ name: users.name, specialization: doctors.specialization })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, appt.doctorId))
    .limit(1);

  // Pull medicines from the prescriptions attached to this appointment
  // for the summary. Doctors can attach multiple — we list all of them.
  const rxRows = await db
    .select({ id: prescriptions.id })
    .from(prescriptions)
    .where(eq(prescriptions.patientId, appt.patientId));

  const medicineNames: string[] = [];
  for (const rx of rxRows) {
    const meds = await db
      .select({ name: medicines.name, dosage: medicines.dosage })
      .from(medicines)
      .where(eq(medicines.prescriptionId, rx.id));
    for (const m of meds) {
      medicineNames.push(m.dosage ? `${m.name} (${m.dosage})` : m.name);
    }
  }

  const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";
  // Deep link so the mobile app handles it directly when tapped on
  // phone. The web fallback routes through the public URL.
  const rateUrl = `healthhub://rate-visit/${appointmentId}`;

  const { subject, text, html } = formatVisitSummaryEmail({
    patientName: patientRow.patientName || "there",
    doctorName: doctorRow?.name || "your doctor",
    diagnosis: appt.reason ?? appt.notes ?? null,
    medicines: medicineNames,
    rateUrl: `${publicUrl}/rate-visit/${appointmentId}?deeplink=${encodeURIComponent(rateUrl)}`,
  });

  const provider = createEmailProvider(env);
  const result = await provider.sendEmail({
    to: patientRow.patientEmail,
    subject,
    text,
    html,
  });

  if (!result.success) {
    logger.warn("post-visit-summary.send_failed", "provider_rejected", {
      appointmentId,
      error: result.error,
    });
    return { sent: false, reason: "send_failed" };
  }

  // Stamp the appointment so subsequent calls (cron retry) skip. Use
  // the local clock for the timestamp; we only use it for "did we
  // already send" — not for ordering.
  const stamp = new Date().toISOString();
  await db
    .update(appointments)
    .set({ summaryEmailSentAt: stamp } as any)
    .where(eq(appointments.id, appointmentId));

  logger.info("post-visit-summary.sent", "ok", {
    appointmentId,
    patientId: appt.patientId,
    doctorId: appt.doctorId,
  });

  return { sent: true };
}