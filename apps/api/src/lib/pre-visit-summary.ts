// ─── Pre-visit summary email helper (Tier 1 records PR3) ──────
//
// Sends the doctor an at-a-glance briefing ~1h before a confirmed
// appointment lands. Same idempotency shape as the post-visit helper:
// stamp `appointments.pre_visit_summary_sent_at` after a successful
// send so subsequent calls (cron retry) skip.
//
// Recipients: doctor's email (joined via users). Subject line mirrors
// `formatPreVisitSummaryEmail`.
//
// Why a separate lib (vs. inline in ai.ts): the cron is decoupled from
// the AI endpoint — both call this. The AI endpoint just returns JSON;
// the cron is the only path that actually emails.

import { eq } from "drizzle-orm";
import {
  appointments,
  doctors,
  users,
  hospitals,
} from "@healthcare/db";
import { createEmailProvider, formatPreVisitSummaryEmail } from "./email";
import { buildSnapshot } from "./snapshot";
import { aiComplete } from "./ai";
import type { ChatMsg } from "./ai";
import { logger } from "./logger";
import type { DB } from "./db";

type Bindings = {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_URL?: string;
  EXPO_PUBLIC_PUBLIC_URL?: string;
  AI?: any;
};

export async function sendPreVisitSummaryEmail(
  env: Bindings,
  db: DB,
  appointmentId: string
): Promise<{ sent: boolean; reason?: string; summary?: string }> {
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!appt) return { sent: false, reason: "appointment_not_found" };
  if (appt.status !== "confirmed" && appt.status !== "scheduled") {
    return { sent: false, reason: "not_confirmed" };
  }
  if ((appt as any).preVisitSummarySentAt) {
    return { sent: false, reason: "already_sent" };
  }

  const [doctorRow] = await db
    .select({
      doctorId: doctors.id,
      name: users.name,
      email: users.email,
      hospitalName: hospitals.name,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .leftJoin(hospitals, eq(hospitals.id, doctors.hospitalId))
    .where(eq(doctors.id, appt.doctorId))
    .limit(1);
  if (!doctorRow || !doctorRow.email) {
    return { sent: false, reason: "no_doctor_email" };
  }
  const { patients } = await import("@healthcare/db");
  const [patientNameRow] = await db
    .select({ patientName: users.name })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, appt.patientId))
    .limit(1);
  const patientName = patientNameRow?.patientName ?? "Patient";

  // Build snapshot + light LLM pass for the summary short text.
  const snapshot = await buildSnapshot(db, appt.patientId);
  const allergiesTop = snapshot.redBanner.map((a) => a.substance);
  const activeMedsNames = snapshot.activeMedicines.map((m) => m.name);
  const chronic = snapshot.chronicConditions.map((c) => c.title);
  const recentDx = snapshot.recentVisits[0]?.diagnosis ?? null;

  let summaryShort = "AI summary unavailable — review the patient snapshot for details.";
  if (env.AI) {
    try {
      const messages: ChatMsg[] = [
        {
          role: "system",
          content:
            "Write a 200-word pre-visit briefing for a doctor. Highlight drug-allergy warnings, chronic conditions, active meds, and the most recent diagnosis. Plain language, no headers. Do not invent data.",
        },
        {
          role: "user",
          content: `Brief this upcoming visit:\n${JSON.stringify({
            patientName,
            visitDate: appt.date,
            visitTime: appt.time,
            reason: appt.reason,
            allergiesTop,
            chronicConditions: chronic,
            activeMedsNames,
            recentDiagnosis: recentDx,
          }).slice(0, 4000)}`,
        },
      ];
      const out = await aiComplete(env.AI, messages, {
        maxTokens: 350,
        temperature: 0.2,
      });
      if (out) summaryShort = out.trim();
    } catch (err) {
      logger.warn("pre-visit-summary.ai_failed", "fallback", {
        appointmentId,
        error: (err as Error).message,
      });
    }
  }

  const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";
  const summaryUrl = `${publicUrl}/portal/appointments/${appointmentId}/pre-visit-summary`;

  const { subject, text, html } = formatPreVisitSummaryEmail({
    patientName,
    doctorName: doctorRow.name || "Doctor",
    hospitalName: doctorRow.hospitalName,
    visitDate: appt.date,
    visitTime: appt.time,
    allergiesTop,
    activeMedsCount: activeMedsNames.length,
    activeMedsNames,
    chronicConditions: chronic,
    recentDiagnosis: recentDx,
    summaryShort,
    summaryUrl,
  });

  const provider = createEmailProvider(env);
  const result = await provider.sendEmail({
    to: doctorRow.email,
    subject,
    text,
    html,
  });

  if (!result.success) {
    logger.warn("pre-visit-summary.send_failed", "provider_rejected", {
      appointmentId,
      error: result.error,
    });
    return { sent: false, reason: "send_failed" };
  }

  const stamp = new Date().toISOString();
  await db
    .update(appointments)
    .set({
      preVisitSummarySentAt: stamp,
      preVisitSummarySentVia: "email",
    } as any)
    .where(eq(appointments.id, appointmentId));

  logger.info("pre-visit-summary.sent", "ok", {
    appointmentId,
    doctorId: appt.doctorId,
    patientId: appt.patientId,
  });
  return { sent: true, summary: summaryShort };
}